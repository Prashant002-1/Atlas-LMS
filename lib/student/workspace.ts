import { and, asc, desc, eq, inArray, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  announcements,
  assignments,
  contentAlignments,
  courseAiPolicies,
  courses,
  enrollments,
  learningObjectives,
  moduleItems,
  modules,
  submissions,
  type CourseAiPolicy,
} from "@/lib/db/schema";
import type { Role } from "@/lib/auth/session";
import type { WorkspaceCourse } from "@/lib/workspace/scope";
import { inferModuleIdFromDueDate } from "@/lib/course/module-assignment-placement";

/**
 * Student read layer. Three views, all from the published course record:
 * the cross-course overview, one course, one record. No invented metrics:
 * states and grades come from rows, nothing is scored by heuristics.
 */

export type StudentCuePolicy = {
  allowExplain: boolean;
  allowPractice: boolean;
  allowQuestions: boolean;
  personaName: string | null;
};

export function toCuePolicy(policy: CourseAiPolicy | null): StudentCuePolicy {
  return {
    allowExplain: policy?.allowExplain !== false,
    allowPractice: policy?.allowPractice !== false,
    allowQuestions: policy?.allowQuestions !== false,
    personaName: policy?.personaName ?? null,
  };
}

export type StudentAssignment = {
  id: string;
  name: string;
  status: "graded" | "submitted" | "open" | "missing";
  description?: string | null;
  response?: string | null;
  dueAt?: Date | null;
  points?: number | null;
  submittedAt?: Date | null;
  gradedAt?: Date | null;
  score?: number | null;
  grade?: string | null;
  objectiveCodes: string[];
};

export type StudentMaterial = {
  id: string;
  week: string;
  title: string;
  summary?: string | null;
  unlockAt?: Date | null;
  objectiveCodes: string[];
};

export type StudentCourseNotice = {
  id?: string;
  title: string;
  message?: string | null;
  postedAt?: Date | null;
};

export type StudentCourseCard = {
  courseId: string;
  code: string;
  name: string;
  term: string;
  standing: string | null;
  nextDue: { assignmentId: string; name: string; dueAt: Date } | null;
  /** Open assignments whose due date has passed: a fact the overview must surface. */
  overdue: { assignmentId: string; name: string; dueAt: Date } | null;
  overdueCount: number;
  openCount: number;
  waitingCount: number;
  missingCount: number;
  latestNote: string | null;
};

export type StudentOverview = {
  studentName: string;
  cards: StudentCourseCard[];
  /** Overdue work first (oldest due date up), then the closest deadlines. */
  dueSoon: Array<{ assignmentId: string; courseCode: string; name: string; dueAt: Date; overdue: boolean }>;
};

export type StudentCourseWorkspace = {
  course: WorkspaceCourse & { id: string };
  standing: string | null;
  cuePolicy: StudentCuePolicy;
  currentWeek: StudentMaterial | null;
  materials: StudentMaterial[];
  assignments: StudentAssignment[];
  notices: StudentCourseNotice[];
  problem?: { title: string; detail: string };
};

export type StudentRecordWorkspace = {
  course: WorkspaceCourse & { id: string };
  cuePolicy: StudentCuePolicy;
  assignment?: StudentAssignment;
  material?: StudentMaterial;
  relatedMaterials: StudentMaterial[];
  relatedAssignments: StudentAssignment[];
  problem?: { title: string; detail: string };
};

type Actor = {
  id: string;
  orgId: string | null;
  role: Role;
  name?: string | null;
};

function standingLabel(grade: string | null, score: number | null): string | null {
  if (grade) return grade;
  if (typeof score === "number") return `${Math.round(score)}%`;
  return null;
}

function submissionStatus(s?: { gradedAt: Date | null; submittedAt: Date | null; missing: boolean } | null): StudentAssignment["status"] {
  if (s?.missing) return "missing";
  if (s?.gradedAt) return "graded";
  if (s?.submittedAt) return "submitted";
  return "open";
}

/* ── overview: every enrolled course at a glance ─────────────── */

