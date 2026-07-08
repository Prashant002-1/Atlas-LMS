import { test } from "node:test";
import assert from "node:assert/strict";
import {
  composeSideNoteText,
  evaluateSideNote,
  professorHandleFromName,
  type SideNoteEvaluationInput,
  type StudentTopicRecord,
} from "./side-notes";

/**
 * Side-note trigger tests, pure logic only. The rule under test: a card fires
 * exactly when the professor toggle is on, a sanctioned trigger keyword lands
 * in the student's turn, the student's own record is weak on that topic, and
 * the topic has not fired before. Every number in the card is a record fact.
 */

const mayaElasticity: StudentTopicRecord = {
  score: 4,
  max: 12,
  examLabel: "Midterm Exam 1",
  sourceRef: "record:exam-1-id:elasticity",
};

function baseInput(overrides: Partial<SideNoteEvaluationInput> = {}): SideNoteEvaluationInput {
  return {
    personalRecordSideNotes: true,
    triggers: [
      { topic: "elasticity", keywords: ["elasticity", "elastic", "slope", "price sensitivity"], sourcePageSlug: "elasticity-revenue-relation" },
    ],
    firedTopics: [],
    turnText: "I think the slope of the demand curve is really steep, so raising the price makes people quit.",
    topicRecords: { elasticity: mayaElasticity },
    professorHandle: "Prof. Osei",
    planningTitle: "Exam 2 Practice Set Planning",
    planningRef: "planning-session:plan-id",
    ...overrides,
  };
}

test("fires on the confused-with keyword for a weak topic", () => {
  const note = evaluateSideNote(baseInput());
  assert.ok(note, "expected a side note");
  assert.equal(note.topic, "elasticity");
  assert.equal(note.sourcePageSlug, "elasticity-revenue-relation");
  assert.deepEqual(note.sourceRefs, [
    "record:exam-1-id:elasticity",
    "planning-session:plan-id",
    "elasticity-revenue-relation",
  ]);
});

test("reproduces the canonical demo card from record facts", () => {
  const note = evaluateSideNote(baseInput());
  assert.ok(note);
  assert.ok(note.text.includes("Elasticity cost you 8 of 12 points on Midterm Exam 1"), note.text);
  assert.ok(note.text.includes("Prof. Osei's Exam 2 Practice Set Planning"), note.text);
  assert.ok(note.text.startsWith("FLAG - From your course record:"), note.text);
  assert.ok(note.text.includes("Worth slowing down here."), note.text);
});

test("professor toggle off means no card, ever", () => {
  assert.equal(evaluateSideNote(baseInput({ personalRecordSideNotes: false })), null);
});

test("a strong student never sees the card", () => {
  const strong: StudentTopicRecord = { ...mayaElasticity, score: 11 };
  assert.equal(evaluateSideNote(baseInput({ topicRecords: { elasticity: strong } })), null);
});

test("exactly at half the topic max does not fire", () => {
  const borderline: StudentTopicRecord = { ...mayaElasticity, score: 6 };
  assert.equal(evaluateSideNote(baseInput({ topicRecords: { elasticity: borderline } })), null);
});

test("a topic fires once per session", () => {
  assert.equal(evaluateSideNote(baseInput({ firedTopics: ["elasticity"] })), null);
});

test("no keyword in the turn means no card", () => {
  assert.equal(evaluateSideNote(baseInput({ turnText: "Let me think about customer segments first." })), null);
});

test("keywords match whole words, not fragments", () => {
  assert.equal(
    evaluateSideNote(baseInput({ turnText: "The plasticity of the material is irrelevant here.", triggers: [{ topic: "elasticity", keywords: ["elasticity"] }] })),
    null
  );
  const hit = evaluateSideNote(baseInput({ turnText: "Is elasticity the same as slope?" }));
  assert.ok(hit);
});

test("a topic with no record row stays silent", () => {
  assert.equal(evaluateSideNote(baseInput({ topicRecords: {} })), null);
});

test("at most one card per turn; the remaining topic stays armed", () => {
  const input = baseInput({
    triggers: [
      { topic: "elasticity", keywords: ["elasticity"] },
      { topic: "market_power", keywords: ["monopoly"] },
    ],
    turnText: "Elasticity and monopoly both matter here.",
    topicRecords: {
      elasticity: mayaElasticity,
      market_power: { score: 5, max: 24, examLabel: "Midterm Exam 1", sourceRef: "record:exam-1-id:market_power" },
    },
  });
  const first = evaluateSideNote(input);
  assert.ok(first);
  assert.equal(first.topic, "elasticity");

  const second = evaluateSideNote({ ...input, firedTopics: ["elasticity"] });
  assert.ok(second);
  assert.equal(second.topic, "market_power");
});

test("composition drops the planning clause when there is no planning provenance", () => {
  const text = composeSideNoteText({ topic: "elasticity", record: mayaElasticity, professorHandle: null, planningTitle: null });
  assert.ok(text.includes("Elasticity cost you 8 of 12 points on Midterm Exam 1."), text);
  assert.equal(text.includes("planning"), false);
});

test("professor handle derives from the display name", () => {
  assert.equal(professorHandleFromName("Dr. Amara Osei"), "Prof. Osei");
  assert.equal(professorHandleFromName("  "), null);
  assert.equal(professorHandleFromName(null), null);
});
