import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { tool, type LanguageModel } from "ai";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  agentSessions,
  announcements,
  assignments,
  changeProposals,
  classRollups,
  courseAiPolicies,
  courses,
  enrollments,
  files,
  journeyReports,
  moduleItems,
  modules,
  pages,
  practiceSets,
  quizzes,
  rubrics,
  sessionAssignments,
  sessionSubmissions,
  submissions,
  users,
} from "@/lib/db/schema";
import { applyProposal, dismissProposal } from "@/lib/agent/apply";
import { gradeLetterFor, runGradingForSubmission } from "@/lib/agent/grading";
import { gradeBandsForCourse } from "@/lib/course/policies";
import { loadAtlasSkill } from "@/lib/agent/atlas-harness";
import { practiceQuestionSchema } from "@/lib/agent/blocks";
import { recomputeClassRollup } from "@/lib/agent/rollup";
import { parseJourneyScores, parseRubricCriteria } from "@/lib/agent/session-parts";
import { renderFinalArtifactBody } from "@/lib/agent/transcript";
import { summarizeGradeDistribution } from "@/lib/agent/gradebook-analysis";
import { professorTools } from "@/lib/agent/professor-tools";
import type { ProfessorScope } from "@/lib/agent/professor-context";

/**
 * Atlas treats the LMS as the professor's operating system. These tools expose
 * the course's records, roster, gradebook, submissions, assessed sessions, and
 * ordinary course operations through typed calls. Authorization is structural:
 * every executor receives the authenticated organization and course scope and
 * repeats it in each query or mutation.
 */

const MAX_ROWS = 100;
const DEFAULT_ROWS = 30;

const clip = (value: string | null | undefined, max = 1200) => {
  if (!value) return "";
  return value.length <= max ? value : `${value.slice(0, max)}...`;
};

const iso = (value: Date | null | undefined) => value?.toISOString() ?? null;

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error("The date is invalid.");
  return parsed;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function letterGrade(score: number): string {
  if (score >= 93) return "A";
  if (score >= 90) return "A-";
  if (score >= 87) return "B+";
  if (score >= 83) return "B";
  if (score >= 80) return "B-";
  if (score >= 77) return "C+";
  if (score >= 73) return "C";
  if (score >= 70) return "C-";
  if (score >= 67) return "D+";
  if (score >= 63) return "D";
  if (score >= 60) return "D-";
  return "F";
}

const inspectLmsSchema = z.object({
  resource: z.enum([
    "overview",
    "course",
    "students",
    "assignments",
    "modules",
    "module_items",
    "pages",
    "files",
    "announcements",
    "quizzes",
    "practice_sets",
    "submissions",
    "sessions",
    "class_results",
    "rubrics",
    "policies",
    "calendar",
    "drafts",
    "threads",
  ]),
  ids: z.array(z.string().uuid()).max(20).optional(),
  query: z.string().trim().min(1).max(160).optional(),
  assignmentId: z.string().uuid().optional(),
  moduleId: z.string().uuid().optional(),
  studentId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(MAX_ROWS).default(DEFAULT_ROWS),
});

type InspectLmsInput = z.infer<typeof inspectLmsSchema>;

export type LmsReadOutput =
  | { ok: true; resource: string; asOf: string; count: number; records: unknown[]; summary?: unknown }
  | { ok: false; error: string };

async function inspectOverview(scope: ProfessorScope): Promise<LmsReadOutput> {
  const [studentCount, assignmentCount, moduleCount, pageCount, fileCount, announcementCount, practiceCount, submissionCount, sessionCount, draftCount] =
    await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(enrollments).where(and(eq(enrollments.orgId, scope.orgId), eq(enrollments.courseId, scope.courseId), eq(enrollments.role, "student"), eq(enrollments.state, "active"))),
      db.select({ count: sql<number>`count(*)::int` }).from(assignments).where(and(eq(assignments.orgId, scope.orgId), eq(assignments.courseId, scope.courseId))),
      db.select({ count: sql<number>`count(*)::int` }).from(modules).where(and(eq(modules.orgId, scope.orgId), eq(modules.courseId, scope.courseId))),
      db.select({ count: sql<number>`count(*)::int` }).from(pages).where(and(eq(pages.orgId, scope.orgId), eq(pages.courseId, scope.courseId))),
      db.select({ count: sql<number>`count(*)::int` }).from(files).where(and(eq(files.orgId, scope.orgId), eq(files.courseId, scope.courseId))),
      db.select({ count: sql<number>`count(*)::int` }).from(announcements).where(and(eq(announcements.orgId, scope.orgId), eq(announcements.courseId, scope.courseId))),
      db.select({ count: sql<number>`count(*)::int` }).from(practiceSets).where(and(eq(practiceSets.orgId, scope.orgId), eq(practiceSets.courseId, scope.courseId))),
      db.select({ count: sql<number>`count(*)::int` }).from(submissions).where(and(eq(submissions.orgId, scope.orgId), eq(submissions.courseId, scope.courseId))),
      db.select({ count: sql<number>`count(*)::int` }).from(sessionSubmissions).where(and(eq(sessionSubmissions.orgId, scope.orgId), eq(sessionSubmissions.courseId, scope.courseId))),
      db.select({ count: sql<number>`count(*)::int` }).from(changeProposals).where(and(eq(changeProposals.orgId, scope.orgId), eq(changeProposals.courseId, scope.courseId), eq(changeProposals.status, "pending"))),
    ]);
  const summary = {
    students: Number(studentCount[0]?.count ?? 0),
    assignments: Number(assignmentCount[0]?.count ?? 0),
    modules: Number(moduleCount[0]?.count ?? 0),
    pages: Number(pageCount[0]?.count ?? 0),
    files: Number(fileCount[0]?.count ?? 0),
    announcements: Number(announcementCount[0]?.count ?? 0),
    practiceSets: Number(practiceCount[0]?.count ?? 0),
    submissionRows: Number(submissionCount[0]?.count ?? 0),
    sessionSubmissions: Number(sessionCount[0]?.count ?? 0),
    openDrafts: Number(draftCount[0]?.count ?? 0),
  };
  return { ok: true, resource: "overview", asOf: new Date().toISOString(), count: Object.keys(summary).length, records: [], summary };
}

async function findStudents(scope: ProfessorScope, input: InspectLmsInput) {
  const conditions: SQL[] = [
    eq(enrollments.orgId, scope.orgId),
    eq(enrollments.courseId, scope.courseId),
    eq(enrollments.role, "student"),
    eq(enrollments.state, "active"),
    eq(users.orgId, scope.orgId),
  ];
  if (input.ids?.length) conditions.push(inArray(users.id, input.ids));
  if (input.studentId) conditions.push(eq(users.id, input.studentId));
  if (input.query) conditions.push(or(ilike(users.name, `%${input.query}%`), ilike(users.email, `%${input.query}%`))!);
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      currentScore: enrollments.currentScore,
      currentGrade: enrollments.currentGrade,
      finalScore: enrollments.finalScore,
      finalGrade: enrollments.finalGrade,
      lastActivityAt: enrollments.lastActivityAt,
    })
    .from(enrollments)
    .innerJoin(users, eq(users.id, enrollments.userId))
    .where(and(...conditions))
    .orderBy(asc(users.name), asc(users.email))
    .limit(input.limit);
}

