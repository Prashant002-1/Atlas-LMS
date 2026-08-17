import assert from "node:assert/strict";
import test from "node:test";
import {
  GetCodeInterpreterSessionCommand,
  InvokeCodeInterpreterCommand,
  StartCodeInterpreterSessionCommand,
  StopCodeInterpreterSessionCommand,
  type CodeInterpreterStreamOutput,
} from "@aws-sdk/client-bedrock-agentcore";
import {
  AgentCoreCodeExecutionRuntime,
  collectAgentCoreStream,
  isExpiredAgentCoreSessionError,
} from "./agentcore";

function eventStream(events: CodeInterpreterStreamOutput[]) {
  return (async function* () {
    for (const event of events) yield event;
  })();
}

test("AgentCore stream aggregation preserves terminal metadata", async () => {
  const result = await collectAgentCoreStream(eventStream([
    { result: { content: [{ type: "text", text: "hello" }], structuredContent: { stdout: "one", executionTime: 12 }, isError: false } },
    { result: { content: [], structuredContent: { stdout: "two", stderr: "warn", exitCode: 0 }, isError: false } },
  ]));
  assert.equal(result.stdout, "onetwo");
  assert.equal(result.stderr, "warn");
  assert.equal(result.exitCode, 0);
  assert.equal(result.durationMs, 12);
});

test("AgentCore stream exceptions fail closed", async () => {
  await assert.rejects(
    collectAgentCoreStream(eventStream([{ resourceNotFoundException: {
      message: "session expired",
      name: "ResourceNotFoundException",
      $fault: "client",
      $metadata: {},
    } }])),
    /session expired/
  );
});

test("expired AgentCore session detection accepts SDK exception-name casing", () => {
  const error = new Error("gone");
  error.name = "resourceNotFoundException";
  assert.equal(isExpiredAgentCoreSessionError(error), true);
});

test("runtime fails when AgentCore rejects input-file staging", async () => {
  const calls: string[] = [];
  const fakeClient = {
    async send(command: unknown) {
      if (command instanceof InvokeCodeInterpreterCommand) {
        calls.push(String(command.input.name));
        return {
          stream: eventStream([{ result: {
            content: [{ type: "text", text: "input path rejected" }],
            isError: true,
          } }]),
        };
      }
      throw new Error("Unexpected command");
    },
  };
  const runtime = new AgentCoreCodeExecutionRuntime({ client: fakeClient as never });
  await assert.rejects(runtime.execute({
    sessionId: "session-1",
    input: {
      language: "python",
      code: "print('unreachable')",
      inputFiles: [{ path: "inputs/value.txt", content: "3" }],
      outputFiles: [],
      clearContext: false,
    },
  }), /input path rejected/);
  assert.deepEqual(calls, ["writeFiles"]);
});

test("runtime stages inputs, executes code, and retrieves only declared files", async () => {
  const calls: string[] = [];
  const fakeClient = {
    async send(command: unknown) {
      if (command instanceof StartCodeInterpreterSessionCommand) {
        calls.push("start");
        return { sessionId: "session-1", createdAt: new Date(), codeInterpreterIdentifier: "aws.codeinterpreter.v1" };
      }
      if (command instanceof GetCodeInterpreterSessionCommand) {
        calls.push("get");
        return { status: "READY" };
      }
      if (command instanceof StopCodeInterpreterSessionCommand) {
        calls.push("stop");
        return {};
      }
      if (command instanceof InvokeCodeInterpreterCommand) {
        calls.push(String(command.input.name));
        if (command.input.name === "readFiles") {
          return {
            stream: eventStream([{ result: {
              content: [{
                type: "resource",
                name: "outputs/result.csv",
                mimeType: "text/csv",
                resource: { type: "text", text: "value\n3\n", mimeType: "text/csv" },
              }],
              isError: false,
            } }]),
          };
        }
        return {
          stream: eventStream([{ result: {
            content: [],
            structuredContent: command.input.name === "executeCode" ? { stdout: "sum=3\n", exitCode: 0, executionTime: 8 } : {},
            isError: false,
          } }]),
        };
      }
      throw new Error("Unexpected command");
    },
  };
  const runtime = new AgentCoreCodeExecutionRuntime({ client: fakeClient as never });
  const session = await runtime.startSession({ name: "test", clientToken: "token", timeoutSeconds: 900 });
  const result = await runtime.execute({
    sessionId: session.sessionId,
    input: {
      language: "python",
      code: "print(3)",
      inputFiles: [{ path: "inputs/value.txt", content: "3" }],
      outputFiles: ["outputs/result.csv"],
      clearContext: false,
    },
  });
  assert.deepEqual(calls, ["start", "writeFiles", "executeCode", "readFiles"]);
  assert.equal(result.stdout, "sum=3\n");
  assert.equal(new TextDecoder().decode(result.files[0]?.bytes), "value\n3\n");
  assert.equal(result.files[0]?.path, "outputs/result.csv");
  assert.equal((await runtime.getSession({ sessionId: session.sessionId })).status, "ready");
  await runtime.stopSession({ sessionId: session.sessionId });
  assert.deepEqual(calls.slice(-2), ["get", "stop"]);
});
