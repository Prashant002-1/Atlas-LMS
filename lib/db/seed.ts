/**
 * Seed the v0 demo data package: one university, one ECON course, 31 students,
 * completed journey sessions, proposals, and rollups. Deterministic: every row
 * id derives from a stable key, so re-seeding is idempotent across environments.
 *
 *   npm run db:seed   (requires DATABASE_URL and a pushed schema)
 *
 * Sign in afterwards: instructor@demo.edu / student@demo.edu (password atlas1234,
 * same for every account in the package).
 */
import "./env-loader";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { eq } from "drizzle-orm";
import {
  agentMemories,
  announcements,
  assignments,
  contentAlignments,
  courseAiPolicies,
  courses,
  enrollments,
  learningObjectives,
  modules,
  organizations,
  pages,
  terms,
  users,
  submissions,
  agentSessions,
  agentTurns,
  changeProposals,
  proposalBlocks,
  rubrics,
  sessionAssignments,
  sessionArtifactStates,
  sessionSideNotes,
  sessionSubmissions,
  evidenceSpans,
  journeyReports,
  classRollups,
  orgAgentPolicies,
} from "./schema";
import { demoPackage } from "./fixtures/package";
import {
  agentSessions as v0AgentSessions,
  agentTurns as v0AgentTurns,
  changeProposals as v0ChangeProposals,
  proposalBlocks as v0ProposalBlocks,
  artifactStates as v0ArtifactStates,
  rubric as v0Rubric,
  sessionAssignment as v0SessionAssignment,
  sideNoteCards as v0SideNoteCards,
  studentSessions as v0StudentSessions,
  turns as v0Turns,
  evidenceSpans as v0EvidenceSpans,
  journeyReports as v0JourneyReports,
  classRollup as v0ClassRollup,
} from "./fixtures/v0-demo-world";
import type { FixtureCourse } from "./fixtures/types";
import { normalizeSessionTranscript } from "../agent/transcript";
import { orgAgentPolicySchema } from "../agent/org-policy";
import { buildRollupNarrative, computeClassRollupStats } from "../agent/rollup";
import { hashPassword } from "../auth/password";

/** Deterministic UUID from a stable key (sha256 → UUID v4 shape). */
function idFor(key: string): string {
  const h = createHash("sha256").update(`atlas-demo:${key}`).digest("hex");
  return [
    h.slice(0, 8),
    h.slice(8, 12),
    `4${h.slice(13, 16)}`,
    ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16) + h.slice(17, 20),
    h.slice(20, 32),
  ].join("-");
}

const DAY = 24 * 60 * 60 * 1000;

function weekEnd(termStart: Date, week: number): Date {
  // End of the 1-based week: start + week*7 days − 1 minute (Sunday 23:59).
  return new Date(termStart.getTime() + week * 7 * DAY - 60 * 1000);
}

type Db = (typeof import("./index"))["db"];
type ChangeProposalInsert = typeof changeProposals.$inferInsert;
type ProposalBlockInsert = typeof proposalBlocks.$inferInsert;
type AgentSessionInsert = typeof agentSessions.$inferInsert;
type AgentTurnInsert = typeof agentTurns.$inferInsert;

