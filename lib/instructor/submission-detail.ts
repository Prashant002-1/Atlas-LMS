import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  assignments,
  courses,
  enrollments,
  journeyReports,
  sessionSubmissions,
  submissions,
  users,
} from "@/lib/db/schema";
import { listDocumentAttachments, type DocumentAttachmentItem } from "@/lib/course/documents";
import { resolveScope, type WorkspaceCourse } from "@/lib/workspace/scope";
import { gradeLetterFor } from "@/lib/agent/grading";
import { gradeBandsForCourse } from "@/lib/course/policies";

/**
 * One student's submission on one assignment, in full.
 *
 * The assignment list can only ever show a preview, so a row that expands in
 * place forces the grader to read a paragraph of prose through a table cell and
 * gives a file submission nowhere to render at all. Grading one student is its
 * own task, so it gets its own page.
 *
 * A submission is deliberately not "a response". `submissionType` says which of
 * text, a link, attached files, or an assessed Atlas session actually carries
 * the work, and the page renders that shape rather than assuming prose.
 */

export type SubmissionKind = "text" | "file" | "link" | "session" | "none";

export type SubmissionNeighbor = { studentId: string; studentName: string };

export type SubmissionDetailView = {
  course: WorkspaceCourse;
  assignment: {
    id: string;
    name: string;
    pointsPossible: number | null;
    dueAt: Date | null;
    descriptionMd: string | null;
  };
  student: { id: string; name: string; email: string | null; standing: string | null };
  submission: {
    kind: SubmissionKind;
    status: "graded" | "submitted" | "missing" | "open";
    submittedAt: Date | null;
    gradedAt: Date | null;
    late: boolean;
    score: number | null;
    grade: string | null;
    body: string | null;
    url: string | null;
    feedback: string | null;
    feedbackAt: Date | null;
    feedbackByName: string | null;
  };
  documents: DocumentAttachmentItem[];
  /** Present when this assignment is an assessed Atlas session. */
  sessionSubmissionId: string | null;
  sessionReportStatus: "draft" | "final" | null;
  /** Roster order, so grading can move student to student without going back. */
  previous: SubmissionNeighbor | null;
  next: SubmissionNeighbor | null;
  position: { index: number; total: number };
  problem?: { title: string; detail: string };
};

type Actor = { id: string; orgId?: string | null; role: string };

