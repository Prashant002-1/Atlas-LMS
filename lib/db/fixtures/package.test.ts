import { test } from "node:test";
import assert from "node:assert/strict";
import { demoPackage } from "./package";
import { v0DemoWorld } from "./v0-demo-world";

/**
 * Integrity checks for the active demo data package. These run without a
 * database, so a broken fixture fails CI before it reaches the seed.
 */

test("exactly one current term, terms do not overlap", () => {
  const current = demoPackage.terms.filter((t) => t.current);
  assert.equal(current.length, 1, "exactly one term must be current");

  const sorted = [...demoPackage.terms].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  for (let i = 1; i < sorted.length; i += 1) {
    assert.ok(
      sorted[i - 1].endsAt < sorted[i].startsAt,
      `terms ${sorted[i - 1].slug} and ${sorted[i].slug} overlap`
    );
  }
  for (const t of demoPackage.terms) {
    assert.ok(t.startsAt < t.endsAt, `term ${t.slug} ends before it starts`);
  }
});

test("canonical demo accounts exist exactly once", () => {
  assert.ok(demoPackage.users.length >= 33 && demoPackage.users.length <= 36, `Expected users count to be between 33 and 36, got ${demoPackage.users.length}`);

  const admin = demoPackage.users.filter((u) => u.email === "admin@demo.edu");
  const instructor = demoPackage.users.filter((u) => u.email === "instructor@demo.edu");
  const student = demoPackage.users.filter((u) => u.email === "student@demo.edu");

  assert.equal(admin.length, 1);
  assert.equal(admin[0].key, "admin");
  assert.equal(admin[0].role, "admin");
  assert.equal(instructor.length, 1);
  assert.equal(instructor[0].key, "amara");
  assert.equal(instructor[0].name, "Dr. Amara Osei");
  assert.equal(instructor[0].role, "instructor");
  assert.equal(student.length, 1);
  assert.equal(student[0].key, "maya");
  assert.equal(student[0].role, "student");

  const roleCounts = countBy(demoPackage.users, (u) => u.role);
  assert.equal(roleCounts.admin, 1);
  assert.ok(roleCounts.instructor >= 1 && roleCounts.instructor <= 4, `Expected instructors to be between 1 and 4, got ${roleCounts.instructor}`);
  assert.equal(roleCounts.student, 31);

  const emails = demoPackage.users.map((u) => u.email);
  assert.equal(new Set(emails).size, emails.length, "user emails must be unique");
  const keys = demoPackage.users.map((u) => u.key);
  assert.equal(new Set(keys).size, keys.length, "user keys must be unique");
});

test("every course reference resolves", () => {
  const termSlugs = new Set(demoPackage.terms.map((t) => t.slug));
  const userKeys = new Set(demoPackage.users.map((u) => u.key));

  for (const course of demoPackage.courses) {
    const where = `${course.code} (${course.termSlug})`;
    assert.ok(termSlugs.has(course.termSlug), `${where}: unknown term`);
    assert.ok(userKeys.has(course.instructorKey), `${where}: unknown instructor`);

    const objectiveCodes = new Set(course.objectives.map((o) => o.code));
    assert.equal(objectiveCodes.size, course.objectives.length, `${where}: duplicate objective codes`);

    const moduleKeys = new Set(course.modules.map((m) => m.key));
    assert.equal(moduleKeys.size, course.modules.length, `${where}: duplicate module keys`);
    const assignmentKeys = new Set(course.assignments.map((a) => a.key));
    assert.equal(assignmentKeys.size, course.assignments.length, `${where}: duplicate assignment keys`);

    for (const m of course.modules) {
      for (const code of m.objectiveCodes) {
        assert.ok(objectiveCodes.has(code), `${where}: module ${m.key} references unknown objective ${code}`);
      }
      assert.ok(m.week >= 1 && m.week <= 20, `${where}: module ${m.key} week out of range`);
    }
    for (const a of course.assignments) {
      for (const code of a.objectiveCodes) {
        assert.ok(objectiveCodes.has(code), `${where}: assignment ${a.key} references unknown objective ${code}`);
      }
      assert.ok(a.dueWeek >= 1 && a.dueWeek <= 20, `${where}: assignment ${a.key} dueWeek out of range`);
      assert.ok(a.pointsPossible > 0, `${where}: assignment ${a.key} needs points`);
    }
    for (const p of course.pages) {
      for (const code of p.objectiveCodes ?? []) {
        assert.ok(objectiveCodes.has(code), `${where}: page ${p.slug} references unknown objective ${code}`);
      }
    }

    const enrolledKeys = new Set(course.enrollments.map((e) => e.userKey));
    assert.ok(enrolledKeys.has(course.instructorKey), `${where}: instructor must be enrolled`);
    for (const e of course.enrollments) {
      assert.ok(userKeys.has(e.userKey), `${where}: enrollment references unknown user ${e.userKey}`);
    }

    const studentKeys = new Set(course.enrollments.filter((e) => e.role === "student").map((e) => e.userKey));
    for (const s of course.submissions) {
      assert.ok(assignmentKeys.has(s.assignmentKey), `${where}: submission references unknown assignment ${s.assignmentKey}`);
      assert.ok(studentKeys.has(s.studentKey), `${where}: submission from non-enrolled student ${s.studentKey}`);
      if (s.state === "graded") {
        assert.ok(typeof s.score === "number", `${where}: graded submission ${s.assignmentKey}/${s.studentKey} needs a score`);
        const assignment = course.assignments.find((a) => a.key === s.assignmentKey)!;
        assert.ok(s.score! <= assignment.pointsPossible, `${where}: ${s.assignmentKey}/${s.studentKey} score above points`);
      }
    }

    const weight = course.objectives.reduce((sum, o) => sum + o.assessmentWeight, 0);
    assert.ok(Math.abs(weight - 1) < 0.05, `${where}: objective weights sum to ${weight.toFixed(2)}, expected ~1`);
  }
});

