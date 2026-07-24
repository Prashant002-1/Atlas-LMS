import { and, asc, desc, eq, inArray, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  agentSessions,
  announcements,
  assignments,
  changeProposals,
  contentAlignments,
  courses,
  enrollments,
  learningObjectives,
  journeyReports,
  modules,
  sessionAssignments,
  sessionSubmissions,
  submissions,
  users,
} from "@/lib/db/schema";
import { isInstructorLike, type Role } from "@/lib/auth/session";
import { resolveScope, type WorkspaceCourse, type WorkspaceScope } from "@/lib/workspace/scope";
import { loadProposalBlocks } from "@/lib/agent/apply";
import type { Block } from "@/lib/agent/blocks";
import { recordDestination, recordKindOfBlock, reviewRecordLabel } from "@/lib/instructor/review-records";
import type { Objective, ModuleDraft } from "@/lib/workspace/records";
import { courseAiPolicies, type CourseAiPolicy } from "@/lib/db/schema";

export type InstructorAssignment = {
  id?: string;
  title: string;
  detail?: string | null;
  points?: number | null;
  dueAt?: Date | null;
  isPastDue?: boolean;
  objectiveCodes: string[];
  status: "draft" | "approved";
};

export type InstructorStudentProgress = {
  id?: string;
  name: string;
  email?: string | null;
  standing: string;
  submitted: number;
  graded: number;
  missing: number;
  open: number;
  lastActivityAt?: Date | null;
  evidence: string[];
};

export type InstructorWorkProgress = {
  assignmentId?: string;
  title: string;
  dueAt?: Date | null;
  points?: number | null;
  objectiveCodes: string[];
  submitted: number;
  graded: number;
  missing: number;
  open: number;
  responses: number;
};

export type InstructorCourseNotice = {
  id?: string;
  title: string;
  message?: string | null;
  postedAt?: Date | null;
};

export type InstructorAssignmentSubmission = {
  studentId?: string;
  studentName: string;
  standing: string;
  status: "graded" | "submitted" | "missing" | "open";
  submittedAt?: Date | null;
  gradedAt?: Date | null;
  score?: number | null;
  grade?: string | null;
  body?: string | null;
  /** Canonical AI-session drill-in reached from every assignment surface. */
  sessionSubmissionId?: string | null;
  draftScore?: number | null;
  draftReportStatus?: "draft" | "final" | null;
};

export type InstructorStudentWorkItem = {
  assignmentId?: string;
  title: string;
  detail?: string | null;
  dueAt?: Date | null;
  points?: number | null;
  objectiveCodes: string[];
  status: InstructorAssignmentSubmission["status"];
  submittedAt?: Date | null;
  gradedAt?: Date | null;
  score?: number | null;
  grade?: string | null;
  body?: string | null;
};

export type InstructorAssignmentWorkspace = {
  source: InstructorWorkspace["source"];
  course: InstructorWorkspace["course"];
  assignment?: InstructorAssignment;
  materials: ModuleDraft[];
  progress?: InstructorWorkProgress;
  courseObjectives: Objective[];
  submissions: InstructorAssignmentSubmission[];
  problem?: {
    title: string;
    detail: string;
  };
};

export type InstructorStudentWorkspace = {
  source: InstructorWorkspace["source"];
  course: InstructorWorkspace["course"];
  student?: InstructorStudentProgress;
  work: InstructorStudentWorkItem[];
  problem?: {
    title: string;
    detail: string;
  };
};

export type InstructorModuleWorkspace = {
  source: InstructorWorkspace["source"];
  course: InstructorWorkspace["course"];
  module?: ModuleDraft;
  assignments: InstructorAssignment[];
  objectives: Objective[];
  courseObjectives: Objective[];
  problem?: {
    title: string;
    detail: string;
  };
};

export type InstructorProposal = {
  id: string;
  title: string;
  kind: string;
  summary: string;
  status: "pending" | "approved" | "rejected" | "applied";
  createdAt?: Date | null;
  decidedAt?: Date | null;
  /** Typed blocks the agent drafted onto this proposal, in order. */
  blocks: Block[];
  /**
   * What kind of record this draft is, in the noun a professor uses. Read
   * before deciding: a title alone does not say whether approving publishes an
   * announcement or rewrites a rubric.
   */
  recordLabel: string;
  /** After apply: links to the records the blocks created. */
  appliedRecords: InstructorProposalAppliedRecord[];
  /**
   * Where this draft's subject lives, whatever the decision was. An applied
   * draft points at the record it made; a session-shaped draft points at the
   * assignment it targets, which exists whether or not the draft was taken.
   * Null only when nothing is addressable yet.
   */
  destination: InstructorProposalAppliedRecord | null;
  /** The Atlas chat this draft was made in, for reopening the conversation. */
  thread: { id: string; title: string | null } | null;
};

export type InstructorWorkspace = {
  source: "database" | "unavailable";
  course: WorkspaceCourse;
  scope: WorkspaceScope;
  policy: CourseAiPolicy | null;
  objectives: Objective[];
  modules: ModuleDraft[];
  assignments: InstructorAssignment[];
  /** Assignments taken as an AI assignment (a governed session with Atlas). */
  aiAssignmentIds: string[];
  students: InstructorStudentProgress[];
  workProgress: InstructorWorkProgress[];
  notices: InstructorCourseNotice[];
  proposals: InstructorProposal[];
  problem?: {
    title: string;
    detail: string;
  };
};

export type InstructorProposalAppliedRecord = {
  label: string;
  href: string;
};

type Actor = {
  id: string;
  orgId: string | null;
  role: Role;
};