async function inspectLms(scope: ProfessorScope, input: InspectLmsInput): Promise<LmsReadOutput> {
  const asOf = new Date().toISOString();
  if (input.resource === "overview") return inspectOverview(scope);

  if (input.resource === "course") {
    const rows = await db
      .select({
        id: courses.id,
        code: courses.code,
        name: courses.name,
        term: courses.term,
        description: courses.description,
        syllabusMd: courses.syllabusMd,
        status: courses.status,
        startDate: courses.startDate,
        endDate: courses.endDate,
        timeZone: courses.timeZone,
        updatedAt: courses.updatedAt,
      })
      .from(courses)
      .where(and(eq(courses.id, scope.courseId), eq(courses.orgId, scope.orgId)))
      .limit(1);
    return { ok: true, resource: input.resource, asOf, count: rows.length, records: rows.map((row) => ({ ...row, startDate: iso(row.startDate), endDate: iso(row.endDate), updatedAt: iso(row.updatedAt) })) };
  }

  if (input.resource === "students") {
    const rows = await findStudents(scope, input);
    return {
      ok: true,
      resource: input.resource,
      asOf,
      count: rows.length,
      records: rows.map((row) => ({ ...row, lastActivityAt: iso(row.lastActivityAt) })),
    };
  }

  if (input.resource === "assignments") {
    const conditions: SQL[] = [eq(assignments.orgId, scope.orgId), eq(assignments.courseId, scope.courseId)];
    if (input.ids?.length) conditions.push(inArray(assignments.id, input.ids));
    if (input.assignmentId) conditions.push(eq(assignments.id, input.assignmentId));
    if (input.query) conditions.push(ilike(assignments.name, `%${input.query}%`));
    const rows = await db.select().from(assignments).where(and(...conditions)).orderBy(asc(assignments.position), asc(assignments.dueAt)).limit(input.limit);
    return {
      ok: true,
      resource: input.resource,
      asOf,
      count: rows.length,
      records: rows.map((row) => ({ ...row, descriptionMd: clip(row.descriptionMd, 4000), dueAt: iso(row.dueAt), unlockAt: iso(row.unlockAt), lockAt: iso(row.lockAt), createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt), embedding: undefined })),
    };
  }

  if (input.resource === "modules") {
    const conditions: SQL[] = [eq(modules.orgId, scope.orgId), eq(modules.courseId, scope.courseId)];
    if (input.ids?.length) conditions.push(inArray(modules.id, input.ids));
    if (input.query) conditions.push(ilike(modules.name, `%${input.query}%`));
    const rows = await db.select().from(modules).where(and(...conditions)).orderBy(asc(modules.position), asc(modules.createdAt)).limit(input.limit);
    return { ok: true, resource: input.resource, asOf, count: rows.length, records: rows.map((row) => ({ ...row, summaryMd: clip(row.summaryMd, 4000), unlockAt: iso(row.unlockAt), createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt), embedding: undefined })) };
  }

  if (input.resource === "module_items") {
    const conditions: SQL[] = [eq(moduleItems.orgId, scope.orgId), eq(moduleItems.courseId, scope.courseId)];
    if (input.ids?.length) conditions.push(inArray(moduleItems.id, input.ids));
    if (input.moduleId) conditions.push(eq(moduleItems.moduleId, input.moduleId));
    if (input.query) conditions.push(ilike(moduleItems.title, `%${input.query}%`));
    const rows = await db.select().from(moduleItems).where(and(...conditions)).orderBy(asc(moduleItems.position)).limit(input.limit);
    return { ok: true, resource: input.resource, asOf, count: rows.length, records: rows };
  }

  if (input.resource === "pages") {
    const conditions: SQL[] = [eq(pages.orgId, scope.orgId), eq(pages.courseId, scope.courseId)];
    if (input.ids?.length) conditions.push(inArray(pages.id, input.ids));
    if (input.query) conditions.push(or(ilike(pages.title, `%${input.query}%`), ilike(pages.bodyMd, `%${input.query}%`))!);
    const rows = await db.select().from(pages).where(and(...conditions)).orderBy(asc(pages.slug)).limit(input.limit);
    return { ok: true, resource: input.resource, asOf, count: rows.length, records: rows.map((row) => ({ ...row, bodyMd: clip(row.bodyMd, input.ids?.length ? 12_000 : 1600), updatedAt: iso(row.updatedAt), embedding: undefined })) };
  }

  if (input.resource === "files") {
    const conditions: SQL[] = [eq(files.orgId, scope.orgId), eq(files.courseId, scope.courseId)];
    if (input.ids?.length) conditions.push(inArray(files.id, input.ids));
    if (input.query) conditions.push(or(ilike(files.displayName, `%${input.query}%`), ilike(files.filename, `%${input.query}%`), ilike(files.extractedText, `%${input.query}%`))!);
    const rows = await db.select().from(files).where(and(...conditions)).orderBy(desc(files.createdAt)).limit(input.limit);
    return { ok: true, resource: input.resource, asOf, count: rows.length, records: rows.map((row) => ({ ...row, extractedText: clip(row.extractedText, input.ids?.length ? 12_000 : 1600), createdAt: iso(row.createdAt), embedding: undefined })) };
  }

  if (input.resource === "announcements") {
    const conditions: SQL[] = [eq(announcements.orgId, scope.orgId), eq(announcements.courseId, scope.courseId)];
    if (input.ids?.length) conditions.push(inArray(announcements.id, input.ids));
    if (input.query) conditions.push(or(ilike(announcements.title, `%${input.query}%`), ilike(announcements.messageMd, `%${input.query}%`))!);
    const rows = await db.select().from(announcements).where(and(...conditions)).orderBy(desc(announcements.postedAt)).limit(input.limit);
    return { ok: true, resource: input.resource, asOf, count: rows.length, records: rows.map((row) => ({ ...row, messageMd: clip(row.messageMd, 6000), postedAt: iso(row.postedAt) })) };
  }

  if (input.resource === "quizzes") {
    const conditions: SQL[] = [eq(quizzes.orgId, scope.orgId), eq(quizzes.courseId, scope.courseId)];
    if (input.ids?.length) conditions.push(inArray(quizzes.id, input.ids));
    if (input.assignmentId) conditions.push(eq(quizzes.assignmentId, input.assignmentId));
    if (input.query) conditions.push(or(ilike(quizzes.title, `%${input.query}%`), ilike(quizzes.descriptionMd, `%${input.query}%`))!);
    const rows = await db.select().from(quizzes).where(and(...conditions)).orderBy(asc(quizzes.dueAt)).limit(input.limit);
    return { ok: true, resource: input.resource, asOf, count: rows.length, records: rows.map((row) => ({ ...row, descriptionMd: clip(row.descriptionMd, 4000), dueAt: iso(row.dueAt) })) };
  }

  if (input.resource === "practice_sets") {
    const conditions: SQL[] = [eq(practiceSets.orgId, scope.orgId), eq(practiceSets.courseId, scope.courseId)];
    if (input.ids?.length) conditions.push(inArray(practiceSets.id, input.ids));
    if (input.query) conditions.push(ilike(practiceSets.title, `%${input.query}%`));
    const rows = await db.select().from(practiceSets).where(and(...conditions)).orderBy(asc(practiceSets.position), desc(practiceSets.createdAt)).limit(input.limit);
    return { ok: true, resource: input.resource, asOf, count: rows.length, records: rows.map((row) => ({ ...row, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt) })) };
  }

  if (input.resource === "submissions") {
    const conditions: SQL[] = [eq(submissions.orgId, scope.orgId), eq(submissions.courseId, scope.courseId)];
    if (input.assignmentId) conditions.push(eq(submissions.assignmentId, input.assignmentId));
    if (input.studentId) conditions.push(eq(submissions.userId, input.studentId));
    const rows = await db
      .select({
        assignmentId: submissions.assignmentId,
        assignmentName: assignments.name,
        studentId: submissions.userId,
        studentName: users.name,
        studentEmail: users.email,
        submittedAt: submissions.submittedAt,
        gradedAt: submissions.gradedAt,
        score: submissions.score,
        grade: submissions.grade,
        late: submissions.late,
        missing: submissions.missing,
        excused: submissions.excused,
        workflowState: submissions.workflowState,
        submissionType: submissions.submissionType,
        body: submissions.body,
        url: submissions.url,
        topicScores: submissions.topicScores,
      })
      .from(submissions)
      .innerJoin(assignments, eq(assignments.id, submissions.assignmentId))
      .innerJoin(users, eq(users.id, submissions.userId))
      .where(and(...conditions, eq(assignments.orgId, scope.orgId), eq(assignments.courseId, scope.courseId), eq(users.orgId, scope.orgId)))
      .orderBy(desc(submissions.submittedAt))
      .limit(input.limit);
    return { ok: true, resource: input.resource, asOf, count: rows.length, records: rows.map((row) => ({ ...row, submittedAt: iso(row.submittedAt), gradedAt: iso(row.gradedAt), body: clip(row.body, input.studentId && input.assignmentId ? 5000 : 800) })) };
  }

  if (input.resource === "sessions") {
    const conditions: SQL[] = [eq(sessionSubmissions.orgId, scope.orgId), eq(sessionSubmissions.courseId, scope.courseId)];
    if (input.ids?.length) conditions.push(inArray(sessionSubmissions.id, input.ids));
    if (input.assignmentId) conditions.push(eq(sessionSubmissions.assignmentId, input.assignmentId));
    if (input.studentId) conditions.push(eq(sessionSubmissions.userId, input.studentId));
    const includeDetails = Boolean(input.ids?.length || (input.assignmentId && input.studentId));
    const rows = await db
      .select({
        submissionId: sessionSubmissions.id,
        sessionId: sessionSubmissions.sessionId,
        assignmentId: sessionSubmissions.assignmentId,
        assignmentName: assignments.name,
        studentId: sessionSubmissions.userId,
        studentName: users.name,
        status: sessionSubmissions.status,
        turnCount: sessionSubmissions.turnCount,
        submittedAt: sessionSubmissions.submittedAt,
        transcript: sessionSubmissions.transcript,
        finalArtifact: sessionSubmissions.finalArtifact,
        reportId: journeyReports.id,
        reportStatus: journeyReports.status,
        overallScore: journeyReports.overallScore,
        scores: journeyReports.scores,
        reviewRequestedAt: journeyReports.reviewRequestedAt,
      })
      .from(sessionSubmissions)
      .innerJoin(assignments, eq(assignments.id, sessionSubmissions.assignmentId))
      .innerJoin(users, eq(users.id, sessionSubmissions.userId))
      .leftJoin(journeyReports, and(eq(journeyReports.submissionId, sessionSubmissions.id), eq(journeyReports.orgId, scope.orgId)))
      .where(and(...conditions, eq(assignments.orgId, scope.orgId), eq(assignments.courseId, scope.courseId), eq(users.orgId, scope.orgId)))
      .orderBy(desc(sessionSubmissions.submittedAt))
      .limit(input.limit);
    return {
      ok: true,
      resource: input.resource,
      asOf,
      count: rows.length,
      records: rows.map((row) => ({
        ...row,
        submittedAt: iso(row.submittedAt),
        reviewRequestedAt: iso(row.reviewRequestedAt),
        transcript: includeDetails && Array.isArray(row.transcript) ? row.transcript.slice(0, 120) : includeDetails ? row.transcript : undefined,
        finalArtifact: includeDetails ? row.finalArtifact : row.finalArtifact ? "available" : null,
        scores: parseJourneyScores(row.scores) ?? row.scores,
      })),
    };
  }

  if (input.resource === "class_results") {
    const conditions: SQL[] = [eq(classRollups.orgId, scope.orgId), eq(classRollups.courseId, scope.courseId), eq(assignments.orgId, scope.orgId), eq(assignments.courseId, scope.courseId)];
    if (input.assignmentId) conditions.push(eq(classRollups.assignmentId, input.assignmentId));
    if (input.query) conditions.push(ilike(assignments.name, `%${input.query}%`));
    const rows = await db
      .select({ assignmentId: classRollups.assignmentId, assignmentName: assignments.name, stats: classRollups.stats, narrative: classRollups.narrativeDraft, recommendedPracticeSet: classRollups.recommendedPracticeSet, computedAt: classRollups.computedAt })
      .from(classRollups)
      .innerJoin(assignments, eq(assignments.id, classRollups.assignmentId))
      .where(and(...conditions))
      .orderBy(desc(classRollups.computedAt))
      .limit(input.limit);
    return { ok: true, resource: input.resource, asOf, count: rows.length, records: rows.map((row) => ({ ...row, narrative: clip(row.narrative, 2000), computedAt: iso(row.computedAt) })) };
  }

  if (input.resource === "rubrics") {
    const conditions: SQL[] = [eq(sessionAssignments.orgId, scope.orgId), eq(sessionAssignments.courseId, scope.courseId), eq(rubrics.orgId, scope.orgId), eq(rubrics.courseId, scope.courseId)];
    if (input.assignmentId) conditions.push(eq(sessionAssignments.assignmentId, input.assignmentId));
    const rows = await db
      .select({ assignmentId: sessionAssignments.assignmentId, assignmentName: assignments.name, rubricId: rubrics.id, version: rubrics.version, criteria: rubrics.criteria, createdAt: rubrics.createdAt })
      .from(sessionAssignments)
      .innerJoin(assignments, eq(assignments.id, sessionAssignments.assignmentId))
      .innerJoin(rubrics, eq(rubrics.id, sessionAssignments.rubricId))
      .where(and(...conditions, eq(assignments.orgId, scope.orgId), eq(assignments.courseId, scope.courseId)))
      .orderBy(asc(assignments.position))
      .limit(input.limit);
    return { ok: true, resource: input.resource, asOf, count: rows.length, records: rows.map((row) => ({ ...row, criteria: parseRubricCriteria(row.criteria) ?? row.criteria, createdAt: iso(row.createdAt) })) };
  }

  if (input.resource === "policies") {
    const [coursePolicy, assignmentPolicies] = await Promise.all([
      db.select().from(courseAiPolicies).where(and(eq(courseAiPolicies.orgId, scope.orgId), eq(courseAiPolicies.courseId, scope.courseId))).limit(1),
      db
        .select({
          assignmentId: sessionAssignments.assignmentId,
          assignmentName: assignments.name,
          instructions: sessionAssignments.instructions,
          durationMinutes: sessionAssignments.durationMinutes,
          groundingScope: sessionAssignments.groundingScope,
          transcriptPolicy: sessionAssignments.transcriptPolicy,
          personalRecordSideNotes: sessionAssignments.personalRecordSideNotes,
          sideNoteTriggers: sessionAssignments.sideNoteTriggers,
          updatedAt: sessionAssignments.updatedAt,
        })
        .from(sessionAssignments)
        .innerJoin(assignments, eq(assignments.id, sessionAssignments.assignmentId))
        .where(and(eq(sessionAssignments.orgId, scope.orgId), eq(sessionAssignments.courseId, scope.courseId), eq(assignments.orgId, scope.orgId), eq(assignments.courseId, scope.courseId)))
        .orderBy(asc(assignments.position))
        .limit(input.limit),
    ]);
    const records = [
      ...(coursePolicy[0] ? [{ kind: "course", ...coursePolicy[0], updatedAt: iso(coursePolicy[0].updatedAt) }] : []),
      ...assignmentPolicies.map((row) => ({ kind: "assignment", ...row, updatedAt: iso(row.updatedAt) })),
    ];
    return { ok: true, resource: input.resource, asOf, count: records.length, records };
  }

  if (input.resource === "calendar") {
    const [assignmentRows, moduleRows] = await Promise.all([
      db.select({ id: assignments.id, title: assignments.name, at: assignments.dueAt, published: assignments.published }).from(assignments).where(and(eq(assignments.orgId, scope.orgId), eq(assignments.courseId, scope.courseId))),
      db.select({ id: modules.id, title: modules.name, at: modules.unlockAt, published: modules.published }).from(modules).where(and(eq(modules.orgId, scope.orgId), eq(modules.courseId, scope.courseId))),
    ]);
    const records = [
      ...assignmentRows.filter((row) => row.at).map((row) => ({ ...row, kind: "assignment_due", at: iso(row.at) })),
      ...moduleRows.filter((row) => row.at).map((row) => ({ ...row, kind: "module_opens", at: iso(row.at) })),
    ]
      .sort((a, b) => String(a.at).localeCompare(String(b.at)))
      .slice(0, input.limit);
    return { ok: true, resource: input.resource, asOf, count: records.length, records };
  }

  if (input.resource === "threads") {
    const conditions: SQL[] = [eq(agentSessions.orgId, scope.orgId), eq(agentSessions.courseId, scope.courseId), eq(agentSessions.userId, scope.instructorId), eq(agentSessions.surface, "command"), eq(agentSessions.anchorType, "course")];
    if (input.ids?.length) conditions.push(inArray(agentSessions.id, input.ids));
    if (input.query) conditions.push(ilike(agentSessions.title, `%${input.query}%`));
    const rows = await db
      .select({ id: agentSessions.id, title: agentSessions.title, totalTurns: agentSessions.totalTurns, summary: agentSessions.summary, createdAt: agentSessions.createdAt, updatedAt: agentSessions.updatedAt })
      .from(agentSessions)
      .where(and(...conditions))
      .orderBy(desc(agentSessions.updatedAt))
      .limit(input.limit);
    return { ok: true, resource: input.resource, asOf, count: rows.length, records: rows.map((row) => ({ ...row, summary: clip(row.summary, 2000), createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt) })) };
  }

  const conditions: SQL[] = [eq(changeProposals.orgId, scope.orgId), eq(changeProposals.courseId, scope.courseId)];
  if (input.ids?.length) conditions.push(inArray(changeProposals.id, input.ids));
  if (input.query) conditions.push(ilike(changeProposals.summary, `%${input.query}%`));
  const rows = await db.select().from(changeProposals).where(and(...conditions)).orderBy(desc(changeProposals.createdAt)).limit(input.limit);
  return { ok: true, resource: input.resource, asOf, count: rows.length, records: rows.map((row) => ({ ...row, createdAt: iso(row.createdAt), decidedAt: iso(row.decidedAt) })) };
}

