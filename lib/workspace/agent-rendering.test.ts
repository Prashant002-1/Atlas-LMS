import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative: string) => readFileSync(path.join(root, relative), "utf8");

test("all Atlas chat rooms use the exhaustive shared message renderer", () => {
  for (const roomPath of [
    "components/planning/atlas-room.tsx",
    "components/student/atlas-room.tsx",
    "components/session/session-room.tsx",
  ]) {
    const room = read(roomPath);
    assert.match(room, /AtlasMessageParts/);
    assert.doesNotMatch(room, /rendered\.push\(<Response/);
  }

  const renderer = read("components/agent/message-parts.tsx");
  for (const partType of [
    "reasoning",
    "source-url",
    "source-document",
    "reasoning-file",
    "dynamic-tool",
    "step-start",
    "data-terminal",
    "data-artifact",
  ]) {
    assert.match(renderer, new RegExp(partType));
  }
  assert.match(renderer, /Unsupported output/);
  assert.match(renderer, /approval-requested/);
});

test("reasoning and tool payloads are not chat inspection surfaces", () => {
  const renderer = read("components/agent/message-parts.tsx");
  const reasoning = read("components/ai-elements/reasoning.tsx");

  assert.match(renderer, /ThinkingIndicator/);
  assert.match(renderer, /Approval is needed to continue/);
  assert.doesNotMatch(renderer, /<Tool(Input|Output|Content|Header)?\b/);
  assert.doesNotMatch(renderer, /displayJson|fencedCode|ToolValue/);
  assert.doesNotMatch(renderer, /<details|<summary/);
  assert.doesNotMatch(reasoning, /Markdown|BrainIcon|ChevronDownIcon|aria-expanded|<section|<button/);
  assert.match(reasoning, /ThinkingIndicator label="Thinking"/);

  for (const runtimePath of [
    "lib/agent/professor-runtime.ts",
    "lib/agent/student-atlas-runtime.ts",
    "lib/agent/session-runtime.ts",
  ]) {
    assert.match(read(runtimePath), /sendReasoning: false/);
  }

  for (const roomPath of [
    "components/planning/atlas-room.tsx",
    "components/student/atlas-room.tsx",
  ]) {
    const room = read(roomPath);
    assert.doesNotMatch(room, /input\.(resource|query|studentQuery|assignmentId|action)/);
  }
});

test("Markdown uses streaming-safe rich rendering and restrained remote media", () => {
  const markdown = read("components/agent/markdown.tsx");
  const css = read("app/globals.css");
  assert.match(markdown, /Streamdown/);
  assert.match(markdown, /mermaid: lazyMermaid/);
  assert.match(markdown, /await import\("@streamdown\/mermaid"\)/);
  assert.match(markdown, /img\(props\)/);
  assert.match(markdown, /securityLevel: "strict"/);
  assert.match(css, /data-streamdown="table-wrapper"/);
  assert.match(css, /width: max-content/);
  assert.match(css, /data-streamdown="code-block-body"/);
});

test("chat history exposes stable titles and row-level archive controls", () => {
  const row = read("components/agent/chat-thread-row.tsx");
  const actions = read("lib/agent/chat-actions.ts");
  const professor = read("components/planning/atlas-room.tsx");
  const student = read("components/student/atlas-room.tsx");
  assert.match(row, /ResizeObserver/);
  assert.match(row, /atlas-thread-title/);
  assert.match(row, /ArchiveIcon/);
  assert.match(actions, /archiveProfessorAtlasChatFromList/);
  assert.match(actions, /archiveStudentAtlasChatFromList/);
  assert.match(professor, /archiveProfessorAtlasChatFromList/);
  assert.match(student, /archiveStudentAtlasChatFromList/);
});

test("client render contracts do not pull database drivers into the browser bundle", () => {
  const blocks = read("lib/agent/blocks.ts");
  const contracts = read("lib/agent/course-agent-contracts.ts");
  assert.match(blocks, /course-agent-contracts/);
  assert.doesNotMatch(blocks, /course-agent-config|course-agent-directives/);
  assert.doesNotMatch(contracts, /@\/lib\/db|drizzle-orm|course-agent-schema/);
});
