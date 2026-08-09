import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAnsi } from "../../components/ai-elements/terminal";

test("terminal output parses common ANSI SGR without preserving escape bytes", () => {
  const segments = parseAnsi("plain \u001b[31merror\u001b[0m done");
  assert.equal(segments.map((segment) => segment.text).join(""), "plain error done");
  assert.equal(segments.find((segment) => segment.text === "error")?.foreground, "red");
  assert.equal(segments.at(-1)?.foreground, undefined);
});

test("terminal output preserves bold, underline, bright colors, and resets", () => {
  const segments = parseAnsi("\u001b[1;4;96mnotice\u001b[22;24;39m normal");
  assert.deepEqual(segments[0], { text: "notice", bold: true, underline: true, foreground: "brightCyan" });
  assert.deepEqual(segments[1], { text: " normal" });
});
