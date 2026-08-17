import assert from "node:assert/strict";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../lib/db";
import { executeCodeForSession, stopCodeExecutionWorkspace } from "../lib/code-execution/service";
import type { CodeExecutionRuntime } from "../lib/code-execution/contracts";
import { codeExecutionArtifacts, codeExecutionWorkspaces } from "../lib/db/code-execution-schema";
import { agentSessions } from "../lib/db/schema";

class FakeRuntime implements CodeExecutionRuntime {
  starts = 0;
  executions = 0;
  stops = 0;
  activeExecutions = 0;
  maxActiveExecutions = 0;
  readonly slowExecutionStarted: Promise<void>;
  private readonly slowExecutionReleased: Promise<void>;
  private resolveSlowExecutionStarted!: () => void;
  private resolveSlowExecutionReleased!: () => void;

  constructor() {
    this.slowExecutionStarted = new Promise((resolve) => {
      this.resolveSlowExecutionStarted = resolve;
    });
    this.slowExecutionReleased = new Promise((resolve) => {
      this.resolveSlowExecutionReleased = resolve;
    });
  }

  releaseSlowExecution() {
    this.resolveSlowExecutionReleased();
  }

  async startSession(args: { timeoutSeconds: number }) {
    this.starts += 1;
    return { sessionId: "local-smoke-session", expiresAt: new Date(Date.now() + args.timeoutSeconds * 1000) };
  }

  async execute(args: { input: { code: string }; abortSignal?: AbortSignal }) {
    this.executions += 1;
    this.activeExecutions += 1;
    this.maxActiveExecutions = Math.max(this.maxActiveExecutions, this.activeExecutions);
    try {
      if (args.input.code === "__provider_failure__") throw new Error("simulated provider failure");
      if (args.input.code === "__serialized__") {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (args.input.code === "__slow_success__") {
        this.resolveSlowExecutionStarted();
        await this.slowExecutionReleased;
      }
      if (args.input.code === "__wait__") {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(resolve, 10_000);
          args.abortSignal?.addEventListener("abort", () => {
            clearTimeout(timeout);
            reject(args.abortSignal?.reason);
          }, { once: true });
        });
      }
      return {
        stdout: "sum=16\n",
        stderr: "",
        exitCode: 0,
        durationMs: 12,
        isError: false,
        files: [{ path: "outputs/summary.csv", mediaType: "text/csv", bytes: new TextEncoder().encode("count,sum\n3,16\n") }],
      };
    } finally {
      this.activeExecutions -= 1;
    }
  }

  async getSession() {
    return { status: "ready" as const };
  }

  async stopSession() {
    this.stops += 1;
  }
}

