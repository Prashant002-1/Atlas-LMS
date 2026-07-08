import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPracticeSetBlock, objectiveCodesForConcepts, practiceSetBlockData } from "./practice-proposal";
import { parseStoredBlock } from "./blocks";
import { v0DemoWorld } from "../db/fixtures/v0-demo-world";

/**
 * Practice-set proposal tests: the deterministic transform from the stored
 * class recommendation into a block that the EXISTING apply gate validates.
 * The invariant that matters: an approved draft can never fail to apply,
 * because the proposal payload round-trips parseStoredBlock before it is
 * ever inserted.
 */

const demoObjectives = v0DemoWorld.currentSchema.package.courses[0].objectives.map((objective) => ({
  code: objective.code,
  description: objective.description,
}));

test("the seeded class recommendation becomes a valid practice_set block", () => {
  const block = buildPracticeSetBlock(v0DemoWorld.v0.classRollup.recommendedPracticeSet, demoObjectives);
  assert.ok(block, "the seeded recommendation must transform cleanly");
  assert.equal(block.type, "practice_set");
  assert.equal(block.title, "Exam 2 Practice: Elasticity & Segmentation");
  assert.equal(block.questions.length, 3);
  assert.ok(block.questions.every((question) => question.kind === "multiple_choice"));
  assert.ok(block.questions.every((question) => question.rationaleMd.length >= 10));

  // Alignment derives from the course record: elasticity -> LO4, price discrimination -> LO6.
  assert.ok(block.objectiveCodes.includes("LO4"));
  assert.ok(block.objectiveCodes.includes("LO6"));
});

test("the proposal payload round-trips the apply gate's own validation", () => {
  const block = buildPracticeSetBlock(v0DemoWorld.v0.classRollup.recommendedPracticeSet, demoObjectives);
  assert.ok(block);
  const data = practiceSetBlockData(block);
  assert.equal("type" in data, false, "stored data carries no discriminator; the row's blockType does");
  const parsed = parseStoredBlock("practice_set", data);
  assert.ok(parsed && parsed.type === "practice_set", "applyProposal will parse exactly this payload");
  assert.equal(parsed.questions.length, block.questions.length);
});

test("questions without options become short answers; missing answers stay professor-editable", () => {
  const block = buildPracticeSetBlock(
    {
      title: "Recovery drill",
      base: "One scenario grounded in the course record for practice.",
      questions: [{ question: "Explain why elasticity varies along a linear demand curve.", concept: "elasticity" }],
    },
    demoObjectives
  );
  assert.ok(block);
  assert.equal(block.questions[0].kind, "short_answer");
  assert.equal(block.questions[0].options, undefined);
  assert.ok(block.questions[0].answer.length > 0);
});

test("malformed recommendations return null instead of a broken proposal", () => {
  assert.equal(buildPracticeSetBlock(null, demoObjectives), null);
  assert.equal(buildPracticeSetBlock({ title: "x" }, demoObjectives), null);
  assert.equal(
    buildPracticeSetBlock({ title: "ok title", base: "too-short?", questions: [] }, demoObjectives),
    null
  );
});

test("objective alignment matches concepts against the record, capped at six", () => {
  const codes = objectiveCodesForConcepts(["elasticity"], demoObjectives);
  assert.deepEqual(codes, ["LO4"]);
  const none = objectiveCodesForConcepts(["quantum entanglement"], demoObjectives);
  assert.deepEqual(none, []);
  const many = objectiveCodesForConcepts(
    ["topic"],
    Array.from({ length: 9 }, (_, index) => ({ code: `LO${index}`, description: "a topic description" }))
  );
  assert.equal(many.length, 6);
});