export async function loadStudentOverview(actor?: Actor | null): Promise<StudentOverview> {
  if (!actor?.orgId || actor.role !== "student") {
    return { studentName: actor?.name ?? "Student", cards: [], dueSoon: [] };
  }

  const rows = await db
    .select({
      courseId: enrollments.courseId,
      currentGrade: enrollments.currentGrade,
      currentScore: enrollments.currentScore,
      code: courses.code,
      name: courses.name,
      term: courses.term,
    })
    .from(enrollments)
    .innerJoin(courses, eq(enrollments.courseId, courses.id))
    .where(
      and(
        eq(enrollments.orgId, actor.orgId),
        eq(enrollments.userId, actor.id),
        eq(enrollments.role, "student"),
        eq(enrollments.state, "active")
      )
    )
    .orderBy(asc(courses.code));

  if (rows.length === 0) {
    return { studentName: actor.name ?? "Student", cards: [], dueSoon: [] };
  }

  const courseIds = rows.map((r) => r.courseId);
  const [assignmentRows, submissionRows, noticeRows] = await Promise.all([
    db
      .select({
        id: assignments.id,
        courseId: assignments.courseId,
        name: assignments.name,
        dueAt: assignments.dueAt,
      })
      .from(assignments)
      .where(and(eq(assignments.orgId, actor.orgId), inArray(assignments.courseId, courseIds), eq(assignments.published, true))),
    db
      .select({
        assignmentId: submissions.assignmentId,
        courseId: submissions.courseId,
        submittedAt: submissions.submittedAt,
        gradedAt: submissions.gradedAt,
        missing: submissions.missing,
      })
      .from(submissions)
      .where(and(eq(submissions.orgId, actor.orgId), inArray(submissions.courseId, courseIds), eq(submissions.userId, actor.id))),
    db
      .select({
        courseId: announcements.courseId,
        title: announcements.title,
        postedAt: announcements.postedAt,
      })
      .from(announcements)
      .where(and(eq(announcements.orgId, actor.orgId), inArray(announcements.courseId, courseIds), eq(announcements.published, true), lte(announcements.postedAt, new Date())))
      .orderBy(desc(announcements.postedAt)),
  ]);

  const submissionByAssignment = new Map(submissionRows.map((s) => [s.assignmentId, s]));
  const now = Date.now();

  const cards: StudentCourseCard[] = rows.map((row) => {
    const courseAssignments = assignmentRows.filter((a) => a.courseId === row.courseId);
    let open = 0;
    let waiting = 0;
    let missing = 0;
    let overdueCount = 0;
    let nextDue: StudentCourseCard["nextDue"] = null;
    let overdue: StudentCourseCard["overdue"] = null;
    for (const a of courseAssignments) {
      const status = submissionStatus(submissionByAssignment.get(a.id));
      if (status === "open") {
        open += 1;
        if (a.dueAt && a.dueAt.getTime() >= now && (!nextDue || a.dueAt < nextDue.dueAt)) {
          nextDue = { assignmentId: a.id, name: a.name, dueAt: a.dueAt };
        }
        // An open assignment past its due date is overdue, and the overview says so:
        // it must never read "Nothing due" while this row exists.
        if (a.dueAt && a.dueAt.getTime() < now) {
          overdueCount += 1;
          if (!overdue || a.dueAt < overdue.dueAt) {
            overdue = { assignmentId: a.id, name: a.name, dueAt: a.dueAt };
          }
        }
      } else if (status === "submitted") waiting += 1;
      else if (status === "missing") missing += 1;
    }
    const latestNote = noticeRows.find((n) => n.courseId === row.courseId)?.title ?? null;
    return {
      courseId: row.courseId,
      code: row.code,
      name: row.name,
      term: row.term ?? "",
      standing: standingLabel(row.currentGrade, row.currentScore),
      nextDue,
      overdue,
      overdueCount,
      openCount: open,
      waitingCount: waiting,
      missingCount: missing,
      latestNote,
    };
  });

  const overdueSoon = cards
    .flatMap((card) => (card.overdue ? [{ ...card.overdue, courseCode: card.code, overdue: true }] : []))
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
  const upcomingSoon = cards
    .flatMap((card) => (card.nextDue ? [{ ...card.nextDue, courseCode: card.code, overdue: false }] : []))
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
  const dueSoon = [...overdueSoon, ...upcomingSoon].slice(0, 5);

  return { studentName: actor.name ?? "Student", cards, dueSoon };
}

/* ── calendar: derived from the record, never asserted ───────── */

export type StudentCalendarEntry = {
  date: Date;
  /** "due": an assignment due date. "opens": a module unlock date. */
  kind: "due" | "opens";
  title: string;
  courseCode: string;
  href: string;
  status?: StudentAssignment["status"];
};

export type StudentCalendar = {
  entries: StudentCalendarEntry[];
};

