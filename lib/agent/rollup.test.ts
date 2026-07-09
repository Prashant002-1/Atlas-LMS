import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRollupNarrative, computeClassRollupStats } from "./rollup";
import { v0DemoWorld } from "../db/fixtures/v0-demo-world";

/**
 * Class rollup tests: deterministic aggregation over stored-shaped rows, and
 * a narrative that only ever repeats the computed numbers. The seeded demo
 * world runs through the same function the seed and the live pipeline use.
 */

const grade = (level: "Exceeds" | "Meets" | "Developing" | "Missing", score: number) => ({
  level,
  score,
  rationale: "r",
  evidenceSpans: [],
});

test("stats aggregate counts, average, median, topics, and review requests", () => {
  const stats = computeClassRollupStats({
    reports: [
      { scores: { framing: grade("Exceeds", 20), grounding: grade("Meets", 20) }, overallScore: 90, reviewRequestedAt: null },
      { scores: { framing: grade("Developing", 10), grounding: grade("Missing", 0) }, overallScore: 40, reviewRequestedAt: new Date() },
      { scores: { framing: grade("Meets", 16), grounding: grade("Developing", 12) }, overallScore: 62, reviewRequestedAt: null },
    ],
    submittedSessions: 5,
    sideNotes: [
      { sessionId: "s1", topic: "elasticity" },
      { sessionId: "s2", topic: "elasticity" },
      { sessionId: "s2", topic: "elasticity" }, // same session twice counts once
      { sessionId: "s3", topic: "market_power" },
    ],
  });

  assert.equal(stats.submittedSessions, 5);
  assert.equal(stats.gradedSessions, 3);
  assert.equal(stats.criterionCounts.framing.Exceeds, 1);
  assert.equal(stats.criterionCounts.framing.Meets, 1);
  assert.equal(stats.criterionCounts.framing.Developing, 1);
  assert.equal(stats.criterionCounts.grounding.Missing, 1);
  assert.equal(stats.overallAverage, 64);
  assert.equal(stats.overallMedian, 62);
  assert.equal(stats.sideNoteTopicCounts.elasticity, 2);
  assert.equal(stats.sideNoteTopicCounts.market_power, 1);
  assert.equal(stats.reviewRequestedCount, 1);
});

test("empty input produces zeroed stats, not NaN", () => {
  const stats = computeClassRollupStats({ reports: [], submittedSessions: 0, sideNotes: [] });
  assert.equal(stats.gradedSessions, 0);
  assert.equal(stats.overallAverage, 0);
  assert.equal(stats.overallMedian, 0);
  assert.deepEqual(stats.criterionCounts, {});
});

test("the narrative only repeats computed numbers", () => {
  const stats = computeClassRollupStats({
    reports: [
      { scores: { grounding: grade("Developing", 12) }, overallScore: 49, reviewRequestedAt: null },
      { scores: { grounding: grade("Meets", 20) }, overallScore: 80, reviewRequestedAt: null },
    ],
    submittedSessions: 3,
    sideNotes: [{ sessionId: "s1", topic: "elasticity" }],
  });
  const narrative = buildRollupNarrative(stats);
  assert.ok(narrative.includes("2 of 3 submitted sessions are graded"));
  assert.ok(narrative.includes("average 64.5"));
  assert.ok(narrative.includes("grounding is the weakest criterion: 1 of 2"));
  assert.ok(narrative.includes("elasticity side note fired in 1 session"));
  assert.equal(narrative.includes("\u2014"), false, "no em dashes in professor-facing text");
});

test("the seeded demo world aggregates deterministically through the same code", () => {
  // The same subset the seed stores: reports for students whose gradebook
  // shows a submitted or graded session (28 of 31; 3 are missing).
  const submittedStates = new Map<string, string>();
  for (const sub of v0DemoWorld.currentSchema.package.courses[0].submissions) {
    if (sub.assignmentKey === "session-assignment" && sub.state !== "missing") {
      submittedStates.set(sub.studentKey, sub.state);
    }
  }
  const profileByUserId = new Map(v0DemoWorld.v0.studentProfiles.map((p) => [p.userId, p]));
  const seededReports = v0DemoWorld.v0.journeyReports.filter((report) => {
    const profile = profileByUserId.get(report.userId);
    return profile ? submittedStates.has(profile.key) : false;
  });
  assert.equal(seededReports.length, 28);

  const stats = computeClassRollupStats({
    reports: seededReports.map((r) => ({ scores: r.scores, overallScore: r.overallScore, reviewRequestedAt: null })),
    submittedSessions: 28,
    sideNotes: v0DemoWorld.v0.sideNoteCards.map((card) => ({ sessionId: card.sessionId, topic: card.topic })),
  });

  assert.equal(stats.gradedSessions, 28);
  const levelSum = Object.values(stats.criterionCounts.iteration).reduce((sum, v) => sum + v, 0);
  assert.equal(levelSum, 28, "every graded report counts exactly once per criterion");
  assert.ok(stats.overallAverage > 0);
  assert.equal(stats.sideNoteTopicCounts.elasticity, 1, "the canonical side note fired in the featured session");

  // Determinism: same rows in, same stats out.
  const again = computeClassRollupStats({
    reports: seededReports.map((r) => ({ scores: r.scores, overallScore: r.overallScore, reviewRequestedAt: null })),
    submittedSessions: 28,
    sideNotes: v0DemoWorld.v0.sideNoteCards.map((card) => ({ sessionId: card.sessionId, topic: card.topic })),
  });
  assert.deepEqual(again, stats);
});
