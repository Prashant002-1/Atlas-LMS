import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative: string) => readFileSync(path.join(root, relative), "utf8");

const visibleSurfaces = [
  "app/teach/weeks/page.tsx",
  "app/teach/week/[moduleId]/page.tsx",
  "app/teach/work/page.tsx",
  "app/teach/work/[assignmentId]/page.tsx",
  "app/teach/student/[studentId]/page.tsx",
  "app/teach/settings/page.tsx",
  "app/student/material/[moduleId]/page.tsx",
  "app/student/work/[assignmentId]/page.tsx",
  "components/teach/proposals.tsx",
];

test("learning-objective UI stays out of professor and student surfaces", () => {
  for (const file of visibleSurfaces) {
    const source = read(file);
    assert.equal(source.includes("CodeList"), false, `${file} renders objective codes`);
    assert.equal(source.includes("ObjectiveChecklist"), false, `${file} renders objective controls`);
    assert.equal(source.includes("RelatedObjectives"), false, `${file} renders an objective section`);
    assert.equal(source.includes("objectiveCodes.join"), false, `${file} renders objective code metadata`);
    assert.equal(source.includes("objective.code}"), false, `${file} renders an objective code`);
  }
});

test("settings describe course knowledge, not objective tracking", () => {
  const settings = read("app/teach/settings/page.tsx");
  assert.ok(settings.includes("Course knowledge"));
  assert.ok(settings.includes("Manage course materials"));
  assert.equal(settings.toLowerCase().includes("objectives"), false);
});

test("objective relationships may persist silently through ordinary edits", () => {
  const assignment = read("app/teach/work/[assignmentId]/page.tsx");
  const courseModule = read("app/teach/week/[moduleId]/page.tsx");
  assert.ok(assignment.includes('type="hidden" name="objectiveCode"'));
  assert.ok(courseModule.includes('type="hidden" name="objectiveCode"'));
});
