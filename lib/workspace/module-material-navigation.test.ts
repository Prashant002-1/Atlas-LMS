import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { moduleReturnHref, withModuleContext } from "@/lib/module-navigation-context";

const root = process.cwd();
const read = (relative: string) => readFileSync(path.join(root, relative), "utf8");
const moduleId = "0428b530-3d7e-4b61-9c40-ec2a215d9e58";

test("module material links retain their module as a bounded return destination", () => {
  assert.equal(
    withModuleContext("/teach/documents/file-id", moduleId),
    `/teach/documents/file-id?fromModule=${moduleId}`
  );
  assert.equal(moduleReturnHref(moduleId), `/teach/week/${moduleId}`);
  assert.equal(moduleReturnHref("/teach/atlas"), null);
  assert.equal(moduleReturnHref(undefined), null);
});

test("document and course-record readers honor module context", () => {
  const week = read("app/teach/week/[moduleId]/page.tsx");
  const document = read("app/teach/documents/[fileId]/page.tsx");
  const record = read("app/teach/records/[recordId]/page.tsx");

  assert.match(week, /withModuleContext/);
  assert.match(week, /href=\{materialHref\}/);
  for (const reader of [document, record]) {
    assert.match(reader, /fromModule/);
    assert.match(reader, /moduleReturnHref/);
  }
});
