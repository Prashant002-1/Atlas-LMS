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

test("module-linked records return to their originating module", () => {
  const week = read("app/teach/week/[moduleId]/page.tsx");
  const document = read("app/teach/documents/[fileId]/page.tsx");
  const record = read("app/teach/records/[recordId]/page.tsx");
  const assignment = read("app/teach/assignments/[assignmentId]/page.tsx");
  const actions = read("lib/instructor/actions.ts");

  assert.match(week, /withModuleContext/);
  assert.match(week, /href=\{materialHref\}/);
  assert.match(week, /href=\{assignmentHref\}/);
  for (const reader of [document, record]) {
    assert.match(reader, /fromModule/);
    assert.match(reader, /moduleReturnHref/);
  }
  assert.match(assignment, /searchParams: Promise<\{ fromModule\?: string \}>/);
  assert.match(assignment, /moduleReturnHref\(query\.fromModule\)/);
  assert.match(assignment, /<BackLink href=\{backHref\}>\{backLabel\}<\/BackLink>/);
  assert.match(assignment, /returnTo=\{assignmentHref\}/);
  assert.match(actions, /query\.size === 1 && moduleReturnHref\(fromModule\)/);
});
