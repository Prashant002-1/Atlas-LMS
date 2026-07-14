import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

function source(relativeFile: string) {
  return readFileSync(path.join(root, relativeFile), "utf8");
}

test("page-entry motion is reserved for the two overview routes", () => {
  const motion = source("components/atlas/motion.tsx");
  assert.equal(motion.includes('pathname === "/teach" || pathname === "/student"'), true);

  for (const file of [
    "app/teach/work/page.tsx",
    "app/teach/weeks/page.tsx",
    "app/teach/review/page.tsx",
    "app/teach/students/page.tsx",
    "app/teach/announcements/page.tsx",
  ]) {
    const page = source(file);
    assert.equal(page.includes("StaggerGrid"), false, `${file} should render immediately`);
    assert.equal(page.includes("MotionItem"), false, `${file} should render immediately`);
  }
});

test("published is quiet while draft and review remain visible", () => {
  for (const file of [
    "app/teach/page.tsx",
    "app/teach/work/page.tsx",
    "app/teach/weeks/page.tsx",
    "app/teach/week/[moduleId]/page.tsx",
    "app/teach/work/[assignmentId]/page.tsx",
    "app/student/session/[assignmentId]/page.tsx",
  ]) {
    assert.equal(source(file).includes('>Live<'), false, `${file} should not label the normal state Live`);
  }

  assert.equal(source("app/teach/work/page.tsx").includes("Publish"), true);
  assert.equal(source("app/teach/weeks/page.tsx").includes("Review"), true);
  assert.equal(source("app/teach/work/[assignmentId]/page.tsx").includes("Draft"), true);
});

test("publish and sign out use the quiet text scale", () => {
  for (const file of [
    "app/teach/work/page.tsx",
    "app/teach/weeks/page.tsx",
    "app/teach/week/[moduleId]/page.tsx",
    "app/teach/work/[assignmentId]/page.tsx",
  ]) {
    const page = source(file);
    assert.equal(page.includes("Check"), false, `${file} should not decorate Publish with a checkmark`);
    assert.equal(page.includes('size="sm"'), true, `${file} should use the small action scale for Publish`);
  }

  const primitives = source("components/atlas/primitives.tsx");
  assert.equal(primitives.includes('size?: "md" | "sm"'), true);
  assert.equal(primitives.includes('sm: "min-h-8 px-2.5 text-[0.75rem]"'), true);

  const shell = source("components/atlas/app-shell.tsx");
  assert.equal(shell.includes('text-[0.6875rem] font-normal'), true);
  assert.equal(shell.includes("<LogOut size={12}"), false);
});

test("gradebook is an explicit comparison table", () => {
  const page = source("app/teach/gradebook/page.tsx");
  for (const expected of [
    "Course grades",
    "students /",
    "assignments",
    "sticky left-0",
    "sticky right-0",
    "assignmentMeta",
    "Submitted",
    "Missing",
  ]) {
    assert.equal(page.includes(expected), true, `gradebook should include ${expected}`);
  }
  assert.equal(page.includes('from "lucide-react"'), false);
});

test("settings reflects the real Atlas control scopes", () => {
  const page = source("app/teach/settings/page.tsx");
  for (const expected of [
    "Agent boundaries",
    "AI assignments",
    "Course session defaults",
    "Model access",
    "sessionAssignments",
    "resolveModelForOrg",
    "CHAT_PROVIDERS",
    "openai_compatible",
    "verified transcript evidence",
  ]) {
    assert.equal(page.includes(expected), true, `settings should include ${expected}`);
  }

  const actions = source("lib/instructor/settings-actions.ts");
  assert.equal(actions.includes("saveSettingsProviderKey"), true);
  assert.equal(actions.includes("removeSettingsProviderKey"), true);
  assert.equal(actions.includes("baseUrl"), true);
  assert.equal(actions.includes("CHAT_PROVIDERS.includes"), true);
});
