import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { assignments, courses, enrollments, moduleItems, modules, sessionAssignments, users } from "@/lib/db/schema";
import {
  loadActiveCourseAgentConfig,
  type ResolvedCourseAgentConfig,
} from "@/lib/agent/course-agent-config";
import {
  DEFAULT_GRADE_BANDS,
  gradeBandsForCourse,
  parseClassPolicies,
  type ClassPolicy,
  type GradeBand,
} from "@/lib/course/policies";
import { inferModuleIdFromDueDate } from "@/lib/course/module-assignment-placement";

/**
 * The syllabus is a composed view of the course record. Every section below
 * the professor's own text is derived from live rows at render time, so the
 * schedule, the work, and the policies cannot drift from the course itself.
 */

export type SyllabusInstructor = {
  id: string;
  name: string;
  email: string;
  title: string | null;
  officeLocation: string | null;
  officeHours: string | null;
};

export type SyllabusAssignment = {
  id: string;
  name: string;
  dueAt: Date | null;
  pointsPossible: number | null;
  published: boolean;
  /** Present when the assignment runs as an AI assignment. */
  session: { durationMinutes: number } | null;
};

export type SyllabusWeek = {
  id: string;
  name: string;
  summaryMd: string | null;
  opensAt: Date | null;
  published: boolean;
  due: SyllabusAssignment[];
};

export type CourseSyllabus = {
  course: {
    id: string;
    code: string;
    name: string;
    term: string | null;
    description: string | null;
    syllabusMd: string | null;
    startDate: Date | null;
    endDate: Date | null;
    timeZone: string | null;
    updatedAt: Date;
  };
  instructors: SyllabusInstructor[];
  weeks: SyllabusWeek[];
  work: SyllabusAssignment[];
  publishedPoints: number;
  gradeBands: GradeBand[];
  classPolicies: ClassPolicy[];
  agent: ResolvedCourseAgentConfig;
};

export type { GradeBand } from "@/lib/course/policies";

/**
 * The default letter bands the gradebook writes with (lib/agent/grading.ts,
 * gradeLetterFor). A unit test holds the two in agreement. A course may carry
 * its own validated scale; loadCourseSyllabus resolves it per course.
 */
export const GRADE_BANDS: GradeBand[] = DEFAULT_GRADE_BANDS;

/**
 * Place each dated assignment in the module week whose open window contains
 * its due date: the latest week that opens on or before the due date, or the
 * first dated week when work comes due before anything opens. Assignments
 * without a due date, and courses whose modules carry no open dates, map to
 * no week; they still appear in the assignments table.
 */
export function assignDueWeeks<Week extends { id: string; opensAt: Date | null }>(
  weeks: Week[],
  work: SyllabusAssignment[]
): Map<string, SyllabusAssignment[]> {
  const byWeek = new Map<string, SyllabusAssignment[]>();

  for (const item of work) {
    const moduleId = inferModuleIdFromDueDate(weeks, item.dueAt);
    if (!moduleId) continue;
    const list = byWeek.get(moduleId) ?? [];
    list.push(item);
    byWeek.set(moduleId, list);
  }

  for (const list of byWeek.values()) {
    list.sort((a, b) => (a.dueAt?.getTime() ?? 0) - (b.dueAt?.getTime() ?? 0));
  }
  return byWeek;
}

