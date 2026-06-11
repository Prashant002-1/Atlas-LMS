import { test } from "node:test";
import assert from "node:assert/strict";
import { demoPackage } from "./package";

/**
 * Integrity checks for the shared demo data package. These run without a
 * database, so a broken fixture fails CI before it ever reaches a seed.
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
  const instructor = demoPackage.users.filter((u) => u.email === "instructor@demo.edu");
  const student = demoPackage.users.filter((u) => u.email === "student@demo.edu");
  assert.equal(instructor.length, 1);
  assert.equal(instructor[0].role, "instructor");
  assert.equal(student.length, 1);
  assert.equal(student[0].role, "student");

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

test("the demo window falls inside the current term, with live work on both sides", () => {
  const current = demoPackage.terms.find((t) => t.current)!;
  const demoDay = "2026-06-09";
  assert.ok(current.startsAt <= demoDay && demoDay <= current.endsAt, "June 9 2026 must fall inside the current term");

  const currentCourses = demoPackage.courses.filter((c) => c.termSlug === current.slug);
  assert.ok(currentCourses.length >= 4, "the current term needs a real catalog");

  // The flagship course must exercise every workflow: grading queue, missing
  // work, draft modules to publish, and graded history.
  const stat = currentCourses.find((c) => c.code === "STAT-201");
  assert.ok(stat, "STAT-201 must run in the current term");
  assert.ok(stat!.submissions.some((s) => s.state === "submitted"), "STAT-201 needs ungraded submissions (grading desk)");
  assert.ok(stat!.submissions.some((s) => s.state === "missing"), "STAT-201 needs missing work");
  assert.ok(stat!.submissions.some((s) => s.state === "graded"), "STAT-201 needs graded history");
  assert.ok(stat!.modules.some((m) => !m.published), "STAT-201 needs draft modules (publish queue)");
  assert.ok(stat!.modules.some((m) => m.published), "STAT-201 needs live modules");

  // Maya (the demo student) must have a story: a missing item somewhere and
  // submitted-ungraded work somewhere else.
  const mayaCourses = currentCourses.filter((c) => c.enrollments.some((e) => e.userKey === "maya" && e.role === "student"));
  assert.ok(mayaCourses.length >= 3, "Maya should carry a real schedule");
  const mayaStates = mayaCourses.flatMap((c) => c.submissions.filter((s) => s.studentKey === "maya").map((s) => s.state));
  assert.ok(mayaStates.includes("missing"), "Maya needs one missing item");
  assert.ok(mayaStates.includes("submitted"), "Maya needs submitted-ungraded work");
  assert.ok(mayaStates.includes("graded"), "Maya needs graded work");
  assert.equal(demoPackage.terms.length, 1, "the demo package runs one term");
});

test("policies vary and the persona course exists", () => {
  const current = demoPackage.terms.find((t) => t.current)!;
  const courses = demoPackage.courses.filter((c) => c.termSlug === current.slug);
  assert.ok(
    courses.some((c) => c.policy.personaName && c.policy.personaStyle),
    "one current course should carry a persona"
  );
  assert.ok(courses.some((c) => !c.policy.allowPractice), "one course should have practice turned off");
  assert.ok(courses.some((c) => c.policy.shareStruggleSignal) && courses.some((c) => !c.policy.shareStruggleSignal));
  for (const c of courses) {
    assert.ok(c.policy.studentDailyLimit > 0, `${c.code}: daily limit must be positive`);
  }
});
