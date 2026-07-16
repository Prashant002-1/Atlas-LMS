import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative: string) => readFileSync(path.join(root, relative), "utf8");

test("the Atlas page is a full viewport harness with an optional rail", () => {
  const room = read("components/planning/planning-room.tsx");
  assert.match(room, /atlas-harness-root/);
  assert.match(room, /html:has\(\.atlas-harness-root\)/);
  assert.match(room, /Threads/);
  assert.match(room, /Drafts/);
  assert.match(room, /PanelRightOpen/);
  assert.match(room, /Voice input coming soon/);
  assert.match(room, /Run trace/);
  assert.match(room, /ToolInput/);
  assert.match(room, /PromptInputSubmit/);
  assert.doesNotMatch(room, /Drafts land in Review/);
  assert.doesNotMatch(room, /Nothing goes live/);
  assert.doesNotMatch(room, /Applied to the course/);
  assert.doesNotMatch(room, /course record/i);
  assert.doesNotMatch(read("lib/agent/side-notes.ts"), /course record/i);
  assert.doesNotMatch(read("components/cockpit/contract-rubric.tsx"), /course record/i);
});

test("the professor runtime is fresh, durable, and traceable", () => {
  const runtime = read("lib/agent/professor-runtime.ts");
  assert.match(runtime, /persistSessionTurn\(session, "user"/);
  assert.match(runtime, /buildProfessorPack\(scope\)/);
  assert.match(runtime, /loadAtlasHarness\(\)/);
  assert.match(runtime, /data-run-context/);
  assert.match(runtime, /buildProfessorReference/);
  assert.match(runtime, /\.\.\.priorMessages, referenceMessage, currentMessage/);
  assert.match(runtime, /persistSessionTurn\(session, "assistant"/);
  assert.match(runtime, /compactIfNeeded/);
});

test("the tool surface is domain bounded", () => {
  const tools = read("lib/agent/professor-tools.ts");
  for (const name of ["inspect_course", "load_skill", "draft_ai_assignment", "draft_rubric", "draft_course"]) {
    assert.match(tools, new RegExp(`const ${name} = tool`));
  }
  for (const forbidden of ["shell", "bash", "execute_code", "web_search", "http_request"]) {
    assert.doesNotMatch(tools, new RegExp(`const ${forbidden} = tool`));
  }
  assert.equal(tools.includes("applyProposal"), false);
  assert.equal(tools.includes(".update("), false);
  assert.match(tools, /eq\(assignments\.orgId, scope\.orgId\)/);
  assert.match(tools, /eq\(changeProposals\.courseId, scope\.courseId\)/);
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

test("the source-controlled Atlas authoring layer is bundled", () => {
  for (const file of [
    ".atlas/manifest.json",
    ".atlas/agent.md",
    ".atlas/guardrails.md",
    ".atlas/skills/ai-assignment/SKILL.md",
    ".atlas/skills/course-authoring/SKILL.md",
    ".atlas/skills/class-insight/SKILL.md",
  ]) {
    assert.equal(existsSync(path.join(root, file)), true, `${file} should exist`);
  }
  assert.match(read("next.config.mjs"), /\.\/\.atlas\/\*\*\/\*/);
});
