import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { markdownBody, markdownPreview } from "@/lib/markdown-presentation";

const root = process.cwd();
const read = (relative: string) => readFileSync(path.join(root, relative), "utf8");

test("record prose drops only a duplicate leading Markdown heading", () => {
  const description = "## Problem Set 2: Willingness to pay and consumer surplus\n\nUse the **six-customer** [schedule](/schedule).";

  assert.equal(
    markdownBody(description, "Problem Set 2: Willingness to Pay and Consumer Surplus"),
    "Use the **six-customer** [schedule](/schedule)."
  );
  assert.equal(markdownBody("## Deliverable\n\nShow your work.", "Problem Set 2"), "## Deliverable\n\nShow your work.");
});

test("compact record rows show plain prose instead of Markdown syntax", () => {
  const description = "## Problem Set 2\n\nUse the **six-customer** [schedule](/schedule).\n\n- Show your work.";

  assert.equal(markdownPreview(description, "Problem Set 2"), "Use the six-customer schedule. Show your work.");
});

test("assignment readers render Markdown and material rows omit type glyphs", () => {
  const instructorAssignment = read("app/teach/assignments/[assignmentId]/page.tsx");
  const studentAssignment = read("app/student/assignments/[assignmentId]/page.tsx");
  const week = read("app/teach/week/[moduleId]/page.tsx");
  const student = read("app/teach/student/[studentId]/page.tsx");
  const materialTable = read("components/teach/course-material-table.tsx");

  for (const page of [instructorAssignment, studentAssignment]) {
    assert.match(page, /<Markdown/);
    assert.match(page, /markdownBody/);
  }
  for (const page of [week, student]) assert.match(page, /markdownPreview/);

  assert.doesNotMatch(week, /MaterialIcon/);
  assert.doesNotMatch(materialTable, /KIND_ICONS/);
});