const readGradebookSchema = z.object({
  view: z.enum(["distribution", "students", "student", "assignment"]).default("distribution"),
  assignmentId: z.string().uuid().optional(),
  studentId: z.string().uuid().optional(),
  studentQuery: z.string().trim().min(1).max(160).optional(),
  includeUngraded: z.boolean().default(true),
  limit: z.number().int().min(1).max(MAX_ROWS).default(MAX_ROWS),
});

type ReadGradebookInput = z.infer<typeof readGradebookSchema>;

async function readGradebook(scope: ProfessorScope, input: ReadGradebookInput): Promise<LmsReadOutput> {
  const asOf = new Date().toISOString();
  if (input.view === "assignment" && !input.assignmentId) {
    return { ok: false, error: "Choose an assignment before reading assignment grades." };
  }
  if (input.view === "student" && !input.studentId && !input.studentQuery) {
    return { ok: false, error: "Choose or search for a student before reading individual grades." };
  }
  const studentConditions: SQL[] = [
    eq(enrollments.orgId, scope.orgId),
    eq(enrollments.courseId, scope.courseId),
    eq(enrollments.role, "student"),
    eq(enrollments.state, "active"),
    eq(users.orgId, scope.orgId),
  ];
  if (input.studentId) studentConditions.push(eq(users.id, input.studentId));
  if (input.studentQuery) studentConditions.push(or(ilike(users.name, `%${input.studentQuery}%`), ilike(users.email, `%${input.studentQuery}%`))!);
  const students = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      currentScore: enrollments.currentScore,
      currentGrade: enrollments.currentGrade,
      finalScore: enrollments.finalScore,
      finalGrade: enrollments.finalGrade,
      lastActivityAt: enrollments.lastActivityAt,
    })
    .from(enrollments)
    .innerJoin(users, eq(users.id, enrollments.userId))
    .where(and(...studentConditions))
    .orderBy(asc(users.name), asc(users.email))
    .limit(input.limit);

  if (input.view === "student" && !input.studentId && students.length > 1) {
    return {
      ok: true,
      resource: "gradebook_student_matches",
      asOf,
      count: students.length,
      records: students.map((student) => ({ id: student.id, name: student.name, email: student.email })),
      summary: { needsStudentId: true },
    };
  }

  if (input.view === "distribution" && !input.assignmentId) {
    const distribution = summarizeGradeDistribution(students.map((student) => student.currentScore));
    return {
      ok: true,
      resource: "gradebook_distribution",
      asOf,
      count: students.length,
      records: [],
      summary: { scope: "course_standing", enrolledStudents: students.length, gradedStudents: distribution.count, distribution },
    };
  }

  const assignmentConditions: SQL[] = [eq(assignments.orgId, scope.orgId), eq(assignments.courseId, scope.courseId)];
  if (input.assignmentId) assignmentConditions.push(eq(assignments.id, input.assignmentId));
  const assignmentRows = await db
    .select({ id: assignments.id, name: assignments.name, pointsPossible: assignments.pointsPossible, dueAt: assignments.dueAt, published: assignments.published })
    .from(assignments)
    .where(and(...assignmentConditions))
    .orderBy(asc(assignments.position), asc(assignments.dueAt));
  const studentIds = students.map((student) => student.id);
  const assignmentIds = assignmentRows.map((assignment) => assignment.id);
  const submissionRows = studentIds.length && assignmentIds.length
    ? await db
        .select({
          assignmentId: submissions.assignmentId,
          userId: submissions.userId,
          submittedAt: submissions.submittedAt,
          gradedAt: submissions.gradedAt,
          score: submissions.score,
          grade: submissions.grade,
          missing: submissions.missing,
          excused: submissions.excused,
          late: submissions.late,
          workflowState: submissions.workflowState,
          body: submissions.body,
        })
        .from(submissions)
        .where(and(eq(submissions.orgId, scope.orgId), eq(submissions.courseId, scope.courseId), inArray(submissions.userId, studentIds), inArray(submissions.assignmentId, assignmentIds)))
    : [];
  if (input.view === "distribution") {
    const assignment = assignmentRows[0];
    if (!assignment) return { ok: false, error: "That assignment is not in this course." };
    const values = submissionRows.map((row) => {
      if (typeof row.score !== "number") return null;
      const possible = assignment.pointsPossible;
      return typeof possible === "number" && possible > 0 ? (row.score / possible) * 100 : row.score;
    });
    const distribution = summarizeGradeDistribution(values);
    return {
      ok: true,
      resource: "gradebook_distribution",
      asOf,
      count: students.length,
      records: [],
      summary: { scope: "assignment", assignment: { ...assignment, dueAt: iso(assignment.dueAt) }, enrolledStudents: students.length, gradedStudents: distribution.count, distribution },
    };
  }

  if (input.view === "students") {
    const byStudent = new Map<string, typeof submissionRows>();
    for (const row of submissionRows) byStudent.set(row.userId, [...(byStudent.get(row.userId) ?? []), row]);
    const records = students.map((student) => {
      const rows = byStudent.get(student.id) ?? [];
      return {
        ...student,
        lastActivityAt: iso(student.lastActivityAt),
        graded: rows.filter((row) => row.gradedAt && !row.missing).length,
        submitted: rows.filter((row) => row.submittedAt && !row.missing).length,
        missing: rows.filter((row) => row.missing).length,
        open: Math.max(0, assignmentRows.filter((assignment) => assignment.published).length - rows.filter((row) => row.submittedAt || row.missing).length),
      };
    });
    return { ok: true, resource: "gradebook_students", asOf, count: records.length, records };
  }

  if (input.view === "assignment") {
    const assignment = assignmentRows[0];
    if (!assignment) return { ok: false, error: "That assignment is not in this course." };
    const submissionByUser = new Map(submissionRows.map((row) => [row.userId, row]));
    const records = students
      .map((student) => {
        const row = submissionByUser.get(student.id);
        const percent = row && typeof row.score === "number" && typeof assignment.pointsPossible === "number" && assignment.pointsPossible > 0
          ? round1((row.score / assignment.pointsPossible) * 100)
          : null;
        return {
          studentId: student.id,
          studentName: student.name,
          email: student.email,
          status: row?.missing ? "missing" : row?.gradedAt ? "graded" : row?.submittedAt ? "submitted" : "open",
          score: row?.score ?? null,
          pointsPossible: assignment.pointsPossible,
          percent,
          grade: row?.grade ?? null,
          submittedAt: iso(row?.submittedAt),
          gradedAt: iso(row?.gradedAt),
          late: row?.late ?? false,
          excused: row?.excused ?? false,
        };
      })
      .filter((row) => input.includeUngraded || row.status === "graded");
    return { ok: true, resource: "gradebook_assignment", asOf, count: records.length, records, summary: { assignment: { ...assignment, dueAt: iso(assignment.dueAt) } } };
  }

  const student = students[0];
  if (!student) return { ok: false, error: "No matching student is enrolled in this course." };
  const rows = submissionRows.filter((row) => row.userId === student.id);
  const submissionByAssignment = new Map(rows.map((row) => [row.assignmentId, row]));
  const records = assignmentRows.map((assignment) => {
    const row = submissionByAssignment.get(assignment.id);
    const percent = row && typeof row.score === "number" && typeof assignment.pointsPossible === "number" && assignment.pointsPossible > 0
      ? round1((row.score / assignment.pointsPossible) * 100)
      : null;
    return {
      assignmentId: assignment.id,
      assignmentName: assignment.name,
      dueAt: iso(assignment.dueAt),
      published: assignment.published,
      status: row?.missing ? "missing" : row?.gradedAt ? "graded" : row?.submittedAt ? "submitted" : "open",
      score: row?.score ?? null,
      pointsPossible: assignment.pointsPossible,
      percent,
      grade: row?.grade ?? null,
      submittedAt: iso(row?.submittedAt),
      gradedAt: iso(row?.gradedAt),
      late: row?.late ?? false,
      excused: row?.excused ?? false,
      response: clip(row?.body, 2400),
    };
  });
  const gradedPercents = records.map((row) => row.percent);
  return {
    ok: true,
    resource: "gradebook_student",
    asOf,
    count: records.length,
    records,
    summary: {
      student: { ...student, lastActivityAt: iso(student.lastActivityAt) },
      distribution: summarizeGradeDistribution(gradedPercents),
      graded: records.filter((row) => row.status === "graded").length,
      submitted: records.filter((row) => row.status === "submitted").length,
      missing: records.filter((row) => row.status === "missing").length,
      open: records.filter((row) => row.status === "open" && row.published).length,
    },
  };
}

