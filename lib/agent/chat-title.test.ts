import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ATLAS_CHAT_TITLE_LIMIT,
  atlasChatTitleFromIntent,
  displayAtlasChatTitle,
  firstUserTextFromParts,
  isDefaultAtlasChatTitle,
} from "./chat-title";

test("chat titles are derived from the first message without raw whitespace", () => {
  assert.equal(atlasChatTitleFromIntent("  Review\n\nmy   rubric  "), "Review my rubric");
  assert.equal(atlasChatTitleFromIntent("", "New chat"), "New chat");
  assert.equal(firstUserTextFromParts([{ type: "file", url: "/a" }, { type: "text", text: "First prompt" }]), "First prompt");
});

test("long chat titles remain bounded and Unicode safe", () => {
  const title = atlasChatTitleFromIntent(`😀${"a".repeat(ATLAS_CHAT_TITLE_LIMIT + 20)}`);
  assert.equal(Array.from(title).length, ATLAS_CHAT_TITLE_LIMIT);
  assert.equal(title.endsWith("…"), true);
  assert.equal(title.startsWith("😀"), true);
});

test("legacy placeholder titles are recognized", () => {
  for (const title of [null, "", "Atlas chat", "Atlas thread", "Course command session"]) {
    assert.equal(isDefaultAtlasChatTitle(title), true);
  }
  assert.equal(isDefaultAtlasChatTitle("Review my rubric"), false);
});

test("the first user message repairs a legacy truncated stored title", () => {
  assert.equal(
    displayAtlasChatTitle("Create a new AI assignment based on this week's module and the class results", "Create a new AI assignment based on this week's module and th..."),
    "Create a new AI assignment based on this week's module and the class results"
  );
  assert.equal(displayAtlasChatTitle(null, "Exam 2 Practice Set Planning"), "Exam 2 Practice Set Planning");
});
