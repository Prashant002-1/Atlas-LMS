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
    "app/teach/assignments/page.tsx",
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
    "app/teach/assignments/page.tsx",
    "app/teach/weeks/page.tsx",
    "app/teach/week/[moduleId]/page.tsx",
    "app/teach/assignments/[assignmentId]/page.tsx",
    "app/student/session/[assignmentId]/page.tsx",
  ]) {
    assert.equal(source(file).includes('>Live<'), false, `${file} should not label the normal state Live`);
  }

  assert.equal(source("components/teach/assignment-table.tsx").includes("Publish"), true);
  assert.equal(source("app/teach/weeks/page.tsx").includes("Review"), true);
  assert.equal(source("app/teach/assignments/[assignmentId]/page.tsx").includes("Draft"), true);
});

test("publish and sign out use the quiet text scale", () => {
  for (const file of [
    "components/teach/assignment-table.tsx",
    "app/teach/weeks/page.tsx",
    "app/teach/week/[moduleId]/page.tsx",
    "app/teach/assignments/[assignmentId]/page.tsx",
  ]) {
    const page = source(file);
    assert.equal(page.includes("Check"), false, `${file} should not decorate Publish with a checkmark`);
    assert.equal(page.includes('size="sm"'), true, `${file} should use the small action scale for Publish`);
  }

  const primitives = source("components/atlas/primitives.tsx");
  assert.equal(primitives.includes('size?: "md" | "sm"'), true);
  assert.equal(primitives.includes('sm: "min-h-8 px-2.5 text-[0.75rem]"'), true);

  const shell = source("components/atlas/app-shell.tsx");
  assert.equal(shell.includes('text-[0.8125rem] font-medium'), true);
  assert.equal(shell.includes("Sign out"), true);
  assert.equal(shell.includes("<LogOut size={12}"), false);
});

test("gradebook is an explicit searchable comparison table", () => {
  const page = source("app/teach/gradebook/page.tsx");
  const table = source("components/teach/gradebook-table.tsx");
  assert.equal(page.includes("GradebookTable"), true);
  for (const expected of [
    "Course grades",
    "Search students",
    "Filter assignment",
    "Filter grade status",
    "sticky left-0",
    "sticky right-0",
    "assignmentMeta",
    "Submitted",
    "Missing",
  ]) {
    assert.equal(table.includes(expected), true, `gradebook should include ${expected}`);
  }
  assert.equal(page.includes('from "lucide-react"'), false);
});

test("teacher assignment states are dated and filterable", () => {
  const page = source("app/teach/assignments/page.tsx");
  const table = source("components/teach/assignment-table.tsx");
  assert.equal(page.includes("AssignmentTable"), true);
  for (const expected of ["Past due", "Upcoming", "No due date", "Draft", "Search assignments", "Filter assignments", "Not submitted"]) {
    assert.equal(table.includes(expected), true, `Assignments should include ${expected}`);
  }
});

test("creation and edits open as deliberate dialogs", () => {
  const announcements = source("app/teach/announcements/page.tsx");
  const modules = source("app/teach/weeks/page.tsx");
  const moduleDetail = source("app/teach/week/[moduleId]/page.tsx");
  const assignmentDetail = source("app/teach/assignments/[assignmentId]/page.tsx");

  assert.equal(announcements.includes("NewAnnouncementDialog"), true);
  assert.equal(announcements.includes("AnnouncementList"), true);
  assert.equal(announcements.includes("Post to course"), false);
  assert.equal(source("app/teach/announcements/[announcementId]/page.tsx").includes("Markdown"), true);
  assert.equal(modules.includes("NewModuleDialog"), true);
  assert.equal(modules.includes("<details"), false);
  assert.equal(moduleDetail.includes("ModuleSwitcher"), true);
  assert.equal(moduleDetail.includes("EditModuleDialog"), true);
  assert.equal(moduleDetail.includes('Panel title="Assignments"'), false);
  const switcher = source("components/teach/module-switcher.tsx");
  assert.equal(switcher.includes("onMouseEnter"), true);
  assert.equal(switcher.includes("top-full"), true);
  assert.equal(switcher.includes("pt-2"), true);
  assert.equal(switcher.includes("ChevronDown"), false);
  assert.equal(switcher.includes("Scroll to switch modules"), false);
  assert.equal(switcher.includes("overflow-y-auto"), false);
  assert.equal(assignmentDetail.includes("AssignmentEditDialog"), true);
  assert.equal(assignmentDetail.includes("<details"), false);
});

test("settings describes the personal Atlas while Course setup owns the course", () => {
  const settings = source("app/teach/settings/page.tsx");
  for (const expected of [
    "Works for you",
    "What Atlas can do",
    "What Atlas remembers",
    "System boundaries",
    "listActiveMemories",
    "agentProfiles",
  ]) {
    assert.equal(settings.includes(expected), true, `settings should include ${expected}`);
  }
  for (const excluded of [
    "resolvePlatformModel",
    "CHAT_PROVIDERS",
    "openai_compatible",
    "API key",
    "loadActiveCourseAgentConfig",
    "<form",
  ]) {
    assert.equal(settings.includes(excluded), false, `settings should not include ${excluded}`);
  }

  const courseSetup = source("app/teach/course/page.tsx");
  for (const expected of [
    "Grade scale",
    "Class policies",
    "Course agent",
    "Version history",
    "loadActiveCourseAgentConfig",
  ]) {
    assert.equal(courseSetup.includes(expected), true, `course setup should include ${expected}`);
  }
  for (const excluded of ["Model access", "resolvePlatformModel", "CHAT_PROVIDERS"]) {
    assert.equal(courseSetup.includes(excluded), false, `course setup should not include ${excluded}`);
  }
});
