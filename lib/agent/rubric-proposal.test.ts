import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildSessionRubricBlock,
  diffRubrics,
  normalizeRubricDraft,
  sessionRubricBlockData,
  starterRubricCriteria,
  type NormalizedRubricDraft,
} from "@/lib/agent/rubric-proposal";
import { parseStoredBlock } from "@/lib/agent/blocks";
import type { RubricCriterion } from "@/lib/agent/session-parts";

/**
 * The rubric draft contract: what the planning conversation may hand to the
 * Review gate. Deterministic point derivation, hard invariants (weights sum
 * to 100, Exceeds = weight, Missing = 0, points strictly descend), and a
 * round-trip through the apply gate's own block schema.
 */

const levels = (over?: Partial<Record<string, number>>) =>
  (["Exceeds", "Meets", "Developing", "Missing"] as const).map((level) => ({
    level,
    descriptor: `Observable ${level} move in the transcript.`,
    ...(over && over[level] !== undefined ? { score: over[level] } : {}),
  }));

const criterion = (name: string, weight: number, over?: Partial<Record<string, number>>) => ({
  name,
  description: `Watches ${name.toLowerCase()} across the whole session.`,
  weight,
  levels: levels(over),
});

function expectRejected(result: NormalizedRubricDraft): string {
  if (result.ok) throw new Error("expected the draft to be rejected");
  return result.error;
}

test("points derive from the weight by the fixed ladder", () => {
  const result = normalizeRubricDraft({ criteria: [criterion("Framing", 20), criterion("Grounding", 80)] });
  assert.ok(result.ok);
  const framing = result.criteria[0];
  assert.equal(framing.key, "framing");
  assert.deepEqual(
    framing.levels.map((level) => level.score),
    [20, 16, 10, 0]
  );
  const grounding = result.criteria[1];
  assert.deepEqual(
    grounding.levels.map((level) => level.score),
    [80, 64, 40, 0]
  );
});

test("weights must sum to exactly 100", () => {
  const result = normalizeRubricDraft({ criteria: [criterion("A", 30), criterion("B", 30)] });
  assert.match(expectRejected(result), /sum to exactly 100/);
});

test("all four levels are required, once each", () => {
  const missing = {
    criteria: [
      { ...criterion("A", 50), levels: levels().slice(0, 3).concat(levels().slice(0, 1)) },
      criterion("B", 50),
    ],
  };
  const result = normalizeRubricDraft(missing);
  assert.match(expectRejected(result), /Missing level|repeats a level/);
});

test("explicit points are honored but held to the invariants", () => {
  const good = normalizeRubricDraft({
    criteria: [criterion("A", 60, { Exceeds: 60, Meets: 45, Developing: 20, Missing: 0 }), criterion("B", 40)],
  });
  assert.ok(good.ok);
  assert.deepEqual(
    good.criteria[0].levels.map((level) => level.score),
    [60, 45, 20, 0]
  );

  const wrongTop = normalizeRubricDraft({
    criteria: [criterion("A", 60, { Exceeds: 55 }), criterion("B", 40)],
  });
  assert.match(expectRejected(wrongTop), /full weight/);

  const paidMissing = normalizeRubricDraft({
    criteria: [criterion("A", 60, { Missing: 5 }), criterion("B", 40)],
  });
  assert.match(expectRejected(paidMissing), /Missing must be worth 0/);

  const flat = normalizeRubricDraft({
    criteria: [criterion("A", 60, { Meets: 60 }), criterion("B", 40)],
  });
  assert.match(expectRejected(flat), /strictly descend/);
});

test("keys derive from names and never collide", () => {
  const result = normalizeRubricDraft({
    criteria: [criterion("Final Design & Defense", 50), criterion("Final design defense", 50)],
  });
  assert.ok(result.ok);
  assert.equal(result.criteria[0].key, "final_design_defense");
  assert.notEqual(result.criteria[0].key, result.criteria[1].key);
});

test("a normalized draft round-trips the apply gate's block schema", () => {
  const normalized = normalizeRubricDraft({ criteria: [criterion("Framing", 40), criterion("Iteration", 60)] });
  assert.ok(normalized.ok);
  const block = buildSessionRubricBlock({
    assignmentId: "2f3e4d5c-6b7a-4c8d-9e0f-102132435465",
    title: "Session rubric, revised",
    criteria: normalized.criteria,
  });
  assert.ok(block);
  const stored = parseStoredBlock("session_rubric", sessionRubricBlockData(block));
  assert.ok(stored && stored.type === "session_rubric");
  assert.equal(stored.criteria.length, 2);
  assert.equal(stored.criteria[1].levels[0].score, 60);
});

test("the diff names what changed, what arrived, and what fell away", () => {
  const current: RubricCriterion[] = [
    {
      key: "framing",
      weight: 20,
      name: "Problem Framing",
      description: "Interrogates the scenario first.",
      levels: [
        { level: "Exceeds", score: 20, descriptor: "Asks deep questions before proposing." },
        { level: "Meets", score: 16, descriptor: "Identifies the core issues." },
        { level: "Developing", score: 10, descriptor: "Assumes without exploring." },
        { level: "Missing", score: 0, descriptor: "No framing shown." },
      ],
    },
    {
      key: "defense",
      weight: 80,
      name: "Final Defense",
      description: "Coherent final structure.",
      levels: [
        { level: "Exceeds", score: 80, descriptor: "Robust justification." },
        { level: "Meets", score: 64, descriptor: "Basic justification." },
        { level: "Developing", score: 40, descriptor: "Weak defense." },
        { level: "Missing", score: 0, descriptor: "No defense." },
      ],
    },
  ];

  const proposedDraft = normalizeRubricDraft({
    criteria: [
      {
        ...criterion("Problem Framing", 30),
        key: "framing",
        levels: levels().map((level) =>
          level.level === "Meets" ? { ...level, descriptor: "Names segments and willingness to pay." } : level
        ),
      },
      criterion("Iteration under Challenge", 70),
    ],
  });
  assert.ok(proposedDraft.ok);

  const diff = diffRubrics(current, proposedDraft.criteria);
  const framing = diff.criteria.find((c) => c.key === "framing");
  assert.ok(framing);
  assert.equal(framing.state, "changed");
  assert.equal(framing.weightFrom, 20);
  assert.equal(framing.weightTo, 30);
  assert.equal(framing.revisedLevels.length, 4); // every canned descriptor differs from the stored one
  const iteration = diff.criteria.find((c) => c.name === "Iteration under Challenge");
  assert.ok(iteration);
  assert.equal(iteration.state, "new");
  assert.deepEqual(
    diff.removed.map((r) => r.key),
    ["defense"]
  );
  assert.equal(diff.weightMoved, true);
});

test("the starter frame carries the grading invariants", () => {
  const criteria = starterRubricCriteria();
  assert.equal(criteria.length, 4);
  assert.equal(
    criteria.reduce((sum, criterion) => sum + criterion.weight, 0),
    100
  );
  for (const criterion of criteria) {
    assert.equal(criterion.levels[0].score, criterion.weight);
    assert.equal(criterion.levels[3].score, 0);
  }
});

test("a fresh rubric against nothing reads all-new", () => {
  const normalized = normalizeRubricDraft({ criteria: [criterion("A", 50), criterion("B", 50)] });
  assert.ok(normalized.ok);
  const diff = diffRubrics(null, normalized.criteria);
  assert.ok(diff.criteria.every((c) => c.state === "new"));
  assert.equal(diff.removed.length, 0);
});