/**
 * Every dated fact in the student's published course record inside a window:
 * assignment due dates and module unlock dates. There is no separate event
 * model; the calendar is a projection of the records it links back to.
 */
export async function loadStudentCalendar(
  actor: Actor | null | undefined,
  window: { from: Date; to: Date }
): Promise<StudentCalendar> {
  if (!actor?.orgId || actor.role !== "student") {
    return { entries: [] };
  }

  const enrollmentRows = await db
    .select({ courseId: enrollments.courseId, code: courses.code })
    .from(enrollments)
    .innerJoin(courses, eq(enrollments.courseId, courses.id))
    .where(
      and(
        eq(enrollments.orgId, actor.orgId),
        eq(enrollments.userId, actor.id),
        eq(enrollments.role, "student"),
        eq(enrollments.state, "active")
      )
    );
  if (enrollmentRows.length === 0) {
    return { entries: [] };
  }

  const courseIds = enrollmentRows.map((row) => row.courseId);
  const codeByCourse = new Map(enrollmentRows.map((row) => [row.courseId, row.code]));

  const [assignmentRows, moduleRows, submissionRows] = await Promise.all([
    db
      .select({ id: assignments.id, courseId: assignments.courseId, name: assignments.name, dueAt: assignments.dueAt })
      .from(assignments)
      .where(and(eq(assignments.orgId, actor.orgId), inArray(assignments.courseId, courseIds), eq(assignments.published, true))),
    db
      .select({ id: modules.id, courseId: modules.courseId, name: modules.name, unlockAt: modules.unlockAt })
      .from(modules)
      .where(and(eq(modules.orgId, actor.orgId), inArray(modules.courseId, courseIds), eq(modules.published, true))),
    db
      .select({
        assignmentId: submissions.assignmentId,
        submittedAt: submissions.submittedAt,
        gradedAt: submissions.gradedAt,
        missing: submissions.missing,
      })
      .from(submissions)
      .where(and(eq(submissions.orgId, actor.orgId), inArray(submissions.courseId, courseIds), eq(submissions.userId, actor.id))),
  ]);

  const submissionByAssignment = new Map(submissionRows.map((s) => [s.assignmentId, s]));
  const inWindow = (date: Date) => date.getTime() >= window.from.getTime() && date.getTime() <= window.to.getTime();

  const entries: StudentCalendarEntry[] = [];
  for (const a of assignmentRows) {
    if (!a.dueAt || !inWindow(a.dueAt)) continue;
    entries.push({
      date: a.dueAt,
      kind: "due",
      title: a.name,
      courseCode: codeByCourse.get(a.courseId) ?? "",
      href: `/student/assignments/${a.id}`,
      status: submissionStatus(submissionByAssignment.get(a.id)),
    });
  }
  for (const m of moduleRows) {
    if (!m.unlockAt || !inWindow(m.unlockAt)) continue;
    entries.push({
      date: m.unlockAt,
      kind: "opens",
      title: m.name,
      courseCode: codeByCourse.get(m.courseId) ?? "",
      href: `/student/material/${m.id}`,
    });
  }

  entries.sort((a, b) => a.date.getTime() - b.date.getTime());
  return { entries };
}

/* ── one course ──────────────────────────────────────────────── */

export async function loadStudentCourseWorkspace(
  actor: Actor | null | undefined,
  courseId: string
): Promise<StudentCourseWorkspace> {
  const problem = (title: string, detail: string): StudentCourseWorkspace => ({
    course: { id: courseId, code: "Course", name: title, term: "", description: detail },
    standing: null,
    cuePolicy: toCuePolicy(null),
    currentWeek: null,
    materials: [],
    assignments: [],
    notices: [],
    problem: { title, detail },
  });

  if (!actor?.orgId || actor.role !== "student") {
    return problem("Course unavailable", "This account cannot study this course.");
  }

  const [enrollment] = await db
    .select({ currentGrade: enrollments.currentGrade, currentScore: enrollments.currentScore })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.orgId, actor.orgId),
        eq(enrollments.courseId, courseId),
        eq(enrollments.userId, actor.id),
        eq(enrollments.role, "student"),
        eq(enrollments.state, "active")
      )
    )
    .limit(1);
  if (!enrollment) {
    return problem("Course unavailable", "You are not enrolled in this course.");
  }

  const [course] = await db
    .select({ id: courses.id, code: courses.code, name: courses.name, term: courses.term, description: courses.description })
    .from(courses)
    .where(and(eq(courses.orgId, actor.orgId), eq(courses.id, courseId)))
    .limit(1);
  if (!course) {
    return problem("Course unavailable", "This course could not be loaded.");
  }

  const [policy] = await db
    .select()
    .from(courseAiPolicies)
    .where(and(eq(courseAiPolicies.orgId, actor.orgId), eq(courseAiPolicies.courseId, courseId)))
    .limit(1);

  const data = await loadCourseRecords({ ...actor, orgId: actor.orgId }, courseId);

  /* The week we are in: the latest published module whose unlock date passed. */
  const currentWeek =
    [...data.materials].reverse().find((m) => {
      const row = data.moduleUnlocks.get(m.id);
      return row ? row.getTime() <= Date.now() : false;
    }) ?? data.materials[data.materials.length - 1] ?? null;

  return {
    course: { ...course, term: course.term ?? "" },
    standing: standingLabel(enrollment.currentGrade, enrollment.currentScore),
    cuePolicy: toCuePolicy(policy ?? null),
    currentWeek,
    materials: data.materials,
    assignments: data.assignments,
    notices: data.notices,
  };
}