test("the active seed is the multi-course v0 world", () => {
  assert.strictEqual(demoPackage, v0DemoWorld.currentSchema.package);
  assert.equal(demoPackage.terms.length, 1, "the demo package runs one term");
  assert.equal(demoPackage.courses[0].code, "ECON-241");
  assert.ok(demoPackage.courses.length >= 1 && demoPackage.courses.length <= 4);
});

test("the demo window and ECON course match the pricing-session story", () => {
  const current = demoPackage.terms.find((t) => t.current)!;
  const demoDay = "2026-06-09";
  assert.ok(current.startsAt <= demoDay && demoDay <= current.endsAt, "June 9 2026 must fall inside the current term");

  const course = demoPackage.courses[0];
  assert.equal(course.termSlug, current.slug);
  assert.equal(course.code, "ECON-241");
  assert.equal(course.name, "Intermediate Microeconomics");
  assert.equal(course.instructorKey, "amara");
  assert.equal(course.modules.length, 8);
  assert.equal(course.pages.length, 12);
  assert.equal(course.assignments.length, 7);

  const assignmentKeys = course.assignments.map((a) => a.key);
  assert.deepEqual(assignmentKeys, ["ps1", "ps2", "ps3", "exam-1", "session-assignment", "ps4", "final-project"]);
  const sessionAssignment = course.assignments.find((a) => a.key === "session-assignment");
  assert.ok(sessionAssignment, "pricing session assignment must exist");
  assert.equal(sessionAssignment!.name, "Pricing Strategy Session");
  assert.deepEqual(sessionAssignment!.objectiveCodes, ["LO4", "LO5", "LO6"]);

  const enrollmentCounts = countBy(course.enrollments, (e) => e.role);
  assert.equal(enrollmentCounts.instructor, 1);
  assert.equal(enrollmentCounts.student, 31);
  assert.equal(course.enrollments.some((e) => e.userKey === "maya" && e.role === "student"), true);

  assert.equal(course.submissions.length, 155, "31 students should each have submissions for ps1, ps2, ps3, exam-1, and the session assignment");
  const submissionsByAssignment = countBy(course.submissions, (s) => s.assignmentKey);
  const activeAssignmentKeys = ["ps1", "ps2", "ps3", "exam-1", "session-assignment"];
  for (const key of activeAssignmentKeys) {
    assert.equal(submissionsByAssignment[key], 31, `${key} should have one submission per student`);
  }

  const sessionSubmissions = course.submissions.filter((s) => s.assignmentKey === "session-assignment");
  assert.equal(sessionSubmissions.length, 31);
  
  const graded = sessionSubmissions.filter((s) => s.state === "graded");
  const submitted = sessionSubmissions.filter((s) => s.state === "submitted");
  const missing = sessionSubmissions.filter((s) => s.state === "missing");
  
  assert.equal(graded.length, 20, "expected 20 graded session assignments");
  assert.equal(submitted.length, 8, "expected 8 submitted/waiting-to-grade session assignments");
  assert.equal(missing.length, 3, "expected 3 missing session assignments");
  
  assert.equal(
    graded.every((s) => s.body?.includes("Recommended Pricing Tiers")),
    true,
    "graded submissions should be inspectable artifacts"
  );

  const latestAnnouncement = [...course.announcements].sort((a, b) => b.dayOffset - a.dayOffset)[0];
  assert.equal(latestAnnouncement.title, "Active Pricing Session Reminders");
  assert.equal(course.announcements.filter((a) => a.dayOffset === latestAnnouncement.dayOffset).length, 1);
  assert.equal(
    submitted.every((s) => s.body?.includes("Pricing Strategy Session")),
    true,
    "submitted submissions should be inspectable draft artifacts"
  );
});

test("ECON policy encodes the professor-controlled AI contract", () => {
  const course = demoPackage.courses[0];
  assert.equal(course.policy.allowExplain, true);
  assert.equal(course.policy.allowPractice, true);
  assert.equal(course.policy.allowQuestions, true);
  assert.equal(course.policy.explanationDepth, "guided");
  assert.equal(course.policy.citationsRequired, true);
  assert.equal(course.policy.shareStruggleSignal, true);
  assert.equal(course.policy.personaName, "The Strategist");
  assert.ok(course.policy.customInstructions?.includes("Do not give students direct answers"));
});

function countBy<T>(items: T[], keyFor: (item: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const key = keyFor(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}
