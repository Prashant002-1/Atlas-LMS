import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative: string) => readFileSync(path.join(root, relative), "utf8");

test("agent turns use addressable durable workflow streams", () => {
  const schema = read("lib/db/schema.ts");
  const workflow = read("workflows/agent-session.ts");
  const reconnect = read("app/api/agent-runs/[runId]/stream/route.ts");
  const planning = read("components/planning/atlas-room.tsx");
  const student = read("components/session/session-room.tsx");

  assert.match(read("next.config.mjs"), /withWorkflow/);
  for (const field of ["activeRunId", "activeRunStartedAt", "deadlineAt", "deadlineRunId"]) {
    assert.match(schema, new RegExp(field));
  }
  assert.equal(existsSync(path.join(root, "drizzle/0006_durable_agent_runs.sql")), true);
  assert.match(workflow, /professorTurnWorkflow/);
  assert.match(workflow, /studentTurnWorkflow/);
  assert.match(workflow, /getWritable/);
  assert.match(reconnect, /eq\(agentSessions\.userId, user\.id\)/);
  assert.match(reconnect, /getReadable/);
  assert.match(read("vercel.json"), /supportsCancellation/);
  for (const room of [planning, student]) {
    assert.match(room, /WorkflowChatTransport/);
    assert.match(room, /resume: Boolean\(props\.activeRunId\)/);
    assert.match(room, /agent-runs/);
  }
});

test("assessed-session expiry concludes, submits, and drafts a grade", () => {
  const workflow = read("workflows/agent-session.ts");
  const conclusion = read("lib/agent/session-conclusion.ts");
  const route = read("app/api/session/[assignmentId]/route.ts");
  const room = read("components/session/session-room.tsx");

  assert.match(workflow, /sessionDeadlineWorkflow/);
  assert.match(workflow, /await sleep\(new Date\(args\.deadlineAt\)\)/);
  assert.match(workflow, /concludeExpiredSession/);
  assert.match(conclusion, /submitSessionRecord/);
  assert.match(conclusion, /runGradingForSubmission/);
  assert.match(conclusion, /data-session-end/);
  assert.match(route, /claimDeadlineRun/);
  assert.match(route, /Time is up\. Atlas is closing and submitting this session\./);
  assert.match(room, /ClosingControl/);
  assert.match(room, /\/state/);
});

test("student and instructor agent surfaces share quiet progress and steering", () => {
  const planning = read("components/planning/atlas-room.tsx");
  const student = read("components/session/session-room.tsx");
  const status = read("components/ai-elements/agent-status.tsx");

  assert.match(status, /<Shimmer/);
  assert.match(status, /PromptCheckpointRail/);
  assert.equal(planning.match(/label="Thinking"/g)?.length, 1);
  for (const room of [planning, student]) {
    assert.match(room, /ThinkingIndicator/);
    assert.match(room, /Steer queued/);
    assert.match(room, /allowSubmitWhileBusy/);
    assert.doesNotMatch(room, /ConversationScrollButton/);
  }
});

test("integrations stay instructor-owned and enter student work contextually", () => {
  const instructorLayout = read("app/teach/layout.tsx");
  const studentLayout = read("app/student/layout.tsx");
  const integrations = read("app/teach/integrations/page.tsx");
  const settings = read("components/cockpit/contract-rubric.tsx");

  assert.match(instructorLayout, /\/teach\/integrations/);
  assert.doesNotMatch(studentLayout, /integrations/i);
  for (const standard of ["LTI 1.3", "Deep Linking", "Assignment and Grade Services"]) {
    assert.match(integrations, new RegExp(standard));
  }
  assert.match(integrations, /Students use the tool selected by their instructor/);
  assert.match(settings, /Connected tools/);
});

test("long-running form actions and invalid sign-in provide visible feedback", () => {
  const pending = read("components/atlas/pending-action-button.tsx");
  const signIn = read("components/atlas/sign-in-form.tsx");

  assert.match(pending, /useFormStatus/);
  assert.match(pending, /aria-busy/);
  assert.match(pending, /animate-spin/);
  assert.match(signIn, /prefers-reduced-motion/);
  assert.match(signIn, /translateX/);
  assert.match(signIn, /role="alert"/);
});