async function main() {
  const [session] = await db
    .select({ session: agentSessions })
    .from(agentSessions)
    .leftJoin(codeExecutionWorkspaces, eq(codeExecutionWorkspaces.agentSessionId, agentSessions.id))
    .where(and(
      eq(agentSessions.surface, "cue"),
      eq(agentSessions.anchorType, "assignment"),
      isNull(codeExecutionWorkspaces.id)
    ))
    .limit(1);
  assert(session?.session, "Local fixtures need one assessed session without a code workspace.");

  const runtime = new FakeRuntime();
  const priorTimeout = process.env.ATLAS_CODE_EXECUTION_TIMEOUT_MS;
  try {
    const toolCallId = `local-smoke-${Date.now()}`;
    const first = await executeCodeForSession({
      session: session.session,
      toolCallId,
      input: {
        language: "python",
        code: "print(sum([3, 5, 8]))",
        inputFiles: [],
        outputFiles: ["outputs/summary.csv"],
        clearContext: true,
      },
      runtime,
    });
    const replay = await executeCodeForSession({
      session: session.session,
      toolCallId,
      input: {
        language: "python",
        code: "print(sum([3, 5, 8]))",
        inputFiles: [],
        outputFiles: ["outputs/summary.csv"],
        clearContext: true,
      },
      runtime,
    });
    assert.equal(first.status, "succeeded");
    assert.equal(first.stdout, "sum=16\n");
    assert.equal(first.files.length, 1);
    assert.equal(replay.status, "succeeded");
    assert.equal(replay.executionId, first.executionId);

    const [workspace] = await db.select().from(codeExecutionWorkspaces).where(and(
      eq(codeExecutionWorkspaces.orgId, session.session.orgId),
      eq(codeExecutionWorkspaces.agentSessionId, session.session.id)
    )).limit(1);
    assert(workspace);
    const [artifact] = await db.select().from(codeExecutionArtifacts).where(and(
      eq(codeExecutionArtifacts.id, first.files[0]!.id),
      eq(codeExecutionArtifacts.orgId, session.session.orgId),
      eq(codeExecutionArtifacts.ownerUserId, session.session.userId),
      eq(codeExecutionArtifacts.agentSessionId, session.session.id)
    )).limit(1);
    assert(artifact);
    assert.equal(new TextDecoder().decode(artifact.bytes), "count,sum\n3,16\n");
    assert.equal(runtime.starts, 1);
    assert.equal(runtime.executions, 1);

    const concurrentInputs = {
      language: "python" as const,
      code: "__serialized__",
      inputFiles: [],
      outputFiles: ["outputs/summary.csv"],
      clearContext: true,
    };
    const [concurrentFirst, concurrentSecond] = await Promise.all([
      executeCodeForSession({
        session: session.session,
        toolCallId: `local-concurrent-a-${Date.now()}`,
        input: concurrentInputs,
        runtime,
      }),
      executeCodeForSession({
        session: session.session,
        toolCallId: `local-concurrent-b-${Date.now()}`,
        input: concurrentInputs,
        runtime,
      }),
    ]);
    assert.equal(concurrentFirst.status, "succeeded");
    assert.equal(concurrentSecond.status, "succeeded");
    assert.equal(runtime.starts, 1);
    assert.equal(runtime.executions, 3);
    assert.equal(runtime.maxActiveExecutions, 1);

    const longRunning = executeCodeForSession({
      session: session.session,
      toolCallId: `local-long-running-${Date.now()}`,
      input: {
        language: "python",
        code: "__slow_success__",
        inputFiles: [],
        outputFiles: [],
        clearContext: true,
      },
      runtime,
    });
    await runtime.slowExecutionStarted;
    process.env.ATLAS_CODE_EXECUTION_TIMEOUT_MS = "1000";
    try {
      const waiting = await executeCodeForSession({
        session: session.session,
        toolCallId: `local-waiting-timeout-${Date.now()}`,
        input: {
          language: "python",
          code: "print('never entered')",
          inputFiles: [],
          outputFiles: [],
          clearContext: true,
        },
        runtime,
      });
      assert.equal(waiting.status, "timed_out");
      assert.equal(runtime.executions, 4);
      assert.equal(runtime.stops, 0);
    } finally {
      if (priorTimeout === undefined) delete process.env.ATLAS_CODE_EXECUTION_TIMEOUT_MS;
      else process.env.ATLAS_CODE_EXECUTION_TIMEOUT_MS = priorTimeout;
      runtime.releaseSlowExecution();
    }
    assert.equal((await longRunning).status, "succeeded");
    assert.equal(runtime.maxActiveExecutions, 1);

    const failed = await executeCodeForSession({
      session: session.session,
      toolCallId: `local-failure-${Date.now()}`,
      input: {
        language: "python",
        code: "__provider_failure__",
        inputFiles: [],
        outputFiles: [],
        clearContext: true,
      },
      runtime,
    });
    assert.equal(failed.status, "failed");
    assert.match(failed.stderr, /simulated provider failure/);

    process.env.ATLAS_CODE_EXECUTION_TIMEOUT_MS = "1000";
    const timedOut = await executeCodeForSession({
      session: session.session,
      toolCallId: `local-timeout-${Date.now()}`,
      input: {
        language: "python",
        code: "__wait__",
        inputFiles: [],
        outputFiles: [],
        clearContext: true,
      },
      runtime,
    });
    assert.equal(timedOut.status, "timed_out");
    assert.equal(runtime.executions, 6);
    assert.equal(runtime.stops, 1);

    await stopCodeExecutionWorkspace({ orgId: session.session.orgId, sessionId: session.session.id, runtime });
    assert.equal(runtime.stops, 1);
    console.log("Local code-execution persistence, ownership, idempotency, serialization, wait isolation, artifact, provider-failure, timeout, and cleanup paths passed.");
  } finally {
    if (priorTimeout === undefined) delete process.env.ATLAS_CODE_EXECUTION_TIMEOUT_MS;
    else process.env.ATLAS_CODE_EXECUTION_TIMEOUT_MS = priorTimeout;
    await db.delete(codeExecutionWorkspaces).where(and(
      eq(codeExecutionWorkspaces.orgId, session.session.orgId),
      eq(codeExecutionWorkspaces.userId, session.session.userId),
      eq(codeExecutionWorkspaces.agentSessionId, session.session.id)
    ));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