async function main() {
  loadLocalEnv();
  const { db } = await import("./index");

  const pkg = demoPackage;
  const orgId = idFor(`org:${pkg.org.slug}`);

  // Idempotent reset of the demo tenant only.
  await db.delete(organizations).where(eq(organizations.slug, pkg.org.slug));
  await db.insert(organizations).values({ id: orgId, name: pkg.org.name, slug: pkg.org.slug });

  /* terms */
  await db.insert(terms).values(
    pkg.terms.map((t) => ({
      id: idFor(`term:${t.slug}`),
      orgId,
      slug: t.slug,
      name: t.name,
      startsAt: new Date(`${t.startsAt}T00:00:00Z`),
      endsAt: new Date(`${t.endsAt}T23:59:00Z`),
      current: Boolean(t.current),
    }))
  );

  /* users */
  const passwordHash = await hashPassword(pkg.password);
  await db.insert(users).values(
    pkg.users.map((u) => ({
      id: idFor(`user:${u.key}`),
      orgId,
      name: u.name,
      email: u.email,
      role: u.role,
      passwordHash,
    }))
  );

  /* university policy for the student agent (ADR-0016) */
  const orgPolicy = orgAgentPolicySchema.parse({
    schemaVersion: 1,
    studentAgentEnabled: true,
    authorityLabel: "Office of Student Success",
    statement:
      "Demo University provides Atlas to support your learning. Use it to understand course material, plan your studying, and read your own record. Work you submit must be your own; each course's rules decide how AI may be used for that course's work.",
    permittedUses: [
      "Explaining published course material",
      "Planning and organizing study time",
      "Reviewing your own grades, feedback, and standing",
      "Practicing and checking your understanding before assessments",
    ],
    prohibitedUses: [
      "Producing work you submit as your own, in any course",
      "Working around a course rule or an assignment's conditions",
      "Attempting to make Atlas act outside its purpose",
      "Requesting another student's records or information",
    ],
    disclosureRequirement: "per_course",
    dataNotice:
      "Conversations stay inside Demo University's Atlas record and are not used to train models.",
    notASubstitute:
      "Atlas is not a substitute for your professors, academic advisors, counselors, or medical professionals.",
    escalationContacts: [
      { label: "Academic advising", contact: "advising@demo.edu" },
      { label: "Counseling and wellness", contact: "wellness@demo.edu" },
    ],
    dailyTurnLimit: 150,
  });
  await db.insert(orgAgentPolicies).values({
    id: idFor("orgAgentPolicy:demo:1"),
    orgId,
    version: 1,
    schemaVersion: 1,
    policy: orgPolicy,
    changeSummary: "Initial university policy",
    createdById: null,
  });

  /* courses */
  let submissionCount = 0;
  for (const course of pkg.courses) {
    await seedCourse(db, orgId, course);
    submissionCount += course.submissions.length;
  }

  /* the student agent's durable observations about the featured student */
  const econCourse = pkg.courses[0];
  const econCourseId = idFor(`course:${econCourse.code}:${econCourse.termSlug}`);
  await db.insert(agentMemories).values([
    {
      id: idFor("memory:maya:elasticity"),
      orgId,
      userId: idFor("user:maya"),
      profile: "student",
      kind: "gap",
      courseId: econCourseId,
      content: "Loses points turning elasticity intuition into calculations; Exam 1 elasticity was 4/12 while other topics held.",
      status: "active",
    },
    {
      id: idFor("memory:maya:worked-examples"),
      orgId,
      userId: idFor("user:maya"),
      profile: "student",
      kind: "preference",
      courseId: null,
      content: "Learns fastest from one worked example before trying a problem alone.",
      status: "active",
    },
    {
      id: idFor("memory:maya:goal"),
      orgId,
      userId: idFor("user:maya"),
      profile: "student",
      kind: "goal",
      courseId: econCourseId,
      content: "Wants to bring the ECON-241 standing up before Exam 2 by fixing the elasticity gap.",
      status: "active",
    },
  ]);

  function convertDates<T extends Record<string, unknown>>(rows: T[]): T[] {
    return rows.map((row) => {
      const nextRow: Record<string, unknown> = { ...row };
      for (const key of ["createdAt", "updatedAt", "decidedAt"]) {
        if (typeof nextRow[key] === "string") {
          nextRow[key] = new Date(nextRow[key]);
        }
      }
      return nextRow as T;
    });
  }

  /* V0 specific agent/proposal seeding */
  if (v0ChangeProposals.length) {
    await db.insert(changeProposals).values(convertDates(v0ChangeProposals) as ChangeProposalInsert[]);
  }
  if (v0ProposalBlocks.length) {
    await db.insert(proposalBlocks).values(convertDates(v0ProposalBlocks) as ProposalBlockInsert[]);
  }
  if (v0AgentSessions.length) {
    await db.insert(agentSessions).values(convertDates(v0AgentSessions) as AgentSessionInsert[]);
  }
  if (v0AgentTurns.length) {
    const convertedTurns = convertDates(v0AgentTurns);
    for (let i = 0; i < convertedTurns.length; i += 50) {
      await db.insert(agentTurns).values(convertedTurns.slice(i, i + 50) as AgentTurnInsert[]);
    }
  }

  /* v0 session primitives: rubric, per-assignment contract, artifact states,
     side notes, and frozen submissions for the already-completed sessions.
     Same fixture payloads the tests validate, landed as queryable rows. */
  await db.insert(rubrics).values({
    id: v0Rubric.id,
    orgId: v0Rubric.orgId,
    courseId: v0Rubric.courseId,
    version: v0Rubric.version,
    criteria: v0Rubric.criteria,
  });

  await db.insert(sessionAssignments).values({
    id: v0SessionAssignment.id,
    orgId: v0SessionAssignment.orgId,
    courseId: v0SessionAssignment.courseId,
    assignmentId: v0SessionAssignment.assignmentId,
    rubricId: v0Rubric.id,
    instructions: v0SessionAssignment.instructions,
    durationMinutes: v0SessionAssignment.durationMinutes,
    groundingScope: v0SessionAssignment.groundingScope,
    personalRecordSideNotes: v0SessionAssignment.personalRecordSideNotes,
    sideNoteTriggers: v0SessionAssignment.sideNoteTriggers,
    planningSessionId: v0SessionAssignment.planningSessionId,
  });

  if (v0ArtifactStates.length) {
    const artifactRows = v0ArtifactStates.map((state) => ({
      id: state.id,
      orgId: state.orgId,
      sessionId: state.sessionId,
      turnIndex: state.turnIndex,
      artifactType: state.artifactType,
      state: state.state,
      createdAt: new Date(state.createdAt),
    }));
    for (let i = 0; i < artifactRows.length; i += 50) {
      await db.insert(sessionArtifactStates).values(artifactRows.slice(i, i + 50));
    }
  }

  if (v0SideNoteCards.length) {
    await db.insert(sessionSideNotes).values(
      v0SideNoteCards.map((card) => ({
        id: card.id,
        orgId: card.orgId,
        sessionId: card.sessionId,
        turnIndex: card.turnIndex,
        topic: card.topic,
        text: card.text,
        sourceRefs: card.sourceRefs,
        sourcePageSlug: card.sourcePageSlug ?? null,
        createdAt: new Date(card.createdAt),
      }))
    );
  }

  // Frozen session submissions mirror the gradebook: every seeded student whose
  // session-assignment submission is submitted or graded gets the normalized
  // transcript of their stored session, exactly what the grading pipeline reads.
  const econ = pkg.courses[0];
  const sessionStateByUserId = new Map<string, "submitted" | "graded">();
  for (const sub of econ.submissions) {
    if (sub.assignmentKey !== "session-assignment" || sub.state === "missing") continue;
    sessionStateByUserId.set(idFor(`user:${sub.studentKey}`), sub.state);
  }

  const submissionRows = [];
  for (const studentSession of v0StudentSessions) {
    const state = sessionStateByUserId.get(studentSession.userId);
    if (!state) continue;
    const sessionTurns = v0Turns.filter((turn) => turn.sessionId === studentSession.id);
    const sessionArtifacts = v0ArtifactStates.filter((s) => s.sessionId === studentSession.id);
    const transcript = normalizeSessionTranscript(
      sessionTurns.map((turn) => ({ id: turn.id, turnIndex: turn.turnIndex, role: turn.role, parts: turn.parts })),
      sessionArtifacts.map((s) => ({ id: s.id, turnIndex: s.turnIndex, artifactType: s.artifactType, state: s.state }))
    );
    submissionRows.push({
      id: idFor(`sessionSubmission:${studentSession.id}`),
      orgId: studentSession.orgId,
      sessionId: studentSession.id,
      assignmentId: v0SessionAssignment.assignmentId,
      courseId: studentSession.courseId,
      userId: studentSession.userId,
      status: state,
      transcript: transcript.turns,
      finalArtifact: transcript.finalArtifact,
      turnCount: transcript.turnCount,
      rubricId: v0Rubric.id,
      rubricVersion: v0Rubric.version,
      submittedAt: new Date(studentSession.updatedAt),
    });
  }
  for (let i = 0; i < submissionRows.length; i += 25) {
    await db.insert(sessionSubmissions).values(submissionRows.slice(i, i + 25));
  }

  /* Phase 3 grading rows: verified evidence spans and journey reports for
     every frozen session, then a class rollup computed through the SAME
     deterministic aggregation the live pipeline uses. Reports are `final`
     where the gradebook shows a grade and `draft` where the submission is
     still waiting on the professor. The three students whose work is missing
     have no submission, so no report: when they submit live, the real
     pipeline grades them. */
  const submissionIdBySession = new Map(submissionRows.map((row) => [row.sessionId, row.id]));

  const spanRows = v0EvidenceSpans
    .filter((span) => submissionIdBySession.has(span.sessionId))
    .map((span) => ({
      id: span.id,
      orgId: span.orgId,
      sessionId: span.sessionId,
      submissionId: submissionIdBySession.get(span.sessionId)!,
      turnId: span.turnId,
      criterionKey: span.criterionKey,
      charStart: span.charStart,
      charEnd: span.charEnd,
      quote: span.quote,
      verified: span.verified,
      speaker: span.speaker,
      previousTurnId: span.previousTurnId ?? null,
      nextTurnId: span.nextTurnId ?? null,
    }));
  for (let i = 0; i < spanRows.length; i += 50) {
    await db.insert(evidenceSpans).values(spanRows.slice(i, i + 50));
  }

  const reportRows = v0JourneyReports
    .filter((report) => submissionIdBySession.has(report.sessionId))
    .map((report) => ({
      id: report.id,
      orgId: report.orgId,
      submissionId: submissionIdBySession.get(report.sessionId)!,
      sessionId: report.sessionId,
      userId: report.userId,
      courseId: report.courseId,
      assignmentId: report.assignmentId,
      rubricId: report.rubricId,
      rubricVersion: report.rubricVersion,
      scores: report.scores,
      overallScore: report.overallScore,
      status: (sessionStateByUserId.get(report.userId) === "graded" ? "final" : "draft") as "final" | "draft",
      graderLabel: "seed",
      createdAt: new Date(report.createdAt),
    }));
  for (let i = 0; i < reportRows.length; i += 25) {
    await db.insert(journeyReports).values(reportRows.slice(i, i + 25));
  }

  const rollupStats = computeClassRollupStats({
    reports: reportRows.map((row) => ({ scores: row.scores, overallScore: row.overallScore, reviewRequestedAt: null })),
    submittedSessions: submissionRows.length,
    sideNotes: v0SideNoteCards
      .filter((card) => submissionIdBySession.has(card.sessionId))
      .map((card) => ({ sessionId: card.sessionId, topic: card.topic })),
  });
  await db.insert(classRollups).values({
    id: v0ClassRollup.id,
    orgId,
    courseId: v0ClassRollup.courseId,
    assignmentId: v0SessionAssignment.assignmentId,
    stats: rollupStats,
    narrativeDraft: buildRollupNarrative(rollupStats),
    recommendedPracticeSet: v0ClassRollup.recommendedPracticeSet,
  });

  console.log(
    `Seeded ${pkg.org.name}: ${pkg.terms.length} terms, ${pkg.users.length} users, ${pkg.courses.length} courses, ${submissionCount} submissions, ${submissionRows.length} frozen sessions, ${reportRows.length} journey reports, ${spanRows.length} evidence spans.`
  );
  console.log(`Sign in: instructor@demo.edu or student@demo.edu · password "${pkg.password}".`);
  process.exit(0);
}

