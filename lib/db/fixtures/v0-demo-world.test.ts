import { test } from "node:test";
import assert from "node:assert/strict";
import { v0DemoWorld } from "./v0-demo-world";

test("manifest checks out correctly", () => {
  const m = v0DemoWorld.manifest;
  assert.equal(m.blueprint, "v1");
  assert.equal(m.scenarioKey, "econ-streaming-pricing");
  assert.equal(m.size, "full");

  // check counts in manifest
  assert.equal(m.counts.organizations, 1);
  assert.equal(m.counts.terms, 1);
  assert.ok(m.counts.users >= 33 && m.counts.users <= 36, `Expected users count to be between 33 and 36, got ${m.counts.users}`);
  assert.ok(m.counts.courses >= 1 && m.counts.courses <= 4, `Expected courses count to be between 1 and 4, got ${m.counts.courses}`);
  assert.equal(m.counts.agentSessions, 32);
});

test("scenario slots have correct placeholder values", () => {
  const s = v0DemoWorld.scenario;
  assert.equal(s.scenarioKey, "econ-streaming-pricing");
  assert.equal(s.courseCode, "ECON-241");
  assert.equal(s.conceptWeak, "elasticity");
  assert.equal(s.confusedWith, "slope");
  assert.equal(s.conceptNext, "price discrimination");
});

test("current schema package has expected structure", () => {
  const pkg = v0DemoWorld.currentSchema.package;
  assert.equal(pkg.org.slug, "demo-u");
  assert.equal(pkg.terms.length, 1);
  assert.equal(pkg.terms[0].slug, "summer-2026");
  assert.ok(pkg.users.length >= 33 && pkg.users.length <= 36, `Expected users count to be between 33 and 36, got ${pkg.users.length}`);
  assert.ok(pkg.courses.length >= 1 && pkg.courses.length <= 4, `Expected courses count to be between 1 and 4, got ${pkg.courses.length}`);
  assert.equal(pkg.courses[0].code, "ECON-241");
});

test("exactly one current term, dates do not violate timeline", () => {
  const pkg = v0DemoWorld.currentSchema.package;
  const currentTerms = pkg.terms.filter((t) => t.current);
  assert.equal(currentTerms.length, 1, "exactly one term must be current");

  const term = pkg.terms[0];
  assert.ok(term.startsAt < term.endsAt, "term ends before it starts");

  // June 9 2026 must fall within the term
  const demoDay = "2026-06-09";
  assert.ok(term.startsAt <= demoDay && demoDay <= term.endsAt, "Demo day must fall within current term");
});

test("objective weights sum to 1.0", () => {
  const course = v0DemoWorld.currentSchema.package.courses[0];
  const totalObjWeight = course.objectives.reduce((sum, o) => sum + o.assessmentWeight, 0);
  assert.ok(Math.abs(totalObjWeight - 1.0) < 0.01, `Objectives weights sum to ${totalObjWeight}, expected 1.0`);
});

test("rubric weights sum to 100", () => {
  const r = v0DemoWorld.v0.rubric;
  const totalWeight = r.criteria.reduce((sum, c) => sum + c.weight, 0);
  assert.equal(totalWeight, 100, `Rubric weights sum to ${totalWeight}, expected 100`);
});

test("course pages have 300-800 words and no placeholders", () => {
  const course = v0DemoWorld.currentSchema.package.courses[0];
  assert.ok(course.pages.length >= 12, "expected at least 12 pages");
  for (const page of course.pages) {
    const words = page.bodyMd.split(/\s+/).filter(Boolean).length;
    assert.ok(words >= 300 && words <= 800, `Page ${page.slug} has ${words} words, expected 300-800`);
    assert.ok(!page.bodyMd.includes("TODO"), `Page ${page.slug} has TODOs`);
    assert.ok(!page.bodyMd.includes("lorem ipsum"), `Page ${page.slug} has placeholder text`);
  }
});

