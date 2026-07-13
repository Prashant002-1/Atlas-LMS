import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative: string) => readFileSync(path.join(root, relative), "utf8");

test("the authenticated tenant supplies the institution name to both shells", () => {
  const loader = read("lib/workspace/institution.ts");
  const teacher = read("app/teach/layout.tsx");
  const student = read("app/student/layout.tsx");

  assert.ok(loader.includes("organizations.name"));
  assert.ok(loader.includes("eq(organizations.id, orgId)"));
  assert.ok(teacher.includes("loadInstitutionName(session.user.orgId)"));
  assert.ok(student.includes("loadInstitutionName(session.user.orgId)"));
  assert.ok(teacher.includes("institutionName={institutionName}"));
  assert.ok(student.includes("institutionName={institutionName}"));
});

test("the shell leads with the institution and keeps Atlas subordinate", () => {
  const shell = read("components/atlas/app-shell.tsx");

  assert.ok(shell.includes("{institutionName}</span>"));
  assert.ok(shell.includes("<AtlasMark size={24} />"));
  assert.ok(shell.includes(">Atlas</span>"));
  assert.ok(shell.includes("institutionName={institutionName}"));
  assert.ok(shell.includes('className="flex h-14 shrink-0'));
  assert.equal(shell.includes("Powered by Atlas"), false);
  assert.ok(shell.includes("py-1.5 text-left text-[0.75rem]"));
  assert.equal(shell.includes('>Account</span>'), false);
});
