import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative: string) => readFileSync(path.join(root, relative), "utf8");

/**
 * Instructor experience contracts: the syllabus as a composed course
 * overview, roster-first students, review items that reopen their Atlas
 * thread, and the leaner settings and account layouts.
 */

test("the syllabus is its own composed surface, synchronized with the record", () => {
  const page = read("app/teach/syllabus/page.tsx");
  const loader = read("lib/instructor/syllabus.ts");
  const actions = read("lib/instructor/actions.ts");
  const layout = read("app/teach/layout.tsx");
  const courseSetup = read("app/teach/course/page.tsx");

  // The page renders record-derived sections below the professor's own text.
  assert.ok(page.includes("loadCourseSyllabus"));
  assert.ok(page.includes("Weekly schedule"));
  assert.ok(page.includes("Assignments and grading"));
  assert.ok(page.includes("Course policies"));
  assert.ok(page.includes("action={updateCourseSyllabus}"));

  // PDF export is a visible placeholder until the export lands.
  assert.ok(page.includes("Export PDF"));
  assert.ok(page.includes('title="PDF export is planned"'));

  // The loader composes live rows; the schedule mapping is pure and tested.
  assert.match(loader, /export async function loadCourseSyllabus/);
  assert.match(loader, /export function assignDueWeeks/);
  assert.ok(loader.includes("loadActiveCourseAgentConfig"));

  // The syllabus text has one owner: its own action, not the course dialog.
  assert.match(actions, /export async function updateCourseSyllabus/);
  assert.equal(courseSetup.includes('name="syllabus"'), false, "course setup no longer edits the syllabus text");
  assert.ok(courseSetup.includes('href="/teach/syllabus"'));
  assert.ok(layout.includes('"/teach/syllabus"'));
});

test("the students page leads with the roster", () => {
  const page = read("app/teach/students/page.tsx");
  const roster = page.indexOf("Roster (");
  const work = page.indexOf(">Assignments<");
  assert.ok(roster > -1, "students page names the roster");
  assert.ok(work > -1, "students page keeps the assignment progress section");
  assert.ok(roster < work, "the roster renders before the course work");
});

test("review items reopen the Atlas thread that drafted them", () => {
  const workspace = read("lib/instructor/workspace.ts");
  const card = read("components/teach/proposals.tsx");
  const review = read("app/teach/review/page.tsx");

  assert.ok(workspace.includes("sessionId: changeProposals.sessionId"));
  assert.ok(workspace.includes("thread:"));
  assert.ok(card.includes("/teach/atlas?thread="));
  assert.ok(review.includes("Recent decisions"));
});

test("boundary rows follow their owners across the split", () => {
  const settings = read("app/teach/settings/page.tsx");
  assert.ok(settings.includes("SystemBoundaryRow"));
  assert.ok(settings.includes("System boundaries"));

  const courseSetup = read("app/teach/course/page.tsx");
  assert.ok(courseSetup.includes("BoundaryRow"));
  assert.ok(courseSetup.includes("Escalates to professor"));
});

test("instructor profile facts live on the user record and account page", () => {
  const schema = read("lib/db/schema.ts");
  const actions = read("lib/auth/actions.ts");
  const form = read("components/account/account-profile-form.tsx");

  assert.ok(schema.includes('officeLocation: text("office_location")'));
  assert.ok(schema.includes('officeHours: text("office_hours")'));
  assert.ok(actions.includes("officeLocation"));
  assert.ok(actions.includes("officeHours"));
  assert.ok(form.includes("Office location"));
  assert.ok(form.includes("Office hours"));
  assert.equal(existsSync(path.join(root, "drizzle/0005_instructor_profile.sql")), true, "migration 0005 exists");
  assert.match(read("drizzle/0005_instructor_profile.sql"), /office_hours/);
});
