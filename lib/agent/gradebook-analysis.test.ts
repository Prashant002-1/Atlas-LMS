import test from "node:test";
import assert from "node:assert/strict";
import { summarizeGradeDistribution } from "@/lib/agent/gradebook-analysis";

test("summarizeGradeDistribution computes course bands and descriptive statistics", () => {
  assert.deepEqual(summarizeGradeDistribution([96, 91, 88, 82, 76, 64, 55, null, undefined]), {
    count: 7,
    average: 78.9,
    median: 82,
    minimum: 55,
    maximum: 96,
    bands: { A: 2, B: 2, C: 1, D: 1, F: 1 },
  });
});

test("summarizeGradeDistribution excludes ungraded values", () => {
  assert.deepEqual(summarizeGradeDistribution([null, undefined, Number.NaN]), {
    count: 0,
    average: null,
    median: null,
    minimum: null,
    maximum: null,
    bands: { A: 0, B: 0, C: 0, D: 0, F: 0 },
  });
});

test("summarizeGradeDistribution uses the mean of two middle values", () => {
  assert.equal(summarizeGradeDistribution([60, 70, 80, 90]).median, 75);
});