export async function loadInstructorWorkspace(actor?: Actor | null): Promise<InstructorWorkspace> {
  if (!actor?.orgId || !isInstructorLike(actor.role)) {
    return unavailableWorkspace("Course unavailable", "No editable course is attached to this account.");
  }

  const scope = await resolveScope({ orgId: actor.orgId, userId: actor.id, role: actor.role, teachingOnly: true });

  try {
    const course = scope.course
      ? await db
          .select({ id: courses.id, code: courses.code, name: courses.name, term: courses.term, description: courses.description })
          .from(courses)
          .where(and(eq(courses.orgId, actor.orgId), eq(courses.id, scope.course.id)))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : null;
    if (!course) {
      return unavailableWorkspace(
        "No course in this semester",
        scope.term
          ? `You are not teaching anything in ${scope.term.name}. Switch semesters from the header.`
          : "No semester is set up for this organization yet.",
        scope
      );
    }

    const objectiveRows = await db
      .select({
        id: learningObjectives.id,
        code: learningObjectives.code,
        description: learningObjectives.description,
        bloomLevel: learningObjectives.bloomLevel,
        assessmentWeight: learningObjectives.assessmentWeight,
      })
      .from(learningObjectives)
      .where(and(eq(learningObjectives.orgId, actor.orgId), eq(learningObjectives.courseId, course.id)))
      .orderBy(asc(learningObjectives.code));

    const moduleRows = await db
      .select({
        id: modules.id,
        name: modules.name,
        summaryMd: modules.summaryMd,
        position: modules.position,
        published: modules.published,
      })
      .from(modules)
      .where(and(eq(modules.orgId, actor.orgId), eq(modules.courseId, course.id)))
      .orderBy(asc(modules.position), asc(modules.createdAt))
      .limit(14);

    const assignmentRows = await db
      .select({
        id: assignments.id,
        name: assignments.name,
        descriptionMd: assignments.descriptionMd,
        pointsPossible: assignments.pointsPossible,
        dueAt: assignments.dueAt,
        position: assignments.position,
        published: assignments.published,
      })
      .from(assignments)
      .where(and(eq(assignments.orgId, actor.orgId), eq(assignments.courseId, course.id)))
      .orderBy(asc(assignments.position), asc(assignments.dueAt), asc(assignments.createdAt))
      .limit(20);

    const moduleIds = moduleRows.map((module) => module.id);
    const moduleAlignmentRows =
      moduleIds.length > 0
        ? await db
            .select({
              itemId: contentAlignments.itemId,
              objectiveId: contentAlignments.objectiveId,
              weight: contentAlignments.weight,
            })
            .from(contentAlignments)
            .where(
              and(
                eq(contentAlignments.orgId, actor.orgId),
                eq(contentAlignments.itemType, "module"),
                inArray(contentAlignments.itemId, moduleIds)
              )
            )
        : [];

    const assignmentIds = assignmentRows.map((assignment) => assignment.id);

    // Which of these are AI assignments (taken as a governed session with
    // Atlas): a plain fact on the work rows, not a separate showcase.
    const aiAssignmentRows = await db
      .select({ assignmentId: sessionAssignments.assignmentId })
      .from(sessionAssignments)
      .where(and(eq(sessionAssignments.orgId, actor.orgId), eq(sessionAssignments.courseId, course.id)));
    const assignmentAlignmentRows =
      assignmentIds.length > 0
        ? await db
            .select({
              itemId: contentAlignments.itemId,
              objectiveId: contentAlignments.objectiveId,
              weight: contentAlignments.weight,
            })
            .from(contentAlignments)
            .where(
              and(
                eq(contentAlignments.orgId, actor.orgId),
                eq(contentAlignments.itemType, "assignment"),
                inArray(contentAlignments.itemId, assignmentIds)
              )
            )
        : [];

    const studentEnrollmentRows = await db
      .select({
        userId: enrollments.userId,
        currentScore: enrollments.currentScore,
        currentGrade: enrollments.currentGrade,
        lastActivityAt: enrollments.lastActivityAt,
        createdAt: enrollments.createdAt,
      })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.orgId, actor.orgId),
          eq(enrollments.courseId, course.id),
          eq(enrollments.role, "student"),
          eq(enrollments.state, "active")
        )
      )
      .orderBy(asc(enrollments.createdAt))
      .limit(80);

    const studentIds = studentEnrollmentRows.map((enrollment) => enrollment.userId);
    const studentRows =
      studentIds.length > 0
        ? await db
            .select({
              id: users.id,
              name: users.name,
              email: users.email,
            })
            .from(users)
            .where(and(eq(users.orgId, actor.orgId), inArray(users.id, studentIds)))
        : [];

    const submissionRows =
      assignmentIds.length > 0 && studentIds.length > 0
        ? await db
            .select({
              assignmentId: submissions.assignmentId,
              userId: submissions.userId,
              submittedAt: submissions.submittedAt,
              gradedAt: submissions.gradedAt,
              score: submissions.score,
              grade: submissions.grade,
              missing: submissions.missing,
              body: submissions.body,
            })
            .from(submissions)
            .where(
              and(
                eq(submissions.orgId, actor.orgId),
                eq(submissions.courseId, course.id),
                inArray(submissions.assignmentId, assignmentIds),
                inArray(submissions.userId, studentIds)
              )
            )
        : [];

    const proposalRows = await db
      .select({
        id: changeProposals.id,
        kind: changeProposals.kind,
        status: changeProposals.status,
        summary: changeProposals.summary,
        diff: changeProposals.diff,
        sessionId: changeProposals.sessionId,
        createdAt: changeProposals.createdAt,
        decidedAt: changeProposals.decidedAt,
      })
      .from(changeProposals)
      .where(and(eq(changeProposals.orgId, actor.orgId), eq(changeProposals.courseId, course.id)))
      .orderBy(desc(changeProposals.createdAt))
      .limit(50);

    /* The Atlas chats the drafts came from, course-scoped, titles only. */
    const proposalSessionIds = [
      ...new Set(proposalRows.map((row) => row.sessionId).filter((value): value is string => value !== null)),
    ];
    const proposalThreadRows = proposalSessionIds.length
      ? await db
          .select({ id: agentSessions.id, title: agentSessions.title })
          .from(agentSessions)
          .where(
            and(
              eq(agentSessions.orgId, actor.orgId),
              eq(agentSessions.courseId, course.id),
              inArray(agentSessions.id, proposalSessionIds)
            )
          )
      : [];
    const proposalThreadById = new Map(proposalThreadRows.map((row) => [row.id, row.title]));

    const noticeRows = await db
      .select({
        id: announcements.id,
        title: announcements.title,
        message: announcements.messageMd,
        postedAt: announcements.postedAt,
      })
      .from(announcements)
      .where(and(eq(announcements.orgId, actor.orgId), eq(announcements.courseId, course.id), eq(announcements.published, true), lte(announcements.postedAt, new Date())))
      .orderBy(desc(announcements.postedAt))
      .limit(5);

    const [policy] = await db
      .select()
      .from(courseAiPolicies)
      .where(and(eq(courseAiPolicies.orgId, actor.orgId), eq(courseAiPolicies.courseId, course.id)))
      .limit(1);

    const proposals: InstructorProposal[] = [];
    for (const row of proposalRows) {
      const blockEntries = await loadProposalBlocks(actor.orgId, row.id);
      const blocks = blockEntries.map((e) => e.block).filter((b): b is Block => b !== null);
      proposals.push({
        id: row.id,
        title: proposalTitle(blocks, row.summary),
        kind: row.kind,
        summary: row.summary,
        status: row.status,
        createdAt: row.createdAt,
        decidedAt: row.decidedAt,
        blocks,
        recordLabel: reviewRecordLabel({ blocks, kind: row.kind }),
        appliedRecords: blockEntries
          .filter((e) => e.row.status === "applied" && e.row.appliedItemId)
          .map((e) => appliedRecordLink(e.row.appliedItemType, e.row.appliedItemId!))
          .filter((r): r is InstructorProposalAppliedRecord => r !== null),
        destination: proposalDestination(blocks, blockEntries),
        thread:
          row.sessionId && proposalThreadById.has(row.sessionId)
            ? { id: row.sessionId, title: proposalThreadById.get(row.sessionId) ?? null }
            : null,
      });
    }

    return {
      source: "database",
      course: {
        id: course.id,
        code: course.code,
        name: course.name,
        term: course.term ?? scope.term?.name ?? "",
        description: course.description,
      },
      scope,
      policy: policy ?? null,
      objectives: toObjectives(objectiveRows, moduleRows, assignmentRows, [...moduleAlignmentRows, ...assignmentAlignmentRows]),
      modules: toModuleDrafts(moduleRows, moduleAlignmentRows, objectiveRows),
      assignments: toAssignmentDrafts(assignmentRows, assignmentAlignmentRows, objectiveRows),
      aiAssignmentIds: aiAssignmentRows.map((row) => row.assignmentId),
      students: toStudentProgress(studentEnrollmentRows, studentRows, assignmentRows, submissionRows),
      workProgress: toWorkProgress(assignmentRows, assignmentAlignmentRows, objectiveRows, submissionRows, studentEnrollmentRows.length),
      notices: noticeRows,
      proposals,
    };
  } catch {
    return unavailableWorkspace("Course unavailable", "This course could not be loaded.", scope);
  }
}

