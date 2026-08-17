import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const source = (file: string) => readFileSync(path.join(root, file), "utf8");

test("only assessed AI assignments receive execute_code", () => {
  const assessed = source("lib/agent/session-runtime.ts");
  const professor = source("lib/agent/professor-runtime.ts");
  const personal = source("lib/agent/student-atlas-runtime.ts");
  assert.match(assessed, /execute_code: executeCode/);
  assert.match(assessed, /codeExecutionEnabled\(\)/);
  assert.doesNotMatch(professor, /execute_code/);
  assert.doesNotMatch(personal, /execute_code/);
});

test("tool calls carry AI SDK replay and cancellation identity into the service", () => {
  const tool = source("lib/agent/code-execution-tool.ts");
  assert.match(tool, /toolCallId/);
  assert.match(tool, /abortSignal/);
  assert.match(tool, /executeCodeForSession/);
});

test("execution records and artifacts repeat tenant, owner, and session scope", () => {
  const service = source("lib/code-execution/service.ts");
  const route = source("app/code-execution/artifacts/[artifactId]/[filename]/route.ts");
  const migration = source("drizzle/0022_code_execution.sql");
  for (const predicate of ["codeExecutions.orgId", "codeExecutions.userId", "codeExecutions.agentSessionId"]) {
    assert.match(service, new RegExp(predicate.replace(".", "\\.")));
  }
  for (const predicate of ["codeExecutionArtifacts.orgId", "codeExecutionArtifacts.ownerUserId", "codeExecutionArtifacts.agentSessionId"]) {
    assert.match(route, new RegExp(predicate.replace(".", "\\.")));
  }
  assert.match(route, /actor\.id === args\.ownerUserId/);
  assert.match(route, /enrollment\?\.role === "instructor"/);
  assert.match(route, /enrollment\?\.role === "ta"/);
  assert.match(migration, /code_executions_idempotency_idx/);
  assert.match(migration, /code_execution_artifacts_execution_path_idx/);
});

test("manual and deadline submission both clean up the disposable workspace", () => {
  assert.match(source("lib/student/actions.ts"), /stopCodeExecutionWorkspace/);
  assert.match(source("lib/agent/session-conclusion.ts"), /stopCodeExecutionWorkspace/);
});

test("the shared renderer exposes bounded terminal output and authorized files", () => {
  const renderer = source("components/agent/message-parts.tsx");
  assert.match(renderer, /run\[_-\]\?code/);
  assert.match(renderer, /Array\.isArray\(output\.files\)/);
  assert.match(renderer, /<Terminal/);
  assert.match(renderer, /<FilePart/);
});