async function seedCourse(db: Db, orgId: string, c: FixtureCourse) {
  const term = demoPackage.terms.find((t) => t.slug === c.termSlug);
  if (!term) throw new Error(`Course ${c.code}: unknown term ${c.termSlug}`);
  const termStart = new Date(`${term.startsAt}T00:00:00Z`);
  const ck = `${c.code}:${c.termSlug}`;
  const courseId = idFor(`course:${ck}`);

  await db.insert(courses).values({
    id: courseId,
    orgId,
    code: c.code,
    name: c.name,
    term: term.name,
    termId: idFor(`term:${term.slug}`),
    description: c.description,
    syllabusMd: c.syllabusMd,
    status: c.status,
    createdById: idFor(`user:${c.instructorKey}`),
    startDate: termStart,
    endDate: new Date(`${term.endsAt}T23:59:00Z`),
  });

  /* objectives */
  const objectiveIdByCode = new Map<string, string>();
  if (c.objectives.length) {
    await db.insert(learningObjectives).values(
      c.objectives.map((o) => {
        const id = idFor(`objective:${ck}:${o.code}`);
        objectiveIdByCode.set(o.code, id);
        return {
          id,
          orgId,
          courseId,
          code: o.code,
          description: o.description,
          bloomLevel: o.bloomLevel,
          assessmentWeight: o.assessmentWeight,
        };
      })
    );
  }

  const alignmentRows: Array<typeof contentAlignments.$inferInsert> = [];
  const align = (itemType: "module" | "assignment" | "page", itemKey: string, itemId: string, codes?: string[]) => {
    for (const code of codes ?? []) {
      const objectiveId = objectiveIdByCode.get(code);
      if (!objectiveId) throw new Error(`Course ${ck}: ${itemType} ${itemKey} references unknown objective ${code}`);
      alignmentRows.push({
        id: idFor(`alignment:${ck}:${itemType}:${itemKey}:${code}`),
        orgId,
        objectiveId,
        itemType,
        itemId,
        weight: 1,
      });
    }
  };

  /* modules */
  if (c.modules.length) {
    await db.insert(modules).values(
      c.modules.map((m) => {
        const id = idFor(`module:${ck}:${m.key}`);
        align("module", m.key, id, m.objectiveCodes);
        return {
          id,
          orgId,
          courseId,
          name: m.name,
          summaryMd: m.summaryMd,
          position: m.week,
          unlockAt: new Date(termStart.getTime() + (m.week - 1) * 7 * DAY),
          published: m.published,
        };
      })
    );
  }

  /* assignments */
  const assignmentById = new Map<string, { id: string; dueAt: Date }>();
  if (c.assignments.length) {
    await db.insert(assignments).values(
      c.assignments.map((a, index) => {
        const id = idFor(`assignment:${ck}:${a.key}`);
        const dueAt = weekEnd(termStart, a.dueWeek);
        assignmentById.set(a.key, { id, dueAt });
        align("assignment", a.key, id, a.objectiveCodes);
        return {
          id,
          orgId,
          courseId,
          name: a.name,
          descriptionMd: a.descriptionMd,
          dueAt,
          pointsPossible: a.pointsPossible,
          position: index + 1,
          published: a.published,
        };
      })
    );
  }

  /* pages */
  if (c.pages.length) {
    await db.insert(pages).values(
      c.pages.map((p) => {
        const id = idFor(`page:${ck}:${p.slug}`);
        align("page", p.slug, id, p.objectiveCodes);
        return {
          id,
          orgId,
          courseId,
          slug: p.slug,
          title: p.title,
          bodyMd: p.bodyMd,
          published: true,
        };
      })
    );
  }

  /* announcements */
  if (c.announcements.length) {
    await db.insert(announcements).values(
      c.announcements.map((n, index) => ({
        id: idFor(`announcement:${ck}:${index}`),
        orgId,
        courseId,
        authorId: idFor(`user:${c.instructorKey}`),
        title: n.title,
        messageMd: n.messageMd,
        postedAt: new Date(termStart.getTime() + n.dayOffset * DAY + 9 * 60 * 60 * 1000),
        published: true,
      }))
    );
  }

  if (alignmentRows.length) {
    await db.insert(contentAlignments).values(alignmentRows);
  }

  /* enrollments */
  if (c.enrollments.length) {
    await db.insert(enrollments).values(
      c.enrollments.map((e) => ({
        id: idFor(`enrollment:${ck}:${e.userKey}:${e.role}`),
        orgId,
        courseId,
        userId: idFor(`user:${e.userKey}`),
        role: e.role,
        state: "active",
        // Demo posture: students in signal-sharing courses arrive opted in.
        aiShareOptIn: e.role === "student" && c.policy.shareStruggleSignal,
        currentScore: e.currentScore,
        currentGrade: e.currentGrade,
      }))
    );
  }

  /* submissions */
  if (c.submissions.length) {
    await db.insert(submissions).values(
      c.submissions.map((s) => {
        const assignment = assignmentById.get(s.assignmentKey);
        if (!assignment) throw new Error(`Course ${ck}: submission references unknown assignment ${s.assignmentKey}`);
        const submittedAt =
          s.state === "missing" ? null : new Date(assignment.dueAt.getTime() + (s.dayOffsetFromDue ?? 0) * DAY);
        const gradedAt = s.state === "graded" ? new Date(assignment.dueAt.getTime() + 4 * DAY) : null;
        return {
          orgId,
          assignmentId: assignment.id,
          courseId,
          userId: idFor(`user:${s.studentKey}`),
          submittedAt,
          gradedAt,
          score: s.state === "graded" ? s.score : null,
          grade: s.state === "graded" ? (s.grade ?? null) : null,
          late: Boolean(submittedAt && submittedAt.getTime() > assignment.dueAt.getTime()),
          missing: s.state === "missing",
          workflowState: s.state === "graded" ? "graded" : s.state === "missing" ? "unsubmitted" : "submitted",
          submissionType: s.body ? "text" : null,
          body: s.body ?? null,
          topicScores: s.topicScores ?? null,
        };
      })
    );
  }

  /* AI policy */
  await db.insert(courseAiPolicies).values({
    id: idFor(`policy:${ck}`),
    orgId,
    courseId,
    allowExplain: c.policy.allowExplain,
    allowPractice: c.policy.allowPractice,
    allowQuestions: c.policy.allowQuestions,
    explanationDepth: c.policy.explanationDepth,
    citationsRequired: c.policy.citationsRequired,
    personaName: c.policy.personaName ?? null,
    personaStyle: c.policy.personaStyle ?? null,
    customInstructions: c.policy.customInstructions ?? null,
    studentDailyLimit: c.policy.studentDailyLimit,
    shareStruggleSignal: c.policy.shareStruggleSignal,
  });
}

function loadLocalEnv() {
  if (process.env.DATABASE_URL) return;
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=["']?([^"']*)["']?$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