function proposalTitle(blocks: Block[], summary: string): string {
  const first = blocks[0];
  if (first) {
    if ("name" in first && typeof first.name === "string") return first.name;
    if ("title" in first && typeof first.title === "string") return first.title;
    if (first.type === "objective") return `${first.code}: ${first.description.slice(0, 80)}`;
  }
  return summary.slice(0, 90) || "Drafted change";
}

function appliedRecordLink(itemType: string | null, itemId: string): InstructorProposalAppliedRecord | null {
  if (itemType === "module") return { label: "Module", href: `/teach/week/${itemId}` };
  if (itemType === "assignment") return { label: "Assignment", href: `/teach/assignments/${itemId}` };
  /* Pages and practice sets have their own record page now. */
  if (itemType === "page" || itemType === "quiz") return { label: "Record", href: `/teach/records/${itemId}` };
  return null;
}

/**
 * The one place a Review card sends you when clicked.
 *
 * An applied draft points at the record it created. A session-shaped draft
 * (rubric revision, AI assignment) points at the assignment it targets, which
 * exists in the course whether or not the draft was taken, so a dismissed
 * rubric revision is still openable next to the rubric it would have replaced.
 * Anything with no addressable subject yet returns null and the card stays
 * unlinked rather than pointing somewhere useless.
 */
function proposalDestination(
  blocks: Block[],
  entries: Awaited<ReturnType<typeof loadProposalBlocks>>
): InstructorProposalAppliedRecord | null {
  const appliedEntry = entries.find((entry) => entry.row.status === "applied" && entry.row.appliedItemId);
  if (appliedEntry?.row.appliedItemId) {
    const link = appliedRecordLink(appliedEntry.row.appliedItemType, appliedEntry.row.appliedItemId);
    if (link) return link;
  }

  const first = blocks[0];
  if (!first) return null;
  const assignmentId =
    "assignmentId" in first && typeof first.assignmentId === "string" ? first.assignmentId : null;
  return recordDestination({ kind: recordKindOfBlock(first), recordId: null, assignmentId });
}

