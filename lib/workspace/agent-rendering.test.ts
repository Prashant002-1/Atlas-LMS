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