const searchCourseSchema = z.object({
  query: z.string().trim().min(2).max(160),
  resources: z.array(z.enum(["assignments", "modules", "pages", "files", "announcements", "students"])).max(6).optional(),
  limitPerResource: z.number().int().min(1).max(20).default(8),
});

async function searchCourse(scope: ProfessorScope, input: z.infer<typeof searchCourseSchema>): Promise<LmsReadOutput> {
  const wanted = new Set(input.resources ?? ["assignments", "modules", "pages", "files", "announcements", "students"]);
  const q = `%${input.query}%`;
  const [assignmentRows, moduleRows, pageRows, fileRows, announcementRows, studentRows] = await Promise.all([
    wanted.has("assignments")
      ? db.select({ id: assignments.id, title: assignments.name, text: assignments.descriptionMd }).from(assignments).where(and(eq(assignments.orgId, scope.orgId), eq(assignments.courseId, scope.courseId), or(ilike(assignments.name, q), ilike(assignments.descriptionMd, q))!)).limit(input.limitPerResource)
      : [],
    wanted.has("modules")
      ? db.select({ id: modules.id, title: modules.name, text: modules.summaryMd }).from(modules).where(and(eq(modules.orgId, scope.orgId), eq(modules.courseId, scope.courseId), or(ilike(modules.name, q), ilike(modules.summaryMd, q))!)).limit(input.limitPerResource)
      : [],
    wanted.has("pages")
      ? db.select({ id: pages.id, title: pages.title, text: pages.bodyMd }).from(pages).where(and(eq(pages.orgId, scope.orgId), eq(pages.courseId, scope.courseId), or(ilike(pages.title, q), ilike(pages.bodyMd, q))!)).limit(input.limitPerResource)
      : [],
    wanted.has("files")
      ? db.select({ id: files.id, title: files.displayName, text: files.extractedText }).from(files).where(and(eq(files.orgId, scope.orgId), eq(files.courseId, scope.courseId), or(ilike(files.displayName, q), ilike(files.filename, q), ilike(files.extractedText, q))!)).limit(input.limitPerResource)
      : [],
    wanted.has("announcements")
      ? db.select({ id: announcements.id, title: announcements.title, text: announcements.messageMd }).from(announcements).where(and(eq(announcements.orgId, scope.orgId), eq(announcements.courseId, scope.courseId), or(ilike(announcements.title, q), ilike(announcements.messageMd, q))!)).limit(input.limitPerResource)
      : [],
    wanted.has("students")
      ? db
          .select({ id: users.id, title: users.name, text: users.email })
          .from(enrollments)
          .innerJoin(users, eq(users.id, enrollments.userId))
          .where(and(eq(enrollments.orgId, scope.orgId), eq(enrollments.courseId, scope.courseId), eq(enrollments.role, "student"), eq(enrollments.state, "active"), eq(users.orgId, scope.orgId), or(ilike(users.name, q), ilike(users.email, q))!))
          .limit(input.limitPerResource)
      : [],
  ]);
  const records = [
    ...assignmentRows.map((row) => ({ resource: "assignment", ...row, text: clip(row.text, 800) })),
    ...moduleRows.map((row) => ({ resource: "module", ...row, text: clip(row.text, 800) })),
    ...pageRows.map((row) => ({ resource: "page", ...row, text: clip(row.text, 1200) })),
    ...fileRows.map((row) => ({ resource: "file", ...row, text: clip(row.text, 1600) })),
    ...announcementRows.map((row) => ({ resource: "announcement", ...row, text: clip(row.text, 800) })),
    ...studentRows.map((row) => ({ resource: "student", ...row })),
  ];
  return { ok: true, resource: "search", asOf: new Date().toISOString(), count: records.length, records };
}

const mutateLmsSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create_assignment"), name: z.string().min(3).max(220), descriptionMd: z.string().max(4000).optional(), dueAt: z.string().max(40).nullable().optional(), pointsPossible: z.number().min(1).max(1000).default(100), published: z.boolean().default(false) }),
  z.object({ action: z.literal("update_assignment"), assignmentId: z.string().uuid(), name: z.string().min(3).max(220).optional(), descriptionMd: z.string().max(4000).nullable().optional(), dueAt: z.string().max(40).nullable().optional(), pointsPossible: z.number().min(1).max(1000).nullable().optional() }),
  z.object({ action: z.literal("publish_assignment"), assignmentId: z.string().uuid(), published: z.boolean().default(true) }),
  z.object({ action: z.literal("create_module"), name: z.string().min(3).max(200), summaryMd: z.string().max(4000).optional(), unlockAt: z.string().max(40).nullable().optional(), published: z.boolean().default(false) }),
  z.object({ action: z.literal("update_module"), moduleId: z.string().uuid(), name: z.string().min(3).max(200).optional(), summaryMd: z.string().max(4000).nullable().optional(), unlockAt: z.string().max(40).nullable().optional() }),
  z.object({ action: z.literal("publish_module"), moduleId: z.string().uuid(), published: z.boolean().default(true) }),
  z.object({ action: z.literal("create_page"), title: z.string().min(3).max(200), bodyMd: z.string().min(1).max(12_000), published: z.boolean().default(false) }),
  z.object({ action: z.literal("update_page"), pageId: z.string().uuid(), title: z.string().min(3).max(200).optional(), bodyMd: z.string().min(1).max(12_000).optional(), published: z.boolean().optional() }),
  z.object({ action: z.literal("post_announcement"), title: z.string().min(3).max(200), messageMd: z.string().min(1).max(4000) }),
  z.object({ action: z.literal("create_practice_set"), title: z.string().min(3).max(200), base: z.string().max(1200).optional(), questions: z.array(practiceQuestionSchema).min(1).max(12), published: z.boolean().default(true) }),
  z.object({ action: z.literal("update_course"), name: z.string().min(3).max(200).optional(), description: z.string().max(2000).nullable().optional(), syllabusMd: z.string().max(20_000).nullable().optional() }),
  z.object({ action: z.literal("set_grade"), assignmentId: z.string().uuid(), studentId: z.string().uuid(), score: z.number().min(0), grade: z.string().max(24).nullable().optional() }),
  z.object({ action: z.literal("mark_missing"), assignmentId: z.string().uuid(), studentId: z.string().uuid(), missing: z.boolean().default(true) }),
  z.object({ action: z.literal("update_session_contract"), assignmentId: z.string().uuid(), instructions: z.string().min(10).max(2000).optional(), durationMinutes: z.number().int().min(5).max(240).optional(), groundingScope: z.array(z.string().min(1).max(200)).max(12).optional(), transcriptPolicy: z.string().min(3).max(200).optional(), personalRecordSideNotes: z.boolean().optional() }),
  z.object({ action: z.literal("apply_draft"), proposalId: z.string().uuid() }),
  z.object({ action: z.literal("dismiss_draft"), proposalId: z.string().uuid() }),
  z.object({ action: z.literal("grade_session"), submissionId: z.string().uuid(), force: z.boolean().default(false) }),
  z.object({ action: z.literal("finalize_session_grade"), reportId: z.string().uuid() }),
  z.object({ action: z.literal("refresh_class_results"), assignmentId: z.string().uuid() }),
  z.object({ action: z.literal("delete_record"), recordType: z.enum(["assignment", "module", "page", "announcement", "practice_set"]), recordId: z.string().uuid(), confirmTitle: z.string().min(1).max(220) }),
]);

type MutateLmsInput = z.infer<typeof mutateLmsSchema>;
type MutateLmsAction = MutateLmsInput["action"];

const DIRECT_ACTION_TOOL_DESCRIPTIONS = {
  create_assignment: "Create a new ordinary LMS assignment.",
  update_assignment: "Update an existing ordinary LMS assignment.",
  publish_assignment: "Publish or unpublish an ordinary LMS assignment.",
  create_module: "Create a course module.",
  update_module: "Update a course module.",
  publish_module: "Publish or unpublish a course module.",
  create_page: "Create a course page.",
  update_page: "Update a course page.",
  post_announcement: "Post a course announcement.",
  create_practice_set: "Create a course practice set.",
  update_course: "Update the course name, description, or syllabus.",
  set_grade: "Set a student's grade for an assignment.",
  mark_missing: "Mark or clear a student's assignment as missing.",
  update_session_contract: "Update an AI assignment session contract.",
  apply_draft: "Apply a reviewed Atlas draft proposal.",
  dismiss_draft: "Dismiss a reviewed Atlas draft proposal.",
  grade_session: "Run draft grading for a session submission.",
  finalize_session_grade: "Finalize a reviewed session grade.",
  refresh_class_results: "Recompute class results for an assignment.",
  delete_record: "Delete an exactly confirmed course record.",
} satisfies Record<MutateLmsAction, string>;

export type LmsActionOutput =
  | { ok: true; action: string; summary: string; record?: unknown }
  | { ok: false; error: string };