test("exam scores sum to totals and have valid distribution", () => {
  const exam = v0DemoWorld.v0.examRecord;
  const scores = exam.studentScores;

  // check topic sums
  for (const s of scores) {
    const topicSum = Object.values(s.topicScores).reduce((sum, val) => sum + val, 0);
    assert.equal(topicSum, s.totalScore, `Topic sum mismatch for student ${s.studentKey}`);
  }

  // check statistics
  const scoreList = scores.map((s) => s.totalScore);
  const mean = scoreList.reduce((sum, v) => sum + v, 0) / scoreList.length;
  const variance = scoreList.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / scoreList.length;
  const sd = Math.sqrt(variance);

  assert.ok(mean >= 72 && mean <= 76, `Mean is ${mean.toFixed(2)}, expected 74 +/- 2`);
  assert.ok(sd >= 9 && sd <= 13, `Std Dev is ${sd.toFixed(2)}, expected 9-13`);

  // Outliers: at least two above 92 and two below 60
  const highScores = scoreList.filter((s) => s > 92);
  const lowScores = scoreList.filter((s) => s < 60);
  assert.ok(highScores.length >= 2, "Expected at least 2 students scored > 92");
  assert.ok(lowScores.length >= 2, "Expected at least 2 students scored < 60");
});

test("featured student elasticity scores and side note triggers are canonical", () => {
  const exam = v0DemoWorld.v0.examRecord;
  const mayaScoreObj = exam.studentScores.find((s) => s.studentKey === "maya")!;
  assert.equal(mayaScoreObj.topicScores.elasticity, 4, "Featured student must get 4/12 on elasticity topic");
  assert.equal(12 - mayaScoreObj.topicScores.elasticity, 8, "Featured student must lose exactly 8 points on elasticity");

  // check side note topic source exists
  const sideNote = v0DemoWorld.v0.sideNoteCards.find((c) => c.topic === "elasticity")!;
  assert.ok(sideNote, "Expected elasticity side note");
  assert.ok(sideNote.text.includes("Elasticity cost you 8 of 12 points on Exam 1"), "Side note should reference Exam 1 score");
});

test("evidence quotes match verbatim against turn text offsets", () => {
  const turns = v0DemoWorld.v0.turns;
  const spans = v0DemoWorld.v0.evidenceSpans;

  assert.ok(spans.length >= 124, `Expected at least 124 evidence spans, got ${spans.length}`);

  for (const span of spans) {
    const turn = turns.find((t) => t.id === span.turnId);
    assert.ok(turn, `Turn ${span.turnId} not found`);
    const part = turn.parts[0];
    assert.equal(part.type, "text");
    const text = part.text as string;
    const extracted = text.slice(span.charStart, span.charEnd);
    assert.equal(extracted, span.quote, `Verbatim quote mismatch for span ${span.id}`);
  }
});

test("scoring evidence uses student turns only", () => {
  const turns = v0DemoWorld.v0.turns;
  const spans = v0DemoWorld.v0.evidenceSpans;

  for (const span of spans) {
    const turn = turns.find((t) => t.id === span.turnId)!;
    assert.equal(turn.role, "user", `Scoring evidence must be student turns (user role), got ${turn.role}`);
  }
});

