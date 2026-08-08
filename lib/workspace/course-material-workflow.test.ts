import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative: string) => readFileSync(path.join(root, relative), "utf8");

test("material names open their records without a separate open column", () => {
  const table = read("components/teach/course-material-table.tsx");

  assert.match(table, /<Link href=\{openHref\}/);
  assert.match(table, /<a href=\{openHref\}/);
  assert.doesNotMatch(table, />Open<\/th>/);
  assert.doesNotMatch(table, /ExternalLink/);
});

test("material intake separates files from links and requires an academic placement", () => {
  const dialog = read("components/teach/add-material-dialog.tsx");
  const picker = read("components/teach/file-picker.tsx");
  const actions = read("lib/instructor/course-material-actions.ts");

  assert.match(dialog, /source === "file"/);
  assert.match(dialog, /source === "link"/);
  assert.match(dialog, /FilePicker/);
  assert.match(picker, /Choose file/);
  assert.doesNotMatch(picker, /No file chosen/);
  assert.doesNotMatch(dialog, /name="materialKind"/);
  assert.match(dialog, /<legend[^>]*>Attach to<\/legend>/);
  assert.match(dialog, /name="moduleId"/);
  assert.match(dialog, /name="assignmentId"/);
  assert.match(actions, /Attach this material to a module or assignment/);
  assert.match(actions, /insert\(moduleItems\)/);
  assert.match(actions, /assignmentId: placement\.assignmentId/);
});

test("a module can add a material directly into itself", () => {
  const week = read("app/teach/week/[moduleId]/page.tsx");
  const documents = read("lib/course/documents.ts");
  const contents = read("lib/instructor/module-contents.ts");

  assert.match(week, /<AddMaterialDialog/);
  assert.match(week, /defaultModuleId=\{moduleId\}/);
  assert.match(documents, /moduleId\?: string/);
  assert.match(documents, /insert\(moduleItems\)/);
  assert.match(contents, /explicitlyPlacedFileIds/);
  assert.match(contents, /safeExternalHref/);
});

test("formatted editors do not print an implementation label", () => {
  const editor = read("components/teach/rich-text-editor.tsx");
  assert.doesNotMatch(editor, /Markdown formatting/);
});
