import { cookies } from "next/headers";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { courses, enrollments, terms } from "@/lib/db/schema";

/**
 * Workspace scope, which semester and course the signed-in user is looking at.
 *
 * The term comes from a cookie (any account can move between semesters, real
 * rollover behavior, and exactly what testing needs). The course comes from the
 * route or the user's enrollments within that term. No hidden defaults beyond
 * "the current term, your first course in it."
 */

const TERM_COOKIE = "atlas-term";
const COURSE_COOKIE = "atlas-course";

export type TermOption = {
  id: string;
  slug: string;
  name: string;
  current: boolean;
};

export type CourseOption = {
  id: string;
  code: string;
  name: string;
  term: string | null;
  role: "instructor" | "ta" | "student";
};

export async function listTerms(orgId: string): Promise<TermOption[]> {
  const rows = await db
    .select({ id: terms.id, slug: terms.slug, name: terms.name, current: terms.current, startsAt: terms.startsAt })
    .from(terms)
    .where(eq(terms.orgId, orgId))
    .orderBy(desc(terms.startsAt));
  return rows.map(({ id, slug, name, current }) => ({ id, slug, name, current }));
}

export async function activeTerm(orgId: string): Promise<TermOption | null> {
  const all = await listTerms(orgId);
  if (all.length === 0) return null;
  const store = await cookies();
  const pinned = store.get(TERM_COOKIE)?.value;
  return all.find((t) => t.slug === pinned) ?? all.find((t) => t.current) ?? all[0];
}

/** Courses the user belongs to in a term, with their role in each. */
export async function listCourses(args: {
  orgId: string;
  userId: string;
  role: string;
  termId: string | null;
}): Promise<CourseOption[]> {
  const isAdmin = args.role === "admin" || args.role === "superadmin";

  if (isAdmin) {
    const rows = await db
      .select({ id: courses.id, code: courses.code, name: courses.name, term: courses.term })
      .from(courses)
      .where(
        args.termId
          ? and(eq(courses.orgId, args.orgId), eq(courses.termId, args.termId))
          : eq(courses.orgId, args.orgId)
      )
      .orderBy(asc(courses.code));
    return rows.map((c) => ({ ...c, role: "instructor" as const }));
  }

  const rows = await db
    .select({
      id: courses.id,
      code: courses.code,
      name: courses.name,
      term: courses.term,
      role: enrollments.role,
    })
    .from(enrollments)
    .innerJoin(courses, eq(enrollments.courseId, courses.id))
    .where(
      args.termId
        ? and(eq(enrollments.orgId, args.orgId), eq(enrollments.userId, args.userId), eq(courses.termId, args.termId))
        : and(eq(enrollments.orgId, args.orgId), eq(enrollments.userId, args.userId))
    )
    .orderBy(asc(courses.code));
  return rows;
}

export type WorkspaceScope = {
  term: TermOption | null;
  terms: TermOption[];
  course: CourseOption | null;
  courses: CourseOption[];
  /**
   * Every course the user can open, across all terms, each carrying its own
   * term name. The switcher needs this because a term is a category there
   * rather than a second choice: you pick a course and its term follows.
   * `courses` stays scoped to the term in view, which is what page reads want.
   */
  allCourses: CourseOption[];
};

/**
 * Resolve the full scope for a page: the term in view, the user's courses in
 * it, and the active course (explicit id → cookie → first).
 */
export async function resolveScope(args: {
  orgId: string;
  userId: string;
  role: string;
  courseId?: string | null;
  teachingOnly?: boolean;
}): Promise<WorkspaceScope> {
  const [termList, term] = await Promise.all([listTerms(args.orgId), activeTerm(args.orgId)]);
  const [scopedList, everyCourse] = await Promise.all([
    listCourses({ orgId: args.orgId, userId: args.userId, role: args.role, termId: term?.id ?? null }),
    listCourses({ orgId: args.orgId, userId: args.userId, role: args.role, termId: null }),
  ]);

  const byRole = (list: CourseOption[]) => {
    if (args.teachingOnly) return list.filter((c) => c.role === "instructor" || c.role === "ta");
    if (args.teachingOnly === false) return list.filter((c) => c.role === "student");
    return list;
  };
  const courseList = byRole(scopedList);
  const allCourses = byRole(everyCourse);

  const store = await cookies();
  const pinned = args.courseId ?? store.get(COURSE_COOKIE)?.value;
  const course = courseList.find((c) => c.id === pinned) ?? courseList[0] ?? null;

  return { term, terms: termList, course, courses: courseList, allCourses };
}

export const SCOPE_COOKIES = { term: TERM_COOKIE, course: COURSE_COOKIE } as const;

/** The course header every workspace page renders. */
export type WorkspaceCourse = {
  id?: string;
  code: string;
  name: string;
  term: string;
  description?: string | null;
};