export async function loadCourseSyllabus(orgId: string, courseId: string): Promise<CourseSyllabus | null> {
  const [course] = await db
    .select({
      id: courses.id,
      code: courses.code,
      name: courses.name,
      term: courses.term,
      description: courses.description,
      syllabusMd: courses.syllabusMd,
      startDate: courses.startDate,
      endDate: courses.endDate,
      timeZone: courses.timeZone,
      updatedAt: courses.updatedAt,
      gradeScale: courses.gradeScale,
      classPolicies: courses.classPolicies,
    })
    .from(courses)
    .where(and(eq(courses.orgId, orgId), eq(courses.id, courseId)))
    .limit(1);
  if (!course) return null;

  const [instructorRows, moduleRows, workRows, assignmentPlacementRows, agent] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        title: users.title,
        officeLocation: users.officeLocation,
        officeHours: users.officeHours,
      })
      .from(enrollments)
      .innerJoin(users, eq(users.id, enrollments.userId))
      .where(
        and(
          eq(enrollments.orgId, orgId),
          eq(enrollments.courseId, course.id),
          eq(enrollments.role, "instructor"),
          eq(enrollments.state, "active")
        )
      )
      .orderBy(asc(users.name))
      .limit(4),
    db
      .select({
        id: modules.id,
        name: modules.name,
        summaryMd: modules.summaryMd,
        opensAt: modules.unlockAt,
        published: modules.published,
      })
      .from(modules)
      .where(and(eq(modules.orgId, orgId), eq(modules.courseId, course.id)))
      .orderBy(asc(modules.position), asc(modules.unlockAt), asc(modules.createdAt)),
    db
      .select({
        id: assignments.id,
        name: assignments.name,
        dueAt: assignments.dueAt,
        pointsPossible: assignments.pointsPossible,
        published: assignments.published,
        sessionDuration: sessionAssignments.durationMinutes,
      })
      .from(assignments)
      .leftJoin(
        sessionAssignments,
        and(
          eq(sessionAssignments.assignmentId, assignments.id),
          eq(sessionAssignments.orgId, orgId),
          eq(sessionAssignments.courseId, course.id)
        )
      )
      .where(and(eq(assignments.orgId, orgId), eq(assignments.courseId, course.id)))
      .orderBy(asc(assignments.dueAt), asc(assignments.position), asc(assignments.createdAt)),
    db
      .select({ moduleId: moduleItems.moduleId, contentId: moduleItems.contentId, type: moduleItems.type })
      .from(moduleItems)
      .where(and(eq(moduleItems.orgId, orgId), eq(moduleItems.courseId, course.id))),
    loadActiveCourseAgentConfig(orgId, course.id),
  ]);

  const work: SyllabusAssignment[] = workRows.map((row) => ({
    id: row.id,
    name: row.name,
    dueAt: row.dueAt,
    pointsPossible: row.pointsPossible,
    published: row.published,
    session: row.sessionDuration === null ? null : { durationMinutes: row.sessionDuration },
  }));

  const assignmentPlacements = assignmentPlacementRows.filter(
    (item) => item.type.toLowerCase() === "assignment" && item.contentId
  );
  const explicitlyPlacedIds = new Set(assignmentPlacements.map((item) => item.contentId));
  const workById = new Map(work.map((item) => [item.id, item]));
  const dueByWeek = assignDueWeeks(
    moduleRows,
    work.filter((item) => !explicitlyPlacedIds.has(item.id))
  );
  for (const placement of assignmentPlacements) {
    const item = placement.contentId ? workById.get(placement.contentId) : null;
    if (!item) continue;
    const placed = dueByWeek.get(placement.moduleId) ?? [];
    if (!placed.some((existing) => existing.id === item.id)) placed.push(item);
    placed.sort((a, b) => (a.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER));
    dueByWeek.set(placement.moduleId, placed);
  }
  const weeks: SyllabusWeek[] = moduleRows.map((row) => ({
    id: row.id,
    name: row.name,
    summaryMd: row.summaryMd,
    opensAt: row.opensAt,
    published: row.published,
    due: dueByWeek.get(row.id) ?? [],
  }));

  const publishedPoints = work.reduce(
    (sum, item) => sum + (item.published && typeof item.pointsPossible === "number" ? item.pointsPossible : 0),
    0
  );

  const { gradeScale, classPolicies: storedPolicies, ...courseFacts } = course;

  return {
    course: courseFacts,
    gradeBands: gradeBandsForCourse(gradeScale),
    classPolicies: parseClassPolicies(storedPolicies),
    instructors: instructorRows.map((row) => ({
      id: row.id,
      name: row.name?.trim() || row.email,
      email: row.email,
      title: row.title,
      officeLocation: row.officeLocation,
      officeHours: row.officeHours,
    })),
    weeks,
    work,
    publishedPoints,
    agent,
  };
}