/**
 * The course in scope for teaching: honors the term + course cookies via
 * resolveScope, then verifies the row. Falls back to the first course the
 * actor teaches in the term in view.
 */
export async function findEditableCourse(actor: Actor) {
  if (!actor.orgId) return null;

  const scope = await resolveScope({
    orgId: actor.orgId,
    userId: actor.id,
    role: actor.role,
    teachingOnly: true,
  });
  if (!scope.course) return null;

  const [course] = await db
    .select({ id: courses.id, code: courses.code, name: courses.name, term: courses.term })
    .from(courses)
    .where(and(eq(courses.orgId, actor.orgId), eq(courses.id, scope.course.id)))
    .limit(1);

  return course ?? null;
}

/* ── gradebook: every student against every assignment ───────── */

export type GradebookColumn = {
  id: string;
  name: string;
  points: number | null;
  dueAt: Date | null;
  published: boolean;
};

export type GradebookCell = {
  status: "graded" | "submitted" | "missing" | "open";
  score: number | null;
  grade: string | null;
};

export type GradebookRow = {
  studentId: string;
  name: string;
  standing: string | null;
  /** Aligned with the columns array; null when nothing exists for the pair. */
  cells: Array<GradebookCell | null>;
};

export type InstructorGradebook = {
  course: WorkspaceCourse;
  columns: GradebookColumn[];
  rows: GradebookRow[];
  problem?: { title: string; detail: string };
};

/**
 * The gradebook: the whole class against the whole course, one cell per
 * student and assignment, straight from the submissions rows.
 */