async function requireAssignment(scope: ProfessorScope, assignmentId: string) {
  const [row] = await db.select().from(assignments).where(and(eq(assignments.id, assignmentId), eq(assignments.orgId, scope.orgId), eq(assignments.courseId, scope.courseId))).limit(1);
  return row ?? null;
}

async function requireStudent(scope: ProfessorScope, studentId: string) {
  const [row] = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(enrollments)
    .innerJoin(users, eq(users.id, enrollments.userId))
    .where(and(eq(enrollments.orgId, scope.orgId), eq(enrollments.courseId, scope.courseId), eq(enrollments.userId, studentId), eq(enrollments.role, "student"), eq(enrollments.state, "active"), eq(users.orgId, scope.orgId)))
    .limit(1);
  return row ?? null;
}

async function refreshStanding(scope: ProfessorScope, studentId: string) {
  const rows = await db
    .select({ score: submissions.score, points: assignments.pointsPossible })
    .from(submissions)
    .innerJoin(assignments, eq(assignments.id, submissions.assignmentId))
    .where(and(eq(submissions.orgId, scope.orgId), eq(submissions.courseId, scope.courseId), eq(submissions.userId, studentId), eq(assignments.orgId, scope.orgId), eq(assignments.courseId, scope.courseId), sql`${submissions.gradedAt} is not null`, eq(submissions.missing, false)));
  const totals = rows.reduce(
    (sum, row) => {
      if (typeof row.score !== "number" || typeof row.points !== "number" || row.points <= 0) return sum;
      return { earned: sum.earned + Math.min(row.score, row.points), possible: sum.possible + row.points };
    },
    { earned: 0, possible: 0 }
  );
  if (totals.possible <= 0) return;
  const currentScore = Math.round((totals.earned / totals.possible) * 10_000) / 100;
  await db
    .update(enrollments)
    .set({ currentScore, currentGrade: letterGrade(currentScore), lastActivityAt: new Date() })
    .where(and(eq(enrollments.orgId, scope.orgId), eq(enrollments.courseId, scope.courseId), eq(enrollments.userId, studentId), eq(enrollments.role, "student"), eq(enrollments.state, "active")));
}

async function uniquePageSlug(scope: ProfessorScope, title: string) {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "page";
  const existing = await db.select({ slug: pages.slug }).from(pages).where(and(eq(pages.orgId, scope.orgId), eq(pages.courseId, scope.courseId)));
  const taken = new Set(existing.map((row) => row.slug));
  let slug = base;
  for (let index = 2; taken.has(slug); index += 1) slug = `${base}-${index}`;
  return slug;
}

