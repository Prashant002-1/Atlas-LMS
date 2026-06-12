import { test } from "node:test";
import assert from "node:assert/strict";
import { planRecallIndices, partsToText, makeSnippet, isContextNeighbor } from "./recall-window";

test("planRecallIndices: window + bookends, deduped and sorted, clamped to bounds", () => {
  // session turns 1..20, one hit at 10, window 2, bookends 3
  const out = planRecallIndices([10], 1, 20, { window: 2, bookends: 3 });
  assert.deepEqual(out, [1, 2, 3, 8, 9, 10, 11, 12, 18, 19, 20]);
});

test("planRecallIndices: overlapping windows merge without duplicates", () => {
  const out = planRecallIndices([5, 6], 1, 10, { window: 1, bookends: 0 });
  assert.deepEqual(out, [4, 5, 6, 7]);
});

test("planRecallIndices: hits near edges clamp, never go below lo or above hi", () => {
  const out = planRecallIndices([1, 10], 1, 10, { window: 3, bookends: 0 });
  assert.equal(out[0], 1);
  assert.equal(out[out.length - 1], 10);
  assert.ok(out.every((i) => i >= 1 && i <= 10));
});

test("planRecallIndices: no matches still yields bookends", () => {
  const out = planRecallIndices([], 1, 100, { window: 5, bookends: 2 });
  assert.deepEqual(out, [1, 2, 99, 100]);
});

test("planRecallIndices: empty / inverted bounds yields nothing", () => {
  assert.deepEqual(planRecallIndices([5], 5, 1, { window: 5, bookends: 3 }), []);
});

test("planRecallIndices: bookends larger than session collapse to the whole range", () => {
  const out = planRecallIndices([], 1, 3, { window: 0, bookends: 10 });
  assert.deepEqual(out, [1, 2, 3]);
});

test("isContextNeighbor: within window vs outside", () => {
  assert.equal(isContextNeighbor(8, [10], 2), true);
  assert.equal(isContextNeighbor(7, [10], 2), false);
});

test("partsToText: extracts text parts and compacts tool parts", () => {
  const parts = [
    { type: "text", text: "Bump the midterm to week 8." },
    { type: "tool-proposeAssignment", input: { name: "Midterm", week: 8 } },
    { type: "step-start" },
  ];
  const out = partsToText(parts);
  assert.match(out, /Bump the midterm to week 8\./);
  assert.match(out, /\[proposeAssignment /);
  assert.doesNotMatch(out, /step-start/);
});

test("partsToText: passes through plain strings", () => {
  assert.equal(partsToText("hello"), "hello");
  assert.equal(partsToText(null), "");
});

test("makeSnippet: centers on the matched term with ellipses", () => {
  const text = "x".repeat(400) + " RUBRIC criteria " + "y".repeat(400);
  const snip = makeSnippet(text, "rubric", 20);
  assert.match(snip, /RUBRIC/);
  assert.ok(snip.startsWith("…") && snip.endsWith("…"));
  assert.ok(snip.length < text.length);
});