export async function loadInstructorGradebook(actor?: Actor | null): Promise<InstructorGradebook> {
  const failed = (title: string, detail: string): InstructorGradebook => ({
    course: { code: "Course", name: title, term: "" },
    columns: [],
    rows: [],
    problem: { title, detail },
  });

  if (!actor?.orgId || !isInstructorLike(actor.role)) {
    return failed("Course unavailable", "No editable course is attached to this account.");
  }
  const course = await findEditableCourse(actor);
  if (!course) {
    return failed("No course in this semester", "You are not teaching anything in the term in view.");
  }

  const [assignmentRows, enrollmentRows] = await Promise.all([
    db
      .select({
        id: assignments.id,
        name: assignments.name,
        pointsPossible: assignments.pointsPossible,
        dueAt: assignments.dueAt,
        published: assignments.published,
        position: assignments.position,
        createdAt: assignments.createdAt,
      })
      .from(assignments)
      .where(and(eq(assignments.orgId, actor.orgId), eq(assignments.courseId, course.id)))
      .orderBy(asc(assignments.position), asc(assignments.dueAt), asc(assignments.createdAt)),
    db
      .select({
        userId: enrollments.userId,
        currentScore: enrollments.currentScore,
        currentGrade: enrollments.currentGrade,
        createdAt: enrollments.createdAt,
      })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.orgId, actor.orgId),
          eq(enrollments.courseId, course.id),
          eq(enrollments.role, "student"),
          eq(enrollments.state, "active")
        )
      )
      .orderBy(asc(enrollments.createdAt)),
  ]);

  const studentIds = enrollmentRows.map((row) => row.userId);
  const [studentRows, submissionRows] = await Promise.all([
    studentIds.length > 0
      ? db
          .select({ id: users.id, name: users.name })
          .from(users)
          .where(and(eq(users.orgId, actor.orgId), inArray(users.id, studentIds)))
      : Promise.resolve([] as Array<{ id: string; name: string | null }>),
    studentIds.length > 0 && assignmentRows.length > 0
      ? db
          .select({
            assignmentId: submissions.assignmentId,
            userId: submissions.userId,
            submittedAt: submissions.submittedAt,
            gradedAt: submissions.gradedAt,
            score: submissions.score,
            grade: submissions.grade,
            missing: submissions.missing,
          })
          .from(submissions)
          .where(and(eq(submissions.orgId, actor.orgId), eq(submissions.courseId, course.id), inArray(submissions.userId, studentIds)))
      : Promise.resolve(
          [] as Array<{
            assignmentId: string;
            userId: string;
            submittedAt: Date | null;
            gradedAt: Date | null;
            score: number | null;
            grade: string | null;
            missing: boolean;
          }>
        ),
  ]);

  const nameById = new Map(studentRows.map((row) => [row.id, row.name ?? "Student"]));
  const cellByPair = new Map(submissionRows.map((row) => [`${row.assignmentId}:${row.userId}`, row]));

  const columns: GradebookColumn[] = assignmentRows.map((row) => ({
    id: row.id,
    name: row.name,
    points: row.pointsPossible,
    dueAt: row.dueAt,
    published: row.published,
  }));

  const rows: GradebookRow[] = enrollmentRows
    .map((enrollment) => ({
      studentId: enrollment.userId,
      name: nameById.get(enrollment.userId) ?? "Student",
      standing:
        enrollment.currentGrade ??
        (typeof enrollment.currentScore === "number" ? `${Math.round(enrollment.currentScore)}%` : null),
      cells: columns.map((column) => {
        const cell = cellByPair.get(`${column.id}:${enrollment.userId}`);
        if (!cell) return null;
        const status: GradebookCell["status"] = cell.missing
          ? "missing"
          : cell.gradedAt
            ? "graded"
            : cell.submittedAt
              ? "submitted"
              : "open";
        return { status, score: cell.score, grade: cell.grade };
      }),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    course: { id: course.id, code: course.code, name: course.name, term: course.term ?? "" },
    columns,
    rows,
  };
}

/* ── calendar: the course's dated facts in a window ──────────── */

export type InstructorCalendarEntry = {
  date: Date;
  kind: "due" | "opens";
  title: string;
  href: string;
  published: boolean;
};

export type InstructorCalendar = {
  course: WorkspaceCourse;
  entries: InstructorCalendarEntry[];
  problem?: { title: string; detail: string };
};

/**
 * The teaching calendar: assignment due dates and module openings for the
 * course in view, drafts included and marked. A projection of the rows, not
 * a separate event model.
 */
export async function loadInstructorCalendar(
  actor: Actor | null | undefined,
  window: { from: Date; to: Date }
): Promise<InstructorCalendar> {
  const failed = (title: string, detail: string): InstructorCalendar => ({
    course: { code: "Course", name: title, term: "" },
    entries: [],
    problem: { title, detail },
  });

  if (!actor?.orgId || !isInstructorLike(actor.role)) {
    return failed("Course unavailable", "No editable course is attached to this account.");
  }
  const course = await findEditableCourse(actor);
  if (!course) {
    return failed("No course in this semester", "You are not teaching anything in the term in view.");
  }

  const [assignmentRows, moduleRows] = await Promise.all([
    db
      .select({ id: assignments.id, name: assignments.name, dueAt: assignments.dueAt, published: assignments.published })
      .from(assignments)
      .where(and(eq(assignments.orgId, actor.orgId), eq(assignments.courseId, course.id))),
    db
      .select({ id: modules.id, name: modules.name, unlockAt: modules.unlockAt, published: modules.published })
      .from(modules)
      .where(and(eq(modules.orgId, actor.orgId), eq(modules.courseId, course.id))),
  ]);

  const inWindow = (date: Date) => date.getTime() >= window.from.getTime() && date.getTime() <= window.to.getTime();

  const entries: InstructorCalendarEntry[] = [];
  for (const a of assignmentRows) {
    if (!a.dueAt || !inWindow(a.dueAt)) continue;
    entries.push({ date: a.dueAt, kind: "due", title: a.name, href: `/teach/assignments/${a.id}`, published: a.published });
  }
  for (const m of moduleRows) {
    if (!m.unlockAt || !inWindow(m.unlockAt)) continue;
    entries.push({ date: m.unlockAt, kind: "opens", title: m.name, href: `/teach/week/${m.id}`, published: m.published });
  }

  entries.sort((a, b) => a.date.getTime() - b.date.getTime());
  return {
    course: { id: course.id, code: course.code, name: course.name, term: course.term ?? "" },
    entries,
  };
}

export async function loadInstructorAssignmentWorkspace(
  actor: Actor | null | undefined,
  assignmentId: string
): Promise<InstructorAssignmentWorkspace> {
  const workspace = await loadInstructorWorkspace(actor);
  const base = {
    source: workspace.source,
    course: workspace.course,
    materials: [] as ModuleDraft[],
    courseObjectives: workspace.objectives,
    submissions: [] as InstructorAssignmentSubmission[],
  };

  if (workspace.problem) {
    return {
      ...base,
      problem: workspace.problem,
    };
  }

  const assignment = workspace.assignments.find((item) => item.id === assignmentId);
  if (!assignment) {
    return {
      ...base,
      problem: {
        title: "Assignment unavailable",
        detail: "This work is not in a course you teach.",
      },
    };
  }

  const progress =
    workspace.workProgress.find((item) => item.assignmentId === assignment.id) ??
    emptyWorkProgress(assignment);
  const objectiveCodes = new Set(assignment.objectiveCodes);
  const materials = workspace.modules.filter((module) => module.objectiveCodes.some((code) => objectiveCodes.has(code)));

  if (!actor?.orgId || !workspace.course.id || workspace.source !== "database") {
    return {
      ...base,
      assignment,
      materials,
      progress,
      submissions: previewSubmissions(workspace.students),
    };
  }

  const studentEnrollmentRows = await db
    .select({
      userId: enrollments.userId,
      currentScore: enrollments.currentScore,
      currentGrade: enrollments.currentGrade,
      createdAt: enrollments.createdAt,
    })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.orgId, actor.orgId),
        eq(enrollments.courseId, workspace.course.id),
        eq(enrollments.role, "student"),
        eq(enrollments.state, "active")
      )
    )
    .orderBy(asc(enrollments.createdAt))
    .limit(80);

  const studentIds = studentEnrollmentRows.map((enrollment) => enrollment.userId);
  const studentRows =
    studentIds.length > 0
      ? await db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
          })
          .from(users)
          .where(and(eq(users.orgId, actor.orgId), inArray(users.id, studentIds)))
      : [];

  const submissionRows =
    studentIds.length > 0
      ? await db
          .select({
            userId: submissions.userId,
            submittedAt: submissions.submittedAt,
            gradedAt: submissions.gradedAt,
            score: submissions.score,
            grade: submissions.grade,
            missing: submissions.missing,
            body: submissions.body,
          })
          .from(submissions)
          .where(
            and(
              eq(submissions.orgId, actor.orgId),
              eq(submissions.courseId, workspace.course.id),
              eq(submissions.assignmentId, assignment.id ?? ""),
              inArray(submissions.userId, studentIds)
            )
          )
      : [];

  const sessionSubmissionRows =
    studentIds.length > 0
      ? await db
          .select({
            id: sessionSubmissions.id,
            userId: sessionSubmissions.userId,
            draftScore: journeyReports.overallScore,
            reportStatus: journeyReports.status,
          })
          .from(sessionSubmissions)
          .leftJoin(journeyReports, eq(journeyReports.submissionId, sessionSubmissions.id))
          .where(
            and(
              eq(sessionSubmissions.orgId, actor.orgId),
              eq(sessionSubmissions.courseId, workspace.course.id),
              eq(sessionSubmissions.assignmentId, assignment.id ?? ""),
              inArray(sessionSubmissions.userId, studentIds)
            )
          )
      : [];

  const userById = new Map(studentRows.map((user) => [user.id, user]));
  const submissionByUser = new Map(submissionRows.map((submission) => [submission.userId, submission]));
  const sessionSubmissionByUser = new Map(sessionSubmissionRows.map((submission) => [submission.userId, submission]));
  const roster = studentEnrollmentRows.map((enrollment) => {
    const user = userById.get(enrollment.userId);
    const submission = submissionByUser.get(enrollment.userId);

    return {
      studentId: enrollment.userId,
      studentName: user?.name ?? user?.email ?? "Student",
      standing: enrollment.currentGrade ?? scoreLabel(enrollment.currentScore, 100) ?? "-",
      status: submissionStatus(submission),
      submittedAt: submission?.submittedAt,
      gradedAt: submission?.gradedAt,
      score: submission?.score,
      grade: submission?.grade,
      body: submission?.body,
      sessionSubmissionId: sessionSubmissionByUser.get(enrollment.userId)?.id ?? null,
      draftScore: sessionSubmissionByUser.get(enrollment.userId)?.draftScore ?? null,
      draftReportStatus: sessionSubmissionByUser.get(enrollment.userId)?.reportStatus ?? null,
    };
  });

  return {
    ...base,
    assignment,
    materials,
    progress,
    submissions: roster,
  };
}

