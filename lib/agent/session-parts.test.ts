import { test } from "node:test";
import assert from "node:assert/strict";
import {
  artifactUpdatesFromParts,
  parseRubricCriteria,
  parseSideNoteTriggers,
  pricingArtifactSchema,
  sideNotesFromParts,
} from "./session-parts";
import { v0DemoWorld } from "../db/fixtures/v0-demo-world";

/**
 * Session stream contract tests. The zod schemas ARE the wire format between
 * the runtime, the persisted rows, and the client renderers, so the seeded
 * demo world must parse through them cleanly: Phase 1 data and the Phase 2
 * engine share one contract.
 */

test("every seeded artifact state parses as a pricing artifact", () => {
  for (const state of v0DemoWorld.v0.artifactStates) {
    const parsed = pricingArtifactSchema.safeParse(state.state);
    assert.ok(parsed.success, `artifact ${state.id} failed: ${parsed.success ? "" : parsed.error.message}`);
  }
});

test("the seeded rubric parses through the criteria schema", () => {
  const criteria = parseRubricCriteria(v0DemoWorld.v0.rubric.criteria);
  assert.ok(criteria, "rubric criteria must parse");
  assert.equal(criteria.length, 4);
  assert.equal(
    criteria.reduce((sum, c) => sum + c.weight, 0),
    100
  );
});

test("the seeded session assignment carries sanctioned side-note triggers", () => {
  const triggers = parseSideNoteTriggers(v0DemoWorld.v0.sessionAssignment.sideNoteTriggers);
  assert.ok(triggers.length >= 1);
  const elasticity = triggers.find((t) => t.topic === "elasticity");
  assert.ok(elasticity, "the demo trigger is the elasticity topic");
  assert.ok(elasticity.keywords.includes("slope"), "the confused-with term arms the trigger");
  assert.equal(elasticity.sourcePageSlug, "elasticity-revenue-relation");
  assert.ok(v0DemoWorld.v0.sessionAssignment.planningSessionId, "provenance link to the planning session");
});

test("artifact updates extract from tool parts and reject junk", () => {
  const state = {
    tiers: [{ name: "Basic", price: 7.99, targetSegment: "Casual", fence: "Ads", rationale: "Entry." }],
    expectedRisk: "Low.",
  };
  const updates = artifactUpdatesFromParts([
    { type: "text", text: "hello" },
    { type: "tool-update_artifact", state: "output-available", input: { artifactType: "pricing_table", state } },
    { type: "tool-update_artifact", state: "input-streaming", input: { artifactType: "pricing_table", state } },
    { type: "tool-update_artifact", state: "output-available", input: { artifactType: "pricing_table", state: { nope: 1 } } },
  ]);
  assert.equal(updates.length, 1);
  assert.equal(updates[0].state.tiers[0].name, "Basic");
  assert.deepEqual(artifactUpdatesFromParts("not an array"), []);
});

test("side notes extract from data parts with validation", () => {
  const note = {
    id: "n1",
    topic: "elasticity",
    text: "FLAG - From your course record: something factual.",
    sourceRefs: ["record:x:elasticity"],
    sourcePageSlug: null,
    turnIndex: 5,
  };
  const notes = sideNotesFromParts([
    { type: "data-side-note", data: note },
    { type: "data-side-note", data: { id: "broken" } },
    { type: "text", text: "irrelevant" },
  ]);
  assert.equal(notes.length, 1);
  assert.equal(notes[0].topic, "elasticity");
});

test("pricing artifact schema enforces sane bounds", () => {
  assert.equal(pricingArtifactSchema.safeParse({ tiers: [], expectedRisk: "x" }).success, false);
  assert.equal(
    pricingArtifactSchema.safeParse({
      tiers: [{ name: "A", price: -1, targetSegment: "s", fence: "f", rationale: "r" }],
      expectedRisk: "x",
    }).success,
    false
  );
});
