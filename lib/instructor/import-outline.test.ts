import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hasImportRows,
  importSummary,
  inferCourseCommandImport,
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

test("infers reviewable rows from a natural Atlas command", () => {
  const inferred = inferCourseCommandImport("Create a short practice sequence from the clinic wait sample.", "STAT-201", {
    code: "LO2",
    title: "Apply hypothesis testing to a sample",
    description: "Apply hypothesis testing to a sample.",
  });

  assert.equal(hasImportRows(inferred), true);
  assert.deepEqual(inferred.modules.map((item) => item.name), ["Clinic wait practice"]);
  assert.deepEqual(inferred.assignments.map((item) => item.name), ["Clinic wait practice check"]);
  assert.deepEqual(inferred.modules[0]?.objectiveCodes, ["LO2"]);
  assert.deepEqual(inferred.assignments[0]?.objectiveCodes, ["LO2"]);
  assert.equal(inferred.modules[0]?.source, "sample_practice");
  assert.match(inferred.modules[0]?.summaryMd ?? "", /Base: Clinic wait sample/);
  assert.match(inferred.modules[0]?.summaryMd ?? "", /Shifts:/);
  assert.match(inferred.modules[0]?.summaryMd ?? "", /Concepts:/);
  assert.match(inferred.assignments[0]?.descriptionMd ?? "", /use Clinic wait sample/);
  assert.match(inferred.assignments[0]?.descriptionMd ?? "", /Read the linked material/);
  assert.deepEqual(inferred.objectives.map((item) => item.code), ["LO2"]);
});

test("keeps professor-provided practice bases and shifts in course records", () => {
  const inferred = inferCourseCommandImport(
    "Create practice for next week. Base: clinic wait times by shift. Shifts: state hypotheses; check assumptions; explain the result for a non-technical reader.",
    "STAT-201",
    {
      code: "LO4",
      title: "Explain inference results",
      description: "Explain inference results for applied decisions.",
    }
  );

  assert.equal(hasImportRows(inferred), true);
  assert.match(inferred.modules[0]?.summaryMd ?? "", /Base: Clinic wait times by shift/);
  assert.match(inferred.modules[0]?.summaryMd ?? "", /Shifts: state hypotheses; check assumptions; explain the result for a non-technical reader/);
  assert.match(inferred.modules[0]?.summaryMd ?? "", /Concepts: hypotheses; assumptions; communicating uncertainty/);
  assert.match(inferred.assignments[0]?.descriptionMd ?? "", /use Clinic wait times by shift/);
  assert.match(inferred.assignments[0]?.descriptionMd ?? "", /Choose one shift: state hypotheses; check assumptions; explain the result for a non-technical reader/);
  assert.deepEqual(inferred.assignments[0]?.objectiveCodes, ["LO4"]);
});

test("treats sample data requests as material plus aligned work", () => {
  const inferred = inferCourseCommandImport(
    "Generate practice material and a checkpoint from this data set. Base: delivery times by weather. Shifts: summarize the distribution; compare rainy and clear days. Concepts: distribution shape; group comparison.",
    "STAT-201",
    {
      code: "LO1",
      title: "Summarize distributions",
      description: "Summarize distributions with descriptive statistics.",
    }
  );

  assert.equal(inferred.modules.length, 1);
  assert.equal(inferred.assignments.length, 1);
  assert.equal(inferred.modules[0]?.source, "sample_practice");
  assert.match(inferred.modules[0]?.summaryMd ?? "", /Base: Delivery times by weather/);
  assert.match(inferred.modules[0]?.summaryMd ?? "", /Concepts: distribution shape; group comparison/);
  assert.match(inferred.assignments[0]?.descriptionMd ?? "", /Read the linked material/);
  assert.deepEqual(inferred.modules[0]?.objectiveCodes, ["LO1"]);
  assert.deepEqual(inferred.assignments[0]?.objectiveCodes, ["LO1"]);
  assert.equal(importSummary(inferred), "Draft 1 material, 1 work item, and 1 objective.");
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