export async function loadInstructorModuleWorkspace(
  actor: Actor | null | undefined,
  moduleId: string
): Promise<InstructorModuleWorkspace> {
  const workspace = await loadInstructorWorkspace(actor);
  const base = {
    source: workspace.source,
    course: workspace.course,
    assignments: [] as InstructorAssignment[],
    objectives: [] as Objective[],
    courseObjectives: workspace.objectives,
  };

  if (workspace.problem) {
    return {
      ...base,
      problem: workspace.problem,
    };
  }

  const courseModule = workspace.modules.find((item) => item.id === moduleId);
  if (!courseModule) {
    return {
      ...base,
      problem: {
        title: "Week unavailable",
        detail: "This module is not in a course you teach.",
      },
    };
  }

  const objectiveCodes = new Set(courseModule.objectiveCodes);
  const objectives = workspace.objectives.filter((objective) => objectiveCodes.has(objective.code));
  const assignments = workspace.assignments.filter((assignment) => assignment.objectiveCodes.some((code) => objectiveCodes.has(code)));

  return {
    ...base,
    module: courseModule,
    assignments,
    objectives,
  };
}

export async function loadInstructorStudentWorkspace(
  actor: Actor | null | undefined,
  studentId: string
): Promise<InstructorStudentWorkspace> {
  const workspace = await loadInstructorWorkspace(actor);
  const base = {
    source: workspace.source,
    course: workspace.course,
    work: [] as InstructorStudentWorkItem[],
  };

  if (workspace.problem) {
    return {
      ...base,
      problem: workspace.problem,
    };
  }

  const student = workspace.students.find((item) => item.id === studentId);
  if (!student) {
    return {
      ...base,
      problem: {
        title: "Student unavailable",
        detail: "This student is not enrolled in a course you teach.",
      },
    };
  }

  const publishedAssignments = workspace.assignments.filter((assignment) => assignment.id && assignment.status === "approved");
  if (!actor?.orgId || !workspace.course.id || workspace.source !== "database") {
    return {
      ...base,
      student,
      work: publishedAssignments.map((assignment) => ({
        assignmentId: assignment.id,
        title: assignment.title,
        detail: assignment.detail,
        dueAt: assignment.dueAt,
        points: assignment.points,
        objectiveCodes: assignment.objectiveCodes,
        status: "open" as const,
      })),
    };
  }

  const assignmentIds = publishedAssignments.map((assignment) => assignment.id).filter((id): id is string => Boolean(id));
  const submissionRows =
    assignmentIds.length > 0
      ? await db
          .select({
            assignmentId: submissions.assignmentId,
            submittedAt: submissions.submittedAt,
            gradedAt: submissions.gradedAt,
            score: submissions.score,
            grade: submissions.grade,
            missing: submissions.missing,
            body: submissions.body,
          })
          .from(submissions)
          .where(
            and(
              eq(submissions.orgId, actor.orgId),
              eq(submissions.courseId, workspace.course.id),
              eq(submissions.userId, studentId),
              inArray(submissions.assignmentId, assignmentIds)
            )
          )
      : [];
  const submissionByAssignment = new Map(submissionRows.map((submission) => [submission.assignmentId, submission]));

  return {
    ...base,
    student,
    work: publishedAssignments
      .map((assignment) => {
        const submission = assignment.id ? submissionByAssignment.get(assignment.id) : undefined;
        return {
          assignmentId: assignment.id,
          title: assignment.title,
          detail: assignment.detail,
          dueAt: assignment.dueAt,
          points: assignment.points,
          objectiveCodes: assignment.objectiveCodes,
          status: submissionStatus(submission),
          submittedAt: submission?.submittedAt,
          gradedAt: submission?.gradedAt,
          score: submission?.score,
          grade: submission?.grade,
          body: submission?.body,
        };
      })
      .sort((a, b) => studentWorkOrder(a.status) - studentWorkOrder(b.status)),
  };
}

function emptyWorkProgress(assignment: InstructorAssignment): InstructorWorkProgress {
  return {
    assignmentId: assignment.id,
    title: assignment.title,
    dueAt: assignment.dueAt,
    points: assignment.points,
    objectiveCodes: assignment.objectiveCodes,
    submitted: 0,
    graded: 0,
    missing: 0,
    open: 0,
    responses: 0,
  };
}