async function mutateLms(scope: ProfessorScope, model: LanguageModel, input: MutateLmsInput): Promise<LmsActionOutput> {
  try {
    if (input.action === "create_assignment") {
      const [{ position }] = await db.select({ position: sql<number>`coalesce(max(${assignments.position}), 0)::int` }).from(assignments).where(and(eq(assignments.orgId, scope.orgId), eq(assignments.courseId, scope.courseId)));
      const [created] = await db.insert(assignments).values({ orgId: scope.orgId, courseId: scope.courseId, name: input.name, descriptionMd: input.descriptionMd ?? null, dueAt: parseDate(input.dueAt), pointsPossible: input.pointsPossible, position: Number(position) + 1, published: input.published }).returning({ id: assignments.id, name: assignments.name });
      return { ok: true, action: input.action, summary: `Created assignment ${created.name}.`, record: created };
    }

    if (input.action === "update_assignment") {
      const target = await requireAssignment(scope, input.assignmentId);
      if (!target) return { ok: false, error: "That assignment is not in this course." };
      const set: Partial<typeof assignments.$inferInsert> = { updatedAt: new Date() };
      if (input.name !== undefined) set.name = input.name;
      if (input.descriptionMd !== undefined) set.descriptionMd = input.descriptionMd;
      if (input.dueAt !== undefined) set.dueAt = parseDate(input.dueAt);
      if (input.pointsPossible !== undefined) set.pointsPossible = input.pointsPossible;
      await db.update(assignments).set(set).where(and(eq(assignments.id, target.id), eq(assignments.orgId, scope.orgId), eq(assignments.courseId, scope.courseId)));
      return { ok: true, action: input.action, summary: `Updated assignment ${input.name ?? target.name}.`, record: { id: target.id } };
    }

    if (input.action === "publish_assignment") {
      const target = await requireAssignment(scope, input.assignmentId);
      if (!target) return { ok: false, error: "That assignment is not in this course." };
      await db.update(assignments).set({ published: input.published, updatedAt: new Date() }).where(and(eq(assignments.id, target.id), eq(assignments.orgId, scope.orgId), eq(assignments.courseId, scope.courseId)));
      return { ok: true, action: input.action, summary: `${input.published ? "Published" : "Unpublished"} assignment ${target.name}.` };
    }

    if (input.action === "create_module") {
      const [{ position }] = await db.select({ position: sql<number>`coalesce(max(${modules.position}), 0)::int` }).from(modules).where(and(eq(modules.orgId, scope.orgId), eq(modules.courseId, scope.courseId)));
      const [created] = await db.insert(modules).values({ orgId: scope.orgId, courseId: scope.courseId, name: input.name, summaryMd: input.summaryMd ?? null, unlockAt: parseDate(input.unlockAt), position: Number(position) + 1, published: input.published }).returning({ id: modules.id, name: modules.name });
      return { ok: true, action: input.action, summary: `Created module ${created.name}.`, record: created };
    }

    if (input.action === "update_module") {
      const [target] = await db.select().from(modules).where(and(eq(modules.id, input.moduleId), eq(modules.orgId, scope.orgId), eq(modules.courseId, scope.courseId))).limit(1);
      if (!target) return { ok: false, error: "That module is not in this course." };
      const set: Partial<typeof modules.$inferInsert> = { updatedAt: new Date() };
      if (input.name !== undefined) set.name = input.name;
      if (input.summaryMd !== undefined) set.summaryMd = input.summaryMd;
      if (input.unlockAt !== undefined) set.unlockAt = parseDate(input.unlockAt);
      await db.update(modules).set(set).where(and(eq(modules.id, target.id), eq(modules.orgId, scope.orgId), eq(modules.courseId, scope.courseId)));
      return { ok: true, action: input.action, summary: `Updated module ${input.name ?? target.name}.`, record: { id: target.id } };
    }

    if (input.action === "publish_module") {
      const [target] = await db.select({ id: modules.id, name: modules.name }).from(modules).where(and(eq(modules.id, input.moduleId), eq(modules.orgId, scope.orgId), eq(modules.courseId, scope.courseId))).limit(1);
      if (!target) return { ok: false, error: "That module is not in this course." };
      await db.update(modules).set({ published: input.published, updatedAt: new Date() }).where(and(eq(modules.id, target.id), eq(modules.orgId, scope.orgId), eq(modules.courseId, scope.courseId)));
      return { ok: true, action: input.action, summary: `${input.published ? "Published" : "Unpublished"} module ${target.name}.` };
    }

    if (input.action === "create_page") {
      const slug = await uniquePageSlug(scope, input.title);
      const [created] = await db.insert(pages).values({ orgId: scope.orgId, courseId: scope.courseId, slug, title: input.title, bodyMd: input.bodyMd, published: input.published }).returning({ id: pages.id, title: pages.title, slug: pages.slug });
      return { ok: true, action: input.action, summary: `Created page ${created.title}.`, record: created };
    }

    if (input.action === "update_page") {
      const [target] = await db.select().from(pages).where(and(eq(pages.id, input.pageId), eq(pages.orgId, scope.orgId), eq(pages.courseId, scope.courseId))).limit(1);
      if (!target) return { ok: false, error: "That page is not in this course." };
      const set: Partial<typeof pages.$inferInsert> = { updatedAt: new Date() };
      if (input.title !== undefined) set.title = input.title;
      if (input.bodyMd !== undefined) set.bodyMd = input.bodyMd;
      if (input.published !== undefined) set.published = input.published;
      await db.update(pages).set(set).where(and(eq(pages.id, target.id), eq(pages.orgId, scope.orgId), eq(pages.courseId, scope.courseId)));
      return { ok: true, action: input.action, summary: `Updated page ${input.title ?? target.title}.`, record: { id: target.id } };
    }

    if (input.action === "post_announcement") {
      const [created] = await db.insert(announcements).values({ orgId: scope.orgId, courseId: scope.courseId, authorId: scope.instructorId, title: input.title, messageMd: input.messageMd, postedAt: new Date(), published: true }).returning({ id: announcements.id, title: announcements.title });
      return { ok: true, action: input.action, summary: `Posted announcement ${created.title}.`, record: created };
    }

    if (input.action === "create_practice_set") {
      const [{ position }] = await db.select({ position: sql<number>`coalesce(max(${practiceSets.position}), 0)::int` }).from(practiceSets).where(and(eq(practiceSets.orgId, scope.orgId), eq(practiceSets.courseId, scope.courseId)));
      const [created] = await db.insert(practiceSets).values({ orgId: scope.orgId, courseId: scope.courseId, title: input.title, base: input.base ?? null, questions: input.questions, position: Number(position) + 1, published: input.published, createdByAgent: true }).returning({ id: practiceSets.id, title: practiceSets.title });
      return { ok: true, action: input.action, summary: `Created practice set ${created.title}.`, record: created };
    }

    if (input.action === "update_course") {
      const [course] = await db.select().from(courses).where(and(eq(courses.id, scope.courseId), eq(courses.orgId, scope.orgId))).limit(1);
      if (!course) return { ok: false, error: "The course is unavailable." };
      const set: Partial<typeof courses.$inferInsert> = { updatedAt: new Date() };
      if (input.name !== undefined) set.name = input.name;
      if (input.description !== undefined) set.description = input.description;
      if (input.syllabusMd !== undefined) set.syllabusMd = input.syllabusMd;
      await db.update(courses).set(set).where(and(eq(courses.id, scope.courseId), eq(courses.orgId, scope.orgId)));
      return { ok: true, action: input.action, summary: `Updated course ${input.name ?? course.name}.` };
    }

    if (input.action === "set_grade") {
      const [assignment, student] = await Promise.all([requireAssignment(scope, input.assignmentId), requireStudent(scope, input.studentId)]);
      if (!assignment) return { ok: false, error: "That assignment is not in this course." };
      if (!student) return { ok: false, error: "That student is not enrolled in this course." };
      if (typeof assignment.pointsPossible === "number" && input.score > assignment.pointsPossible) return { ok: false, error: "The score is above the points possible." };
      const now = new Date();
      const grade = input.grade === undefined ? letterGrade(typeof assignment.pointsPossible === "number" && assignment.pointsPossible > 0 ? (input.score / assignment.pointsPossible) * 100 : input.score) : input.grade;
      await db
        .insert(submissions)
        .values({ orgId: scope.orgId, courseId: scope.courseId, assignmentId: assignment.id, userId: student.id, gradedAt: now, score: input.score, grade, missing: false, workflowState: "graded" })
        .onConflictDoUpdate({ target: [submissions.assignmentId, submissions.userId], set: { gradedAt: now, score: input.score, grade, missing: false, workflowState: "graded" } });
      await refreshStanding(scope, student.id);
      return { ok: true, action: input.action, summary: `Set ${student.name ?? student.email}'s grade for ${assignment.name} to ${input.score}${assignment.pointsPossible ? `/${assignment.pointsPossible}` : ""}.` };
    }

    if (input.action === "mark_missing") {
      const [assignment, student] = await Promise.all([requireAssignment(scope, input.assignmentId), requireStudent(scope, input.studentId)]);
      if (!assignment) return { ok: false, error: "That assignment is not in this course." };
      if (!student) return { ok: false, error: "That student is not enrolled in this course." };
      const [existing] = await db.select().from(submissions).where(and(eq(submissions.orgId, scope.orgId), eq(submissions.courseId, scope.courseId), eq(submissions.assignmentId, assignment.id), eq(submissions.userId, student.id))).limit(1);
      if (input.missing && (existing?.submittedAt || existing?.gradedAt)) return { ok: false, error: "A submitted or graded assignment cannot be marked missing." };
      await db
        .insert(submissions)
        .values({ orgId: scope.orgId, courseId: scope.courseId, assignmentId: assignment.id, userId: student.id, missing: input.missing, workflowState: input.missing ? "missing" : "unsubmitted" })
        .onConflictDoUpdate({ target: [submissions.assignmentId, submissions.userId], set: { missing: input.missing, workflowState: input.missing ? "missing" : "unsubmitted" } });
      return { ok: true, action: input.action, summary: `${input.missing ? "Marked" : "Cleared"} ${student.name ?? student.email}${input.missing ? " missing" : "'s missing state"} for ${assignment.name}.` };
    }

    if (input.action === "update_session_contract") {
      const [target] = await db
        .select({ id: sessionAssignments.id, assignmentName: assignments.name })
        .from(sessionAssignments)
        .innerJoin(assignments, eq(assignments.id, sessionAssignments.assignmentId))
        .where(and(eq(sessionAssignments.orgId, scope.orgId), eq(sessionAssignments.courseId, scope.courseId), eq(sessionAssignments.assignmentId, input.assignmentId), eq(assignments.orgId, scope.orgId), eq(assignments.courseId, scope.courseId)))
        .limit(1);
      if (!target) return { ok: false, error: "That assignment is not an AI assignment in this course." };
      const set: Partial<typeof sessionAssignments.$inferInsert> = { updatedAt: new Date() };
      if (input.instructions !== undefined) set.instructions = input.instructions;
      if (input.durationMinutes !== undefined) set.durationMinutes = input.durationMinutes;
      if (input.groundingScope !== undefined) set.groundingScope = input.groundingScope;
      if (input.transcriptPolicy !== undefined) set.transcriptPolicy = input.transcriptPolicy;
      if (input.personalRecordSideNotes !== undefined) set.personalRecordSideNotes = input.personalRecordSideNotes;
      await db.update(sessionAssignments).set(set).where(and(eq(sessionAssignments.id, target.id), eq(sessionAssignments.orgId, scope.orgId), eq(sessionAssignments.courseId, scope.courseId)));
      return { ok: true, action: input.action, summary: `Updated the session contract for ${target.assignmentName}.` };
    }

    if (input.action === "apply_draft" || input.action === "dismiss_draft") {
      const [proposal] = await db.select({ id: changeProposals.id, summary: changeProposals.summary, status: changeProposals.status }).from(changeProposals).where(and(eq(changeProposals.id, input.proposalId), eq(changeProposals.orgId, scope.orgId), eq(changeProposals.courseId, scope.courseId))).limit(1);
      if (!proposal || proposal.status !== "pending") return { ok: false, error: "That open draft is not available in this course." };
      if (input.action === "apply_draft") {
        const records = await applyProposal({ orgId: scope.orgId, courseId: scope.courseId, userId: scope.instructorId, proposalId: proposal.id });
        return { ok: true, action: input.action, summary: `Applied ${proposal.summary}.`, record: records };
      }
      await dismissProposal({ orgId: scope.orgId, proposalId: proposal.id });
      return { ok: true, action: input.action, summary: `Dismissed ${proposal.summary}.` };
    }

    if (input.action === "grade_session") {
      const [submission] = await db.select({ id: sessionSubmissions.id, courseId: sessionSubmissions.courseId }).from(sessionSubmissions).where(and(eq(sessionSubmissions.id, input.submissionId), eq(sessionSubmissions.orgId, scope.orgId), eq(sessionSubmissions.courseId, scope.courseId))).limit(1);
      if (!submission) return { ok: false, error: "That session submission is not in this course." };
      const report = await runGradingForSubmission({ orgId: scope.orgId, submissionId: submission.id, model, graderLabel: "atlas:professor-agent", force: input.force });
      return { ok: true, action: input.action, summary: `Graded the session submission as a draft with score ${report.overallScore}.`, record: { reportId: report.id, score: report.overallScore, status: report.status } };
    }

    if (input.action === "finalize_session_grade") {
      const [row] = await db
        .select({ report: journeyReports, submission: sessionSubmissions, studentName: users.name })
        .from(journeyReports)
        .innerJoin(sessionSubmissions, eq(sessionSubmissions.id, journeyReports.submissionId))
        .leftJoin(users, eq(users.id, journeyReports.userId))
        .where(and(eq(journeyReports.id, input.reportId), eq(journeyReports.orgId, scope.orgId), eq(journeyReports.courseId, scope.courseId), eq(sessionSubmissions.orgId, scope.orgId), eq(sessionSubmissions.courseId, scope.courseId)))
        .limit(1);
      if (!row) return { ok: false, error: "That draft session grade is not in this course." };
      if (row.report.status === "final") return { ok: false, error: "That session grade is already final." };
      const [scaleRow] = await db
        .select({ gradeScale: courses.gradeScale })
        .from(courses)
        .where(and(eq(courses.id, scope.courseId), eq(courses.orgId, scope.orgId)))
        .limit(1);
      const now = new Date();
      const score = row.report.overallScore;
      const grade = gradeLetterFor(score, gradeBandsForCourse(scaleRow?.gradeScale));
      const fallbackBody = renderFinalArtifactBody(row.submission.finalArtifact, row.studentName ?? "Student");
      await db.transaction(async (tx) => {
        await tx.update(journeyReports).set({ status: "final", finalizedAt: now, finalizedById: scope.instructorId, updatedAt: now }).where(and(eq(journeyReports.id, row.report.id), eq(journeyReports.orgId, scope.orgId), eq(journeyReports.courseId, scope.courseId)));
        await tx.update(sessionSubmissions).set({ status: "graded" }).where(and(eq(sessionSubmissions.id, row.submission.id), eq(sessionSubmissions.orgId, scope.orgId), eq(sessionSubmissions.courseId, scope.courseId)));
        const [existing] = await tx.select({ body: submissions.body }).from(submissions).where(and(eq(submissions.orgId, scope.orgId), eq(submissions.courseId, scope.courseId), eq(submissions.assignmentId, row.report.assignmentId), eq(submissions.userId, row.report.userId))).limit(1);
        if (existing) {
          await tx.update(submissions).set({ score, grade, gradedAt: now, missing: false, workflowState: "graded", submissionType: "session", body: existing.body ?? fallbackBody }).where(and(eq(submissions.orgId, scope.orgId), eq(submissions.courseId, scope.courseId), eq(submissions.assignmentId, row.report.assignmentId), eq(submissions.userId, row.report.userId)));
        } else {
          await tx.insert(submissions).values({ orgId: scope.orgId, courseId: scope.courseId, assignmentId: row.report.assignmentId, userId: row.report.userId, submittedAt: row.submission.submittedAt, gradedAt: now, score, grade, missing: false, workflowState: "graded", submissionType: "session", body: fallbackBody });
        }
      });
      await refreshStanding(scope, row.report.userId);
      return { ok: true, action: input.action, summary: `Finalized ${row.studentName ?? "the student"}'s session grade at ${score}.`, record: { reportId: row.report.id, score, grade } };
    }

    if (input.action === "refresh_class_results") {
      const assignment = await requireAssignment(scope, input.assignmentId);
      if (!assignment) return { ok: false, error: "That assignment is not in this course." };
      const stats = await recomputeClassRollup({ orgId: scope.orgId, courseId: scope.courseId, assignmentId: assignment.id, narrator: model });
      return { ok: true, action: input.action, summary: `Refreshed class results for ${assignment.name}.`, record: stats };
    }

    let deletedTitle: string | null = null;
    if (input.recordType === "assignment") {
      const [record] = await db.select({ id: assignments.id, title: assignments.name }).from(assignments).where(and(eq(assignments.id, input.recordId), eq(assignments.orgId, scope.orgId), eq(assignments.courseId, scope.courseId))).limit(1);
      if (record && record.title.trim().toLowerCase() === input.confirmTitle.trim().toLowerCase()) {
        await db.delete(assignments).where(and(eq(assignments.id, record.id), eq(assignments.orgId, scope.orgId), eq(assignments.courseId, scope.courseId)));
        deletedTitle = record.title;
      }
    } else if (input.recordType === "module") {
      const [record] = await db.select({ id: modules.id, title: modules.name }).from(modules).where(and(eq(modules.id, input.recordId), eq(modules.orgId, scope.orgId), eq(modules.courseId, scope.courseId))).limit(1);
      if (record && record.title.trim().toLowerCase() === input.confirmTitle.trim().toLowerCase()) {
        await db.delete(modules).where(and(eq(modules.id, record.id), eq(modules.orgId, scope.orgId), eq(modules.courseId, scope.courseId)));
        deletedTitle = record.title;
      }
    } else if (input.recordType === "page") {
      const [record] = await db.select({ id: pages.id, title: pages.title }).from(pages).where(and(eq(pages.id, input.recordId), eq(pages.orgId, scope.orgId), eq(pages.courseId, scope.courseId))).limit(1);
      if (record && record.title.trim().toLowerCase() === input.confirmTitle.trim().toLowerCase()) {
        await db.delete(pages).where(and(eq(pages.id, record.id), eq(pages.orgId, scope.orgId), eq(pages.courseId, scope.courseId)));
        deletedTitle = record.title;
      }
    } else if (input.recordType === "announcement") {
      const [record] = await db.select({ id: announcements.id, title: announcements.title }).from(announcements).where(and(eq(announcements.id, input.recordId), eq(announcements.orgId, scope.orgId), eq(announcements.courseId, scope.courseId))).limit(1);
      if (record && record.title.trim().toLowerCase() === input.confirmTitle.trim().toLowerCase()) {
        await db.delete(announcements).where(and(eq(announcements.id, record.id), eq(announcements.orgId, scope.orgId), eq(announcements.courseId, scope.courseId)));
        deletedTitle = record.title;
      }
    } else {
      const [record] = await db.select({ id: practiceSets.id, title: practiceSets.title }).from(practiceSets).where(and(eq(practiceSets.id, input.recordId), eq(practiceSets.orgId, scope.orgId), eq(practiceSets.courseId, scope.courseId))).limit(1);
      if (record && record.title.trim().toLowerCase() === input.confirmTitle.trim().toLowerCase()) {
        await db.delete(practiceSets).where(and(eq(practiceSets.id, record.id), eq(practiceSets.orgId, scope.orgId), eq(practiceSets.courseId, scope.courseId)));
        deletedTitle = record.title;
      }
    }
    if (!deletedTitle) return { ok: false, error: "The record was unavailable or the confirmation title did not match." };
    return { ok: true, action: input.action, summary: `Deleted ${input.recordType.replace("_", " ")} ${deletedTitle}.` };
  } catch (error) {
    console.error("Atlas LMS action failed", error);
    return { ok: false, error: "The LMS action failed. No further action was attempted." };
  }
}

