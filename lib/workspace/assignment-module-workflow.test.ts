import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative: string) => readFileSync(path.join(root, relative), "utf8");

test("assignment creation is reusable, formatted, placeable, and document-aware", () => {
  const page = read("app/teach/assignments/page.tsx");
  const week = read("app/teach/week/[moduleId]/page.tsx");
  const dialog = read("components/teach/new-assignment-dialog.tsx");
  const picker = read("components/teach/file-picker.tsx");
  const actions = read("lib/instructor/actions.ts");

  assert.match(page, /NewAssignmentDialog/);
  assert.match(week, /NewAssignmentDialog/);
  assert.match(week, /defaultModuleId=\{moduleId\}/);
  assert.match(dialog, /RichTextEditor/);
  assert.match(dialog, /name="moduleId"/);
  assert.match(dialog, /Use due date/);
  assert.match(dialog, /name="documents"/);
  assert.match(dialog, /multiple/);
  assert.match(dialog, /maxFiles=\{10\}/);
  assert.match(dialog, /maxTotalBytes=\{MAX_COURSE_MATERIAL_BYTES\}/);
  assert.doesNotMatch(dialog, /up to 10/i);
  assert.match(picker, /maxFiles - 2/);
  assert.match(picker, /maxTotalBytes \* 0\.8/);
  assert.match(actions, /documents\.length > 10/);
  assert.match(actions, /Assignment documents must be 25 MB total or smaller/);
});

test("assignment module membership is explicit and remains editable", () => {
  const actions = read("lib/instructor/actions.ts");
  const detail = read("app/teach/assignments/[assignmentId]/page.tsx");

  assert.match(actions, /insert\(moduleItems\)/);
  assert.match(actions, /type: "Assignment"/);
  assert.match(actions, /delete\(moduleItems\)/);
  assert.match(detail, /name="moduleId"/);
  assert.match(actions, /createUploadedDocument/);
  assert.match(actions, /target: \{ type: "assignment", id: createdId \}/);
});

test("module readers prefer explicit placement and otherwise derive the week from the due date", () => {
  const instructor = read("lib/instructor/workspace.ts");
  const student = read("lib/student/workspace.ts");
  const syllabus = read("lib/instructor/syllabus.ts");

  for (const source of [instructor, student, syllabus]) {
    assert.match(source, /moduleItems/);
    assert.match(source, /explicitlyPlacedIds/);
  }
  assert.match(instructor, /inferModuleIdFromDueDate/);
  assert.match(instructor, /datedHere/);
  assert.match(student, /inferModuleIdFromDueDate/);
  assert.match(student, /datedHere/);
  assert.match(syllabus, /assignDueWeeks/);
});

test("durable prose forms use the formatted editor instead of bare textareas", () => {
  const authoredSurfaces = [
    "app/teach/assignments/page.tsx",
    "components/teach/new-assignment-dialog.tsx",
    "app/teach/weeks/page.tsx",
    "app/teach/course/page.tsx",
    "app/teach/syllabus/page.tsx",
    "app/student/assignments/[assignmentId]/page.tsx",
    "components/teach/announcement-composer.tsx",
  ];

  for (const file of authoredSurfaces) {
    const source = read(file);
    assert.equal(source.includes("<textarea"), false, `${file} has a bare textarea`);
  }
});