function previewSubmissions(students: InstructorStudentProgress[]): InstructorAssignmentSubmission[] {
  return students.map((student) => ({
    studentId: student.id,
    studentName: student.name,
    standing: student.standing,
    status: student.graded > 0 ? "graded" : student.submitted > 0 ? "submitted" : student.missing > 0 ? "missing" : "open",
  }));
}

function unavailableWorkspace(title: string, detail: string, scope?: WorkspaceScope): InstructorWorkspace {
  return {
    source: "unavailable",
    course: { code: "Course", name: title, term: scope?.term?.name ?? "", description: detail },
    scope: scope ?? { term: null, terms: [], course: null, courses: [] },
    policy: null,
    objectives: [],
    modules: [],
    assignments: [],
    aiAssignmentIds: [],
    students: [],
    workProgress: [],
    notices: [],
    proposals: [],
    problem: { title, detail },
  };
}

function toObjectives(
  objectiveRows: Array<{
    id: string;
    code: string;
    description: string;
    bloomLevel: string | null;
    assessmentWeight: number | null;
  }>,
  moduleRows: Array<{
    id: string;
    name: string;
    position: number | null;
    published: boolean;
  }>,
  assignmentRows: Array<{
    id: string;
    name: string;
    published: boolean;
  }>,
  alignmentRows: Array<{
    itemId: string;
    objectiveId: string;
    weight: number;
  }>
): Objective[] {
  const itemById = new Map<
    string,
    {
      label: string;
      published: boolean;
    }
  >();

  moduleRows.forEach((module, index) => {
    const week = module.position ?? index + 1;
    itemById.set(module.id, {
      label: `Week ${String(week).padStart(2, "0")}: ${module.name}`,
      published: module.published,
    });
  });

  assignmentRows.forEach((assignment) => {
    itemById.set(assignment.id, {
      label: `Work: ${assignment.name}`,
      published: assignment.published,
    });
  });

  const alignmentsByObjective = new Map<string, typeof alignmentRows>();

  for (const alignment of alignmentRows) {
    const rows = alignmentsByObjective.get(alignment.objectiveId) ?? [];
    rows.push(alignment);
    alignmentsByObjective.set(alignment.objectiveId, rows);
  }

  return objectiveRows.map((objective) => {
    const rows = alignmentsByObjective.get(objective.id) ?? [];
    const totalWeight = rows.reduce((sum, row) => sum + row.weight, 0);
    const liveWeight = rows.reduce((sum, row) => {
      const item = itemById.get(row.itemId);
      return item?.published ? sum + row.weight : sum;
    }, 0);
    const evidence = rows
      .map((row) => {
        const item = itemById.get(row.itemId);
        if (!item) return null;
        const state = item.published ? "Live" : "Draft";
        return `${item.label} - ${state}`;
      })
      .filter((value): value is string => Boolean(value))
      .slice(0, 4);

    return {
      code: objective.code,
      title: objectiveTitle(objective.description),
      description: objective.description,
      bloom: objective.bloomLevel ?? "objective",
      assessedWeight: Math.round((objective.assessmentWeight ?? 0) * 100),
      coverage: totalWeight > 0 ? Math.round((liveWeight / totalWeight) * 100) : 0,
      evidence,
    };
  });
}

/** Short display title from an objective's description ("Summarize data with…" → "Summarize data"). */
function objectiveTitle(description: string): string {
  const words = description.replace(/[.!?].*$/, "").split(/\s+/);
  const short = words.slice(0, 4).join(" ");
  return short.length > 2 ? short : description.slice(0, 40);
}

function toModuleDrafts(
  moduleRows: Array<{
    id: string;
    name: string;
    summaryMd: string | null;
    position: number | null;
    published: boolean;
  }>,
  alignmentRows: Array<{
    itemId: string;
    objectiveId: string;
    weight?: number;
  }>,
  objectiveRows: Array<{
    id: string;
    code: string;
  }>
): ModuleDraft[] {
  const objectiveCodeById = new Map(objectiveRows.map((objective) => [objective.id, objective.code]));
  const codesByModule = new Map<string, string[]>();

  for (const alignment of alignmentRows) {
    const code = objectiveCodeById.get(alignment.objectiveId);
    if (!code) continue;
    const codes = codesByModule.get(alignment.itemId) ?? [];
    codes.push(code);
    codesByModule.set(alignment.itemId, Array.from(new Set(codes)));
  }

  return moduleRows.map((module, index) => ({
    id: module.id,
    week: String(module.position ?? index + 1).padStart(2, "0"),
    title: module.name,
    summary: module.summaryMd,
    objectiveCodes: codesByModule.get(module.id) ?? [],
    status: module.published ? "approved" : "draft",
  }));
}

function toAssignmentDrafts(
  assignmentRows: Array<{
    id: string;
    name: string;
    descriptionMd: string | null;
    pointsPossible: number | null;
    dueAt: Date | null;
    published: boolean;
  }>,
  alignmentRows: Array<{
    itemId: string;
    objectiveId: string;
  }>,
  objectiveRows: Array<{
    id: string;
    code: string;
  }>
): InstructorAssignment[] {
  const objectiveCodeById = new Map(objectiveRows.map((objective) => [objective.id, objective.code]));
  const codesByAssignment = new Map<string, string[]>();

  for (const alignment of alignmentRows) {
    const code = objectiveCodeById.get(alignment.objectiveId);
    if (!code) continue;
    const codes = codesByAssignment.get(alignment.itemId) ?? [];
    codes.push(code);
    codesByAssignment.set(alignment.itemId, Array.from(new Set(codes)));
  }

  const now = Date.now();

  return assignmentRows.map((assignment) => ({
    id: assignment.id,
    title: assignment.name,
    detail: assignment.descriptionMd,
    points: assignment.pointsPossible,
    dueAt: assignment.dueAt,
    isPastDue: assignment.dueAt ? assignment.dueAt.getTime() < now : false,
    objectiveCodes: codesByAssignment.get(assignment.id) ?? [],
    status: assignment.published ? "approved" : "draft",
  }));
}