function directActionTools(args: { scope: ProfessorScope; model: LanguageModel }) {
  const entries = mutateLmsSchema.options.map((option) => {
    const action = option.shape.action.value as MutateLmsAction;
    const inputShape = { ...option.shape };
    Reflect.deleteProperty(inputShape, "action");
    const inputSchema = z.object(inputShape) as z.ZodType<Record<string, unknown>>;

    return [
      action,
      tool<Record<string, unknown>, LmsActionOutput, Record<string, unknown>>({
        description: DIRECT_ACTION_TOOL_DESCRIPTIONS[action],
        inputSchema,
        execute: async (input): Promise<LmsActionOutput> => {
          const parsed = mutateLmsSchema.safeParse({ action, ...(input as Record<string, unknown>) });
          if (!parsed.success) return { ok: false, error: "The LMS action input was invalid." };
          return mutateLms(args.scope, args.model, parsed.data);
        },
      }),
    ] as const;
  });

  return Object.fromEntries(entries);
}

export function professorOperatorTools(args: { scope: ProfessorScope; sessionId: string; model: LanguageModel }) {
  const legacy = professorTools({ scope: args.scope, sessionId: args.sessionId });

  const inspect_lms = tool({
    description: "Read any current LMS record in the course, including students, submissions, assessed sessions, rubrics, policies, files, calendar facts, and drafts. Use the smallest relevant resource and filters.",
    inputSchema: inspectLmsSchema,
    execute: async (input): Promise<LmsReadOutput> => inspectLms(args.scope, input),
  });

  const read_gradebook = tool({
    description: "Read the full course gradebook, compute the class or assignment grade distribution, inspect an assignment across students, or inspect one student's grades and submission states.",
    inputSchema: readGradebookSchema,
    execute: async (input): Promise<LmsReadOutput> => readGradebook(args.scope, input),
  });

  const search_course = tool({
    description: "Search course content and the roster by text across assignments, modules, pages, files, announcements, and students.",
    inputSchema: searchCourseSchema,
    execute: async (input): Promise<LmsReadOutput> => searchCourse(args.scope, input),
  });

  const load_skill = tool({
    description: "Load one reviewed Atlas workflow when it matches the professor's request. Skills guide the work but do not grant authority beyond the typed tools.",
    inputSchema: z.object({ skillId: z.enum(["ai-assignment", "course-authoring", "class-insight", "gradebook", "student-support", "course-operations"]) }),
    execute: async ({ skillId }) => {
      const loaded = await loadAtlasSkill(skillId);
      if (!loaded) return { ok: false as const, error: "That Atlas skill is not available." };
      return { ok: true as const, skillId, name: loaded.skill.name, instructions: loaded.instructions };
    },
  });

  const actions = directActionTools({ scope: args.scope, model: args.model });

  return {
    inspect_lms,
    read_gradebook,
    search_course,
    load_skill,
    ...actions,
    draft_ai_assignment: legacy.draft_ai_assignment,
    draft_rubric: legacy.draft_rubric,
    draft_course: legacy.draft_course,
  };
}