/* ── one record (assignment or material) ─────────────────────── */

export async function loadStudentAssignmentWorkspace(
  actor: Actor | null | undefined,
  assignmentId: string
): Promise<StudentRecordWorkspace> {
  const [row] = await db
    .select({ courseId: assignments.courseId })
    .from(assignments)
    .where(and(eq(assignments.id, assignmentId), eq(assignments.published, true)))
    .limit(1);
  const base = await recordBase(actor, row?.courseId);
  if (base.workspace.problem) return base.workspace;

  const assignment = base.allAssignments.find((a) => a.id === assignmentId);
  if (!assignment) {
    return { ...base.workspace, problem: { title: "Assignment unavailable", detail: "This assignment is not part of this course." } };
  }
  const codes = new Set(assignment.objectiveCodes);
  return {
    ...base.workspace,
    assignment,
    relatedMaterials: base.allMaterials.filter((m) => m.objectiveCodes.some((c) => codes.has(c))).slice(0, 3),
  };
}

export async function loadStudentMaterialWorkspace(
  actor: Actor | null | undefined,
  moduleId: string
): Promise<StudentRecordWorkspace> {
  const [row] = await db
    .select({ courseId: modules.courseId })
    .from(modules)
    .where(and(eq(modules.id, moduleId), eq(modules.published, true)))
    .limit(1);
  const base = await recordBase(actor, row?.courseId);
  if (base.workspace.problem) return base.workspace;

  const material = base.allMaterials.find((m) => m.id === moduleId);
  if (!material) {
    return { ...base.workspace, problem: { title: "Material unavailable", detail: "This material is not part of this course." } };
  }
  const assignmentPlacementRows = actor?.orgId
    ? await db
        .select({ moduleId: moduleItems.moduleId, contentId: moduleItems.contentId, type: moduleItems.type })
        .from(moduleItems)
        .where(and(eq(moduleItems.orgId, actor.orgId), eq(moduleItems.courseId, base.workspace.course.id)))
    : [];
  const assignmentPlacements = assignmentPlacementRows.filter((item) => item.type.toLowerCase() === "assignment" && item.contentId);
  const explicitlyPlacedIds = new Set(assignmentPlacements.map((item) => item.contentId));
  const placedHereIds = new Set(
    assignmentPlacements.filter((item) => item.moduleId === moduleId).map((item) => item.contentId)
  );
  const explicitlyPlaced = base.allAssignments.filter((assignment) => placedHereIds.has(assignment.id));
  const datedHere = base.allAssignments.filter(
    (assignment) =>
      !explicitlyPlacedIds.has(assignment.id) &&
      inferModuleIdFromDueDate(
        base.allMaterials.map((module) => ({ id: module.id, opensAt: module.unlockAt ?? null })),
        assignment.dueAt
      ) === moduleId
  );
  return {
    ...base.workspace,
    material,
    relatedAssignments: [...explicitlyPlaced, ...datedHere].slice(0, 4),
  };
}

type RecordBase = {
  workspace: StudentRecordWorkspace;
  allMaterials: StudentMaterial[];
  allAssignments: StudentAssignment[];
};