test("journey reports and class rollup are correctly computed", () => {
  const reports = v0DemoWorld.v0.journeyReports;
  const rollup = v0DemoWorld.v0.classRollup;
  const spans = v0DemoWorld.v0.evidenceSpans;
  const sideNotes = v0DemoWorld.v0.sideNoteCards;
  const turns = v0DemoWorld.v0.turns;

  assert.equal(reports.length, 31, "expected 31 completed student journey reports");
  assert.equal(rollup.deterministicStats.confusionCount, 14, "expected 14 students confusing elasticity with slope");
  assert.equal(rollup.deterministicStats.completedStudentSessions, 31);

  // Assert schema-linkage fields on reports
  for (const r of reports) {
    assert.ok(r.assignmentId, "assignmentId must be defined");
    assert.ok(r.sessionAssignmentId, "sessionAssignmentId must be defined");
    assert.ok(r.rubricId, "rubricId must be defined");
    
    // Assert overall score math
    let sumScores = 0;
    for (const c of Object.values(r.scores)) {
      sumScores += c.score;
    }
    assert.equal(r.overallScore, sumScores, `overallScore should be the sum of criteria scores. Student: ${r.userId}`);
  }

  // Assert evidence spans schema fields
  for (const span of spans) {
    assert.equal(span.verified, true);
    assert.equal(span.speaker, "user");
    const turn = turns.find((t) => t.id === span.turnId)!;
    assert.ok(turn, "evidence span must reference an existing turn");
    if (span.previousTurnId) {
      assert.ok(span.surroundingTurnRefs?.includes(span.previousTurnId));
    }
    if (span.nextTurnId) {
      assert.ok(span.surroundingTurnRefs?.includes(span.nextTurnId));
    }
  }

  // Assert side note cards schema fields
  for (const card of sideNotes) {
    assert.ok(card.sourcePageSlug, "side note must have sourcePageSlug");
    assert.ok(card.sourceRefs.includes(card.sourcePageSlug), "sourceRefs must contain sourcePageSlug");
  }

  // Assert turns schema fields
  for (const turn of turns) {
    assert.ok(turn.text, "turn must have direct text field");
    assert.equal(turn.text, (turn.parts[0] as { text?: unknown }).text);
  }

  // Dynamic rollup checks
  const archetypeCounts: Record<string, number> = { Strong: 0, Steady: 0, Struggling: 0, Delegator: 0, Recoverer: 0 };
  const criterionCounts: Record<string, Record<string, number>> = {
    framing: { Exceeds: 0, Meets: 0, Developing: 0, Missing: 0 },
    grounding: { Exceeds: 0, Meets: 0, Developing: 0, Missing: 0 },
    iteration: { Exceeds: 0, Meets: 0, Developing: 0, Missing: 0 },
    final_design: { Exceeds: 0, Meets: 0, Developing: 0, Missing: 0 },
  };

  for (const report of reports) {
    const profile = v0DemoWorld.v0.studentProfiles.find((p) => p.userId === report.userId)!;
    archetypeCounts[profile.archetype]++;
    for (const cKey of ["framing", "grounding", "iteration", "final_design"]) {
      const lvl = report.scores[cKey].level;
      criterionCounts[cKey][lvl]++;
    }
  }

  for (const key of Object.keys(archetypeCounts)) {
    assert.equal(rollup.deterministicStats.archetypeCounts[key], archetypeCounts[key]);
  }

  for (const cKey of Object.keys(criterionCounts)) {
    for (const lvl of Object.keys(criterionCounts[cKey])) {
      assert.equal(rollup.deterministicStats.criterionCounts[cKey][lvl], criterionCounts[cKey][lvl]);
    }
  }
});

test("delegator students have low framing and low iteration", () => {
  const reports = v0DemoWorld.v0.journeyReports;
  const sofiaProfile = v0DemoWorld.v0.studentProfiles.find((p) => p.key === "sofia")!;
  const sofiaReport = reports.find((r) => r.userId === sofiaProfile.userId)!;
  const sofiaIteration = sofiaReport.scores.iteration.level;
  assert.equal(sofiaIteration, "Missing", "delegator should have Missing iteration");
});

test("active course conditions are correctly seeded", () => {
  const pkg = v0DemoWorld.currentSchema.package;
  
  // 1. ECON-241 is the first course seeded
  assert.ok(pkg.courses.length >= 1 && pkg.courses.length <= 4, `Expected courses count to be between 1 and 4, got ${pkg.courses.length}`);
  assert.equal(pkg.courses[0].code, "ECON-241");
  
  // 2. Professor login exists for Dr. Amara Osei
  const instructor = pkg.users.find((u) => u.role === "instructor" && u.key === "amara");
  assert.ok(instructor);
  assert.equal(instructor!.key, "amara");
  assert.equal(instructor!.name, "Dr. Amara Osei");
  
  // 3. Nonzero work waiting to grade & missing states
  const submissions = pkg.courses[0].submissions;
  const sessionSubmissions = submissions.filter((s) => s.assignmentKey === "session-assignment");
  
  const waitingToGrade = sessionSubmissions.filter((s) => s.state === "submitted");
  const missing = sessionSubmissions.filter((s) => s.state === "missing");
  
  assert.ok(waitingToGrade.length > 0, "should have active submissions waiting to grade");
  assert.ok(missing.length > 0, "should have missing student submissions");
  
  // 4. Exam 1 remains fully graded
  const examSubmissions = submissions.filter((s) => s.assignmentKey === "exam-1");
  assert.equal(examSubmissions.length, 31);
  assert.ok(examSubmissions.every((s) => s.state === "graded"), "Exam 1 must be fully graded");
  
  // 5. Latest note exists and is current (dayOffset: 43)
  const currentAnnouncement = pkg.courses[0].announcements.find((a) => a.dayOffset === 43 && a.title.includes("Reminders"));
  assert.ok(currentAnnouncement, "Active Pricing Session Reminders announcement must exist at dayOffset 43");
});
