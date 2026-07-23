import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeSessionTranscript, renderFinalArtifactBody, splitTextBySpans, turnPlainText, verifyQuote } from "./transcript";
import { v0DemoWorld } from "../db/fixtures/v0-demo-world";
import type { PricingArtifact } from "./session-parts";

/**
 * Transcript normalization tests. This is a wire format: evidence spans are
 * character offsets into each turn's `text`, so the extraction rules get
 * pinned here and the fixture world is re-verified through the SAME code the
 * live submit path uses.
 */

test("text extraction joins text parts and ignores tool and data parts", () => {
  const text = turnPlainText([
    { type: "text", text: "First thought." },
    { type: "tool-update_artifact", state: "output-available", input: { artifactType: "pricing_table" } },
    { type: "data-side-note", data: { topic: "elasticity" } },
    { type: "text", text: "Second thought." },
  ]);
  assert.equal(text, "First thought.\n\nSecond thought.");
});

test("normalization orders turns, carries ids, and counts them", () => {
  const normalized = normalizeSessionTranscript(
    [
      { id: "t2", turnIndex: 2, role: "user", parts: [{ type: "text", text: "second" }] },
      { id: "t1", turnIndex: 1, role: "assistant", parts: [{ type: "text", text: "first" }] },
    ],
    []
  );
  assert.deepEqual(
    normalized.turns.map((t) => t.id),
    ["t1", "t2"]
  );
  assert.equal(normalized.turnCount, 2);
  assert.equal(normalized.turns[0].text, "first");
});

test("final artifact is the last VALID artifact state", () => {
  const good: PricingArtifact = {
    tiers: [{ name: "Basic", price: 7.99, targetSegment: "Casual", fence: "Ads", rationale: "Entry price." }],
    expectedRisk: "Low.",
  };
  const normalized = normalizeSessionTranscript(
    [],
    [
      { id: "a1", turnIndex: 3, artifactType: "pricing_table", state: good },
      { id: "a2", turnIndex: 9, artifactType: "pricing_table", state: { junk: true } },
    ]
  );
  assert.ok(normalized.finalArtifact);
  assert.ok("tiers" in normalized.finalArtifact);
  assert.equal(normalized.finalArtifact.tiers[0].name, "Basic");
});

test("quote verification is exact string match with offsets", () => {
  const turn = { id: "t", turnIndex: 1, role: "user" as const, text: "We need fences. Ads on Basic.", parts: [] };
  const hit = verifyQuote(turn, "need fences");
  assert.ok(hit.verified);
  assert.equal(turn.text.slice(hit.charStart, hit.charEnd), "need fences");
  assert.equal(verifyQuote(turn, "need walls").verified, false);
  assert.equal(verifyQuote(turn, "").verified, false);
});

test("the seeded demo world round-trips through live normalization", () => {
  // Normalize maya's stored session through the live path, then check every
  // seeded evidence quote for that session still verifies by string match.
  const featured = v0DemoWorld.v0.studentProfiles.find((p) => p.featured) ?? v0DemoWorld.v0.studentProfiles[0];
  const session = v0DemoWorld.v0.studentSessions.find((s) => s.userId === featured.userId);
  assert.ok(session, "featured student needs a seeded session");

  const turnRows = v0DemoWorld.v0.turns
    .filter((t) => t.sessionId === session.id)
    .map((t) => ({ id: t.id, turnIndex: t.turnIndex, role: t.role, parts: t.parts }));
  const artifactRows = v0DemoWorld.v0.artifactStates
    .filter((s) => s.sessionId === session.id)
    .map((s) => ({ id: s.id, turnIndex: s.turnIndex, artifactType: s.artifactType, state: s.state }));

  const normalized = normalizeSessionTranscript(turnRows, artifactRows);
  assert.equal(normalized.turnCount, turnRows.length);
  assert.ok(normalized.finalArtifact, "featured session must end with a valid artifact");

  const spans = v0DemoWorld.v0.evidenceSpans.filter((span) => span.sessionId === session.id);
  assert.ok(spans.length >= 4, "featured session should carry one span per criterion");
  for (const span of spans) {
    const turn = normalized.turns.find((t) => t.id === span.turnId);
    assert.ok(turn, `span ${span.id} references turn ${span.turnId}`);
    const check = verifyQuote(turn, span.quote);
    assert.ok(check.verified, `quote must verify verbatim: "${span.quote}"`);
  }
});

test("submission body renders the frozen artifact deterministically", () => {
  const artifact: PricingArtifact = {
    tiers: [
      { name: "Basic (Ads)", price: 7.99, targetSegment: "Casual users", fence: "Ads, 1 screen", rationale: "Entry." },
      { name: "Premium", price: 19.99, targetSegment: "Heavy users", fence: "4K, offline downloads", rationale: "Top end." },
    ],
    expectedRisk: "Minimal cannibalization.",
  };
  const body = renderFinalArtifactBody(artifact, "Maya Patel");
  assert.ok(body.startsWith("Pricing Strategy Session final submission by Maya Patel."));
  assert.ok(body.includes("- Basic (Ads): $7.99 (Ads, 1 screen)"));
  assert.ok(body.includes("Expected risk: Minimal cannibalization."));

  const empty = renderFinalArtifactBody(null, "Maya Patel");
  assert.ok(empty.includes("without a submission draft"));
});

test("span splitting reassembles the exact text with the right coverage", () => {
  const text = "The slope is constant but elasticity changes along the curve.";
  const segments = splitTextBySpans(text, [
    { id: "s1", criterionKey: "grounding", charStart: 4, charEnd: 21 }, // "slope is constant"
    { id: "s2", criterionKey: "framing", charStart: 26, charEnd: 36 }, // "elasticity"
  ]);
  assert.equal(segments.map((segment) => segment.text).join(""), text, "segments always reassemble the input");
  const marked = segments.filter((segment) => segment.spans.length > 0);
  assert.equal(marked.length, 2);
  assert.equal(marked[0].text, "slope is constant");
  assert.equal(marked[1].text, "elasticity");
});

test("overlapping spans stack instead of corrupting boundaries", () => {
  const text = "abcdefghij";
  const segments = splitTextBySpans(text, [
    { id: "s1", criterionKey: "a", charStart: 0, charEnd: 6 },
    { id: "s2", criterionKey: "b", charStart: 4, charEnd: 10 },
  ]);
  assert.equal(segments.map((segment) => segment.text).join(""), text);
  const overlap = segments.find((segment) => segment.spans.length === 2);
  assert.ok(overlap);
  assert.equal(overlap.text, "ef");
});

test("out-of-range spans clamp and empty text yields no segments", () => {
  const segments = splitTextBySpans("short", [{ id: "s", criterionKey: "k", charStart: 2, charEnd: 99 }]);
  assert.equal(segments.map((segment) => segment.text).join(""), "short");
  assert.equal(segments.find((segment) => segment.spans.length > 0)?.text, "ort");
  assert.deepEqual(splitTextBySpans("", [{ id: "s", criterionKey: "k", charStart: 0, charEnd: 3 }]), []);
});