async function recordBase(actor: Actor | null | undefined, courseId: string | undefined): Promise<RecordBase> {
  const failed = (title: string, detail: string): RecordBase => ({
    workspace: {
      course: { id: courseId ?? "", code: "Course", name: title, term: "", description: detail },
      cuePolicy: toCuePolicy(null),
      relatedMaterials: [],
      relatedAssignments: [],
      problem: { title, detail },
    },
    allMaterials: [],
    allAssignments: [],
  });

  if (!courseId) {
    return failed("Not available", "This is not part of your courses.");
  }
  const courseWorkspace = await loadStudentCourseWorkspace(actor, courseId);
  if (courseWorkspace.problem) {
    return failed(courseWorkspace.problem.title, courseWorkspace.problem.detail);
  }
  return {
    workspace: {
      course: courseWorkspace.course,
      cuePolicy: courseWorkspace.cuePolicy,
      relatedMaterials: [],
      relatedAssignments: [],
    },
    allMaterials: courseWorkspace.materials,
    allAssignments: courseWorkspace.assignments,
  };
}

/* ── shared course-record reads ──────────────────────────────── */

async function loadCourseRecords(actor: Actor & { orgId: string }, courseId: string) {
  const [moduleRows, assignmentRows, noticeRows, objectiveRows] = await Promise.all([
    db
      .select({
        id: modules.id,
        name: modules.name,
        summaryMd: modules.summaryMd,
        position: modules.position,
        unlockAt: modules.unlockAt,
      })
      .from(modules)
      .where(and(eq(modules.orgId, actor.orgId), eq(modules.courseId, courseId), eq(modules.published, true)))
      .orderBy(asc(modules.position)),
    db
      .select({
        id: assignments.id,
        name: assignments.name,
        descriptionMd: assignments.descriptionMd,
        dueAt: assignments.dueAt,
        pointsPossible: assignments.pointsPossible,
      })
      .from(assignments)
      .where(and(eq(assignments.orgId, actor.orgId), eq(assignments.courseId, courseId), eq(assignments.published, true)))
      .orderBy(asc(assignments.dueAt)),
    db
      .select({ id: announcements.id, title: announcements.title, message: announcements.messageMd, postedAt: announcements.postedAt })
      .from(announcements)
      .where(and(eq(announcements.orgId, actor.orgId), eq(announcements.courseId, courseId), eq(announcements.published, true), lte(announcements.postedAt, new Date())))
      .orderBy(desc(announcements.postedAt))
      .limit(5),
    db
      .select({ id: learningObjectives.id, code: learningObjectives.code })
      .from(learningObjectives)
      .where(and(eq(learningObjectives.orgId, actor.orgId), eq(learningObjectives.courseId, courseId))),
  ]);

  const itemIds = [...moduleRows.map((m) => m.id), ...assignmentRows.map((a) => a.id)];
  const alignmentRows = itemIds.length
    ? await db
        .select({ itemId: contentAlignments.itemId, objectiveId: contentAlignments.objectiveId })
        .from(contentAlignments)
        .where(and(eq(contentAlignments.orgId, actor.orgId), inArray(contentAlignments.itemId, itemIds)))
    : [];
  const codeById = new Map(objectiveRows.map((o) => [o.id, o.code]));
  const codesFor = (id: string) =>
    alignmentRows
      .filter((a) => a.itemId === id)
      .map((a) => codeById.get(a.objectiveId))
      .filter((c): c is string => Boolean(c))
      .sort();

  const submissionRows = await db
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
    .where(and(eq(submissions.orgId, actor.orgId), eq(submissions.courseId, courseId), eq(submissions.userId, actor.id)));
  const submissionByAssignment = new Map(submissionRows.map((s) => [s.assignmentId, s]));

  const materials: StudentMaterial[] = moduleRows.map((m) => ({
    id: m.id,
    week: String(m.position ?? ""),
    title: m.name,
    summary: m.summaryMd,
    unlockAt: m.unlockAt,
    objectiveCodes: codesFor(m.id),
  }));
  const moduleUnlocks = new Map(moduleRows.map((m) => [m.id, m.unlockAt ?? new Date(0)]));

  const studentAssignments: StudentAssignment[] = assignmentRows.map((a) => {
    const s = submissionByAssignment.get(a.id);
    return {
      id: a.id,
      name: a.name,
      status: submissionStatus(s),
      description: a.descriptionMd,
      response: s?.body ?? null,
      dueAt: a.dueAt,
      points: a.pointsPossible,
      submittedAt: s?.submittedAt ?? null,
      gradedAt: s?.gradedAt ?? null,
      score: s?.score ?? null,
      grade: s?.grade ?? null,
      objectiveCodes: codesFor(a.id),
    };
  });

  return { materials, moduleUnlocks, assignments: studentAssignments, notices: noticeRows };
}
