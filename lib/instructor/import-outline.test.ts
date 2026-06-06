import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hasImportRows,
  importSummary,
  normalizeImportDiff,
  parseCourseImportIntent,
  withReferencedObjectives,
} from "./import-outline";

test("parses an imported course outline into aligned records", () => {
  const parsed = parseCourseImportIntent(
    [
      "LO1: Summarize distributions with descriptive statistics.",
      "Week 1: Data, variables, and descriptive statistics - Students classify variables LO1",
      "Week 2: Sampling and statistical uncertainty LO2",
      "Assignment: Problem Set 1 - Compute descriptive statistics LO1",
      "Work: Inference checkpoint - State hypotheses and uncertainty caveats LO2 LO4",
      "Project: Regression memo LO3",
    ].join("\n"),
    "STAT-201"
  );

  assert.equal(parsed.courseCode, "STAT-201");
  assert.deepEqual(parsed.modules.map((item) => item.name), [
    "Data, variables, and descriptive statistics",
    "Sampling and statistical uncertainty",
  ]);
  assert.equal(parsed.modules[0]?.summaryMd, "Students classify variables");
  assert.deepEqual(parsed.assignments.map((item) => item.name), ["Problem Set 1", "Inference checkpoint", "Regression memo"]);
  assert.equal(parsed.assignments[0]?.descriptionMd, "Compute descriptive statistics");
  assert.deepEqual(parsed.assignments[1]?.objectiveCodes, ["LO2", "LO4"]);
  assert.deepEqual(parsed.objectives.map((item) => item.code).sort(), ["LO1", "LO2", "LO3", "LO4"]);
  assert.deepEqual(parsed.objectives.map((item) => Math.round(item.assessmentWeight * 100)).sort(), [25, 25, 25, 25]);
});

test("normalizes structured import diffs and fills referenced objectives", () => {
  const normalized = withReferencedObjectives(
    normalizeImportDiff(
      {
        title: "Course outline",
        modules: [{ name: "Regression", summaryMd: "Model relationships.", objectiveCodes: ["lo3"] }],
        assignments: [{ name: "Memo", descriptionMd: "Explain uncertainty.", objectiveCodes: ["LO4"], pointsPossible: 50 }],
        objectives: [{ code: "LO3", description: "Model relationships." }],
      },
      ""
    )
  );

  assert.deepEqual(normalized.modules[0]?.objectiveCodes, ["LO3"]);
  assert.deepEqual(normalized.assignments[0]?.objectiveCodes, ["LO4"]);
  assert.deepEqual(normalized.objectives.map((item) => item.code).sort(), ["LO3", "LO4"]);
  assert.deepEqual(normalized.objectives.map((item) => item.assessmentWeight), [0.5, 0.5]);
  assert.equal(hasImportRows(normalized), true);
  assert.equal(importSummary(normalized), "Draft 1 week, 1 assignment, and 2 objectives.");
});