function toStudentProgress(
  enrollmentRows: Array<{
    userId: string;
    currentScore: number | null;
    currentGrade: string | null;
    lastActivityAt: Date | null;
  }>,
  userRows: Array<{
    id: string;
    name: string | null;
    email: string;
  }>,
  assignmentRows: Array<{
    id: string;
    name: string;
    pointsPossible: number | null;
    published: boolean;
  }>,
  submissionRows: Array<{
    assignmentId: string;
    userId: string;
    submittedAt: Date | null;
    gradedAt: Date | null;
    score: number | null;
    grade: string | null;
    missing: boolean;
  }>
): InstructorStudentProgress[] {
  const userById = new Map(userRows.map((user) => [user.id, user]));
  const publishedAssignments = assignmentRows.filter((assignment) => assignment.published);
  const assignmentById = new Map(assignmentRows.map((assignment) => [assignment.id, assignment]));

  return enrollmentRows.map((enrollment) => {
    const user = userById.get(enrollment.userId);
    const rows = submissionRows.filter((submission) => {
      const assignment = assignmentById.get(submission.assignmentId);
      return submission.userId === enrollment.userId && Boolean(assignment?.published);
    });
    const submitted = rows.filter((submission) => submission.submittedAt && !submission.missing).length;
    const graded = rows.filter((submission) => submission.gradedAt && !submission.missing).length;
    const missing = rows.filter((submission) => submission.missing).length;
    const open = Math.max(0, publishedAssignments.length - submitted - missing);
    const evidence = [...rows]
      .filter((submission) => submission.submittedAt || submission.gradedAt || submission.missing)
      .sort((a, b) => submissionTime(b) - submissionTime(a))
      .map((submission) => {
        const assignment = assignmentById.get(submission.assignmentId);
        const status =
          submission.grade ??
          scoreLabel(submission.score, assignment?.pointsPossible) ??
          (submission.missing ? "Missing" : submission.gradedAt ? "Graded" : "Submitted");
        return `${assignment?.name ?? "Assignment"}, ${status}`;
      })
      .slice(0, 2);

    return {
      id: enrollment.userId,
      name: user?.name ?? user?.email ?? "Student",
      email: user?.email,
      standing: enrollment.currentGrade ?? scoreLabel(enrollment.currentScore, 100) ?? "-",
      submitted,
      graded,
      missing,
      open,
      lastActivityAt: enrollment.lastActivityAt,
      evidence,
    };
  });
}

function toWorkProgress(
  assignmentRows: Array<{
    id: string;
    name: string;
    dueAt: Date | null;
    pointsPossible: number | null;
    published: boolean;
  }>,
  alignmentRows: Array<{
    itemId: string;
    objectiveId: string;
  }>,
  objectiveRows: Array<{
    id: string;
    code: string;
  }>,
  submissionRows: Array<{
    assignmentId: string;
    submittedAt: Date | null;
    gradedAt: Date | null;
    missing: boolean;
    body?: string | null;
  }>,
  studentCount: number
): InstructorWorkProgress[] {
  const objectiveCodeById = new Map(objectiveRows.map((objective) => [objective.id, objective.code]));
  const codesByAssignment = new Map<string, string[]>();

  for (const alignment of alignmentRows) {
    const code = objectiveCodeById.get(alignment.objectiveId);
    if (!code) continue;
    const codes = codesByAssignment.get(alignment.itemId) ?? [];
    codes.push(code);
    codesByAssignment.set(alignment.itemId, Array.from(new Set(codes)));
  }

  return assignmentRows
    .filter((assignment) => assignment.published)
    .map((assignment) => {
      const rows = submissionRows.filter((submission) => submission.assignmentId === assignment.id);
      const submitted = rows.filter((submission) => submission.submittedAt && !submission.missing).length;
      const graded = rows.filter((submission) => submission.gradedAt && !submission.missing).length;
      const missing = rows.filter((submission) => submission.missing).length;
      const open = Math.max(0, studentCount - submitted - missing);
      const responses = rows.filter((submission) => Boolean(submission.body?.trim())).length;

      return {
        assignmentId: assignment.id,
        title: assignment.name,
        dueAt: assignment.dueAt,
        points: assignment.pointsPossible,
        objectiveCodes: codesByAssignment.get(assignment.id) ?? [],
        submitted,
        graded,
        missing,
        open,
        responses,
      };
    });
}

function scoreLabel(score?: number | null, possible?: number | null) {
  if (typeof score !== "number") return null;
  if (typeof possible === "number" && possible > 0) return `${Math.round(score)}/${Math.round(possible)}`;
  return `${Math.round(score)}%`;
}

function submissionStatus(submission?: { gradedAt: Date | null; submittedAt: Date | null; missing: boolean } | null): InstructorAssignmentSubmission["status"] {
  if (submission?.missing) return "missing";
  if (submission?.gradedAt) return "graded";
  if (submission?.submittedAt) return "submitted";
  return "open";
}

function studentWorkOrder(status: InstructorAssignmentSubmission["status"]) {
  return { missing: 0, submitted: 1, open: 2, graded: 3 }[status];
}

function submissionTime(submission: { submittedAt: Date | null; gradedAt: Date | null }) {
  return submission.gradedAt?.getTime() ?? submission.submittedAt?.getTime() ?? 0;
}