export async function loadSubmissionDetail(
  actor: Actor | null | undefined,
  assignmentId: string,
  studentId: string
): Promise<SubmissionDetailView> {
  const unavailable = (title: string, detail: string): SubmissionDetailView => ({
    course: { code: "Course", name: title, term: "" },
    assignment: { id: assignmentId, name: title, pointsPossible: null, dueAt: null, descriptionMd: null },
    student: { id: studentId, name: "Student", email: null, standing: null },
    submission: {
      kind: "none",
      status: "open",
      submittedAt: null,
      gradedAt: null,
      late: false,
      score: null,
      grade: null,
      body: null,
      url: null,
      feedback: null,
      feedbackAt: null,
      feedbackByName: null,
    },
    documents: [],
    sessionSubmissionId: null,
    sessionReportStatus: null,
    previous: null,
    next: null,
    position: { index: 0, total: 0 },
    problem: { title, detail },
  });

  if (!actor?.orgId) return unavailable("Sign in", "Sign in to read a submission.");

  const scope = await resolveScope({
    orgId: actor.orgId,
    userId: actor.id,
    role: actor.role,
    teachingOnly: true,
  });
  if (!scope.course) return unavailable("No course in view", "No course is in view for this semester.");

  const [course] = await db
    .select({ id: courses.id, code: courses.code, name: courses.name, term: courses.term, gradeBands: courses.gradeBands })
    .from(courses)
    .where(and(eq(courses.orgId, actor.orgId), eq(courses.id, scope.course.id)))
    .limit(1);
  if (!course) return unavailable("Course unavailable", "This course could not be loaded.");

  /* The assignment must be in the course in view, not merely exist. */
  const [assignment] = await db
    .select({
      id: assignments.id,
      name: assignments.name,
      pointsPossible: assignments.pointsPossible,
      dueAt: assignments.dueAt,
      descriptionMd: assignments.descriptionMd,
    })
    .from(assignments)
    .where(
      and(eq(assignments.orgId, actor.orgId), eq(assignments.courseId, course.id), eq(assignments.id, assignmentId))
    )
    .limit(1);
  if (!assignment) {
    return unavailable("Assignment unavailable", "This assignment is not in the course you are teaching.");
  }

  /* The whole active roster, in enrollment order, for prev and next. */
  const rosterRows = await db
    .select({
      userId: enrollments.userId,
      currentScore: enrollments.currentScore,
      currentGrade: enrollments.currentGrade,
      name: users.name,
      email: users.email,
    })
    .from(enrollments)
    .innerJoin(users, and(eq(users.id, enrollments.userId), eq(users.orgId, actor.orgId)))
    .where(
      and(
        eq(enrollments.orgId, actor.orgId),
        eq(enrollments.courseId, course.id),
        eq(enrollments.role, "student"),
        eq(enrollments.state, "active")
      )
    )
    .orderBy(asc(users.name));

  const index = rosterRows.findIndex((row) => row.userId === studentId);
  if (index === -1) {
    return unavailable("Student unavailable", "This student is not enrolled in the course you are teaching.");
  }
  const rosterRow = rosterRows[index];

  const [row] = await db
    .select({
      submittedAt: submissions.submittedAt,
      gradedAt: submissions.gradedAt,
      score: submissions.score,
      grade: submissions.grade,
      body: submissions.body,
      url: submissions.url,
      late: submissions.late,
      missing: submissions.missing,
      submissionType: submissions.submissionType,
      feedback: submissions.feedback,
      feedbackAt: submissions.feedbackAt,
      feedbackByName: users.name,
    })
    .from(submissions)
    .leftJoin(users, and(eq(users.id, submissions.feedbackById), eq(users.orgId, actor.orgId)))
    .where(
      and(
        eq(submissions.orgId, actor.orgId),
        eq(submissions.courseId, course.id),
        eq(submissions.assignmentId, assignment.id),
        eq(submissions.userId, studentId)
      )
    )
    .limit(1);

  const [sessionRow] = await db
    .select({ id: sessionSubmissions.id, reportStatus: journeyReports.status })
    .from(sessionSubmissions)
    .leftJoin(journeyReports, eq(journeyReports.submissionId, sessionSubmissions.id))
    .where(
      and(
        eq(sessionSubmissions.orgId, actor.orgId),
        eq(sessionSubmissions.courseId, course.id),
        eq(sessionSubmissions.assignmentId, assignment.id),
        eq(sessionSubmissions.userId, studentId)
      )
    )
    .limit(1);

  /*
   * Documents the instructor attached to the assignment itself, shown beside
   * the work so a grader can read the prompt's own handout without leaving.
   * Student uploads are not modeled as attachments yet: a file submission
   * arrives as `url` on the row, which is what submissionKind reads.
   */
  const documents = await listDocumentAttachments({
    orgId: actor.orgId,
    courseId: course.id,
    owner: { type: "assignment", id: assignment.id },
    audience: "instructor",
  }).catch(() => [] as DocumentAttachmentItem[]);

  const status = row
    ? row.missing
      ? ("missing" as const)
      : row.gradedAt
        ? ("graded" as const)
        : row.submittedAt
          ? ("submitted" as const)
          : ("open" as const)
    : ("open" as const);

  return {
    course: {
      id: course.id,
      code: course.code,
      name: course.name,
      term: course.term ?? scope.term?.name ?? "",
    },
    assignment,
    student: {
      id: rosterRow.userId,
      name: rosterRow.name ?? rosterRow.email ?? "Student",
      email: rosterRow.email,
      standing:
        rosterRow.currentGrade ??
        (typeof rosterRow.currentScore === "number"
          ? `${Math.round(rosterRow.currentScore)} ${gradeLetterFor(rosterRow.currentScore, gradeBandsForCourse(course.gradeBands))}`
          : null),
    },
    submission: {
      kind: submissionKind({
        submissionType: row?.submissionType ?? null,
        body: row?.body ?? null,
        url: row?.url ?? null,
        session: Boolean(sessionRow?.id),
      }),
      status,
      submittedAt: row?.submittedAt ?? null,
      gradedAt: row?.gradedAt ?? null,
      late: Boolean(row?.late),
      score: row?.score ?? null,
      grade: row?.grade ?? null,
      body: row?.body ?? null,
      url: row?.url ?? null,
      feedback: row?.feedback ?? null,
      feedbackAt: row?.feedbackAt ?? null,
      feedbackByName: row?.feedbackByName ?? null,
    },
    documents,
    sessionSubmissionId: sessionRow?.id ?? null,
    sessionReportStatus: (sessionRow?.reportStatus as "draft" | "final" | undefined) ?? null,
    previous: index > 0 ? neighbor(rosterRows[index - 1]) : null,
    next: index < rosterRows.length - 1 ? neighbor(rosterRows[index + 1]) : null,
    position: { index: index + 1, total: rosterRows.length },
  };
}

function neighbor(row: { userId: string; name: string | null; email: string | null }): SubmissionNeighbor {
  return { studentId: row.userId, studentName: row.name ?? row.email ?? "Student" };
}

/**
 * Which shape actually carries the work. An assessed session outranks the
 * mirrored gradebook text, because the session is the record and the text is a
 * reflection of it. Files outrank a link, and a link outranks prose, so the
 * page leads with the artifact a grader has to open.
 */
export function submissionKind(args: {
  submissionType: string | null;
  body: string | null;
  url: string | null;
  session: boolean;
}): SubmissionKind {
  if (args.session || args.submissionType === "session") return "session";
  if (args.submissionType === "file" || args.submissionType === "upload") return "file";
  if (args.url) return "link";
  if (args.body && args.body.trim().length > 0) return "text";
  return "none";
}
