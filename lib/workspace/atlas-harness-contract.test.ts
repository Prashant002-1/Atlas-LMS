import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative: string) => readFileSync(path.join(root, relative), "utf8");

test("the Atlas page is a full viewport operator with quiet streaming feedback", () => {
  const room = read("components/planning/atlas-room.tsx");
  const entry = read("components/planning/planning-room.tsx");
  assert.match(entry, /atlas-room/);
  assert.match(room, /atlas-harness-root/);
  assert.match(room, /html:has\(\.atlas-harness-root\)/);
  assert.match(room, /Threads/);
  assert.match(room, /Drafts/);
  assert.match(room, /PanelRightOpen/);
  assert.match(room, /Voice input coming soon/);
  assert.match(room, /ThinkingIndicator/);
  assert.match(room, /<Spinner/);
  assert.match(room, /Checking the gradebook/);
  assert.match(room, /What is the grade distribution for this class\?/);
  assert.match(room, /How is Maya Patel doing\?/);
  assert.doesNotMatch(room, /Run trace/);
  assert.doesNotMatch(room, /TaskTrigger/);
  assert.doesNotMatch(room, /Starting the run/);
  assert.doesNotMatch(room, /course record/i);
});

test("the professor runtime is fresh, durable, and uses the LMS operator", () => {
  const runtime = read("lib/agent/professor-runtime.ts");
  assert.match(runtime, /persistSessionTurn\(session, "user"/);
  assert.match(runtime, /buildProfessorPack\(scope\)/);
  assert.match(runtime, /loadAtlasHarness\(\)/);
  assert.match(runtime, /professorOperatorTools/);
  assert.match(runtime, /data-run-context/);
  assert.match(runtime, /buildProfessorReference/);
  assert.match(runtime, /\.\.\.priorMessages, referenceMessage, currentMessage/);
  assert.match(runtime, /isStepCount\(16\)/);
  assert.match(runtime, /persistSessionTurn\(session, "assistant"/);
  assert.match(runtime, /compactIfNeeded/);
});

test("the professor can read the whole course and act on the LMS", () => {
  const tools = read("lib/agent/lms-operator.ts");
  for (const name of ["inspect_lms", "read_gradebook", "search_course", "mutate_lms", "load_skill"]) {
    assert.match(tools, new RegExp(`const ${name} = tool`));
  }
  for (const resource of ["students", "submissions", "sessions", "rubrics", "files", "policies", "calendar"]) {
    assert.match(tools, new RegExp(`"${resource}"`));
  }
  for (const action of ["create_assignment", "post_announcement", "set_grade", "mark_missing", "update_session_contract", "apply_draft", "grade_session", "finalize_session_grade", "delete_record"]) {
    assert.match(tools, new RegExp(`literal\\("${action}"\\)`));
  }
  assert.match(tools, /summarizeGradeDistribution/);
  assert.match(tools, /studentQuery/);
  assert.match(tools, /eq\(enrollments\.courseId, scope\.courseId\)/);
  assert.match(tools, /eq\(submissions\.orgId, scope\.orgId\)/);
  assert.match(tools, /confirmTitle/);
});

test("the operator instructions require a real read before an unavailable claim", () => {
  const instructions = read("lib/agent/professor-operator-context.ts");
  assert.match(instructions, /read_gradebook/);
  assert.match(instructions, /individual student's performance/);
  assert.match(instructions, /Never claim data is unavailable without making the relevant read/);
  assert.match(instructions, /use mutate_lms/);
  assert.doesNotMatch(instructions, /class-level only/i);
});

test("the live endpoint fails closed and limits public traffic", () => {
  const route = read("app/api/atlas/planning/route.ts");
  for (const guard of ["isInstructorLike", "guardProfessorInput", "withinTurnBudget", "MAX_REQUEST_BYTES", "MAX_THREAD_TURNS", "loadCommandSession"]) {
    assert.match(route, new RegExp(guard));
  }
  assert.match(route, /Retry-After/);
});

test("agent Markdown cannot issue automatic remote image requests", () => {
  const markdown = read("components/agent/markdown.tsx");
  assert.match(markdown, /img\(props\)/);
  assert.match(markdown, /skipHtml/);
  assert.match(markdown, /parsed\.protocol === "https:"/);
  assert.doesNotMatch(markdown, /<img/);
});

test("the source-controlled Atlas authoring layer includes operator workflows", () => {
  for (const file of [
    ".atlas/manifest.json",
    ".atlas/agent.md",
    ".atlas/guardrails.md",
    ".atlas/skills/ai-assignment/SKILL.md",
    ".atlas/skills/course-authoring/SKILL.md",
    ".atlas/skills/class-insight/SKILL.md",
    ".atlas/skills/gradebook/SKILL.md",
    ".atlas/skills/student-support/SKILL.md",
    ".atlas/skills/course-operations/SKILL.md",
  ]) {
    assert.equal(existsSync(path.join(root, file)), true, `${file} should exist`);
  }
  assert.match(read(".atlas/manifest.json"), /"gradebook"/);
  assert.match(read("next.config.mjs"), /\.\/\.atlas\/\*\*\/\*/);
});
