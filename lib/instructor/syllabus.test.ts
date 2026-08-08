import { test } from "node:test";
import assert from "node:assert/strict";
import { GRADE_BANDS, assignDueWeeks, type SyllabusAssignment } from "@/lib/instructor/syllabus";
import { gradeLetterFor } from "@/lib/agent/grading";
import { inferModuleIdFromDueDate } from "@/lib/course/module-assignment-placement";

/** The syllabus letter bands and the gradebook's own mapping stay in step. */
test("syllabus grade bands agree with gradeLetterFor", () => {
  for (const band of GRADE_BANDS) {
    assert.equal(gradeLetterFor(band.min), band.letter, `${band.letter} starts at ${band.min}`);
    if (band.min > 0) {
      assert.notEqual(gradeLetterFor(band.min - 0.1), band.letter, `${band.letter} does not reach below ${band.min}`);
    }
  }
});

function work(id: string, dueAt: Date | null): SyllabusAssignment {
  return { id, name: id, dueAt, pointsPossible: 10, published: true, session: null };
}

test("dated assignments land in the module week whose window holds their due date", () => {
  const weeks = [
    { id: "w1", opensAt: new Date("2026-01-05T00:00:00Z") },
    { id: "w2", opensAt: new Date("2026-01-12T00:00:00Z") },
    { id: "w3", opensAt: new Date("2026-01-19T00:00:00Z") },
    { id: "undated", opensAt: null },
  ];
  const byWeek = assignDueWeeks(weeks, [
    work("mid-week-one", new Date("2026-01-08T12:00:00Z")),
    work("on-week-two-open", new Date("2026-01-12T00:00:00Z")),
    work("late-course", new Date("2026-02-20T00:00:00Z")),
    work("before-everything", new Date("2026-01-01T00:00:00Z")),
    work("no-due-date", null),
  ]);

  assert.deepEqual(byWeek.get("w1")?.map((item) => item.id), ["before-everything", "mid-week-one"]);
  assert.deepEqual(byWeek.get("w2")?.map((item) => item.id), ["on-week-two-open"]);
  assert.deepEqual(byWeek.get("w3")?.map((item) => item.id), ["late-course"]);
  assert.equal(byWeek.has("undated"), false);

  const mapped = [...byWeek.values()].flat().map((item) => item.id);
  assert.equal(mapped.includes("no-due-date"), false);
});

test("courses without dated modules map no work into the schedule", () => {
  const byWeek = assignDueWeeks(
    [{ id: "a", opensAt: null }, { id: "b", opensAt: null }],
    [work("anything", new Date("2026-01-08T00:00:00Z"))]
  );
  assert.equal(byWeek.size, 0);
});

test("an unplaced assignment resolves to its due-date week", () => {
  const weeks = [
    { id: "w1", opensAt: new Date("2026-01-05T00:00:00Z") },
    { id: "w2", opensAt: new Date("2026-01-12T00:00:00Z") },
    { id: "w3", opensAt: new Date("2026-01-19T00:00:00Z") },
  ];

  assert.equal(inferModuleIdFromDueDate(weeks, new Date("2026-01-16T12:00:00Z")), "w2");
  assert.equal(inferModuleIdFromDueDate(weeks, new Date("2026-01-01T12:00:00Z")), "w1");
  assert.equal(inferModuleIdFromDueDate(weeks, new Date("2026-02-01T12:00:00Z")), "w3");
  assert.equal(inferModuleIdFromDueDate(weeks, null), null);
});
