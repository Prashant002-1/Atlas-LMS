import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { courses, pages, practiceSets } from "@/lib/db/schema";
import { resolveScope, type WorkspaceCourse } from "@/lib/workspace/scope";
import { parsePracticeQuestions, type PracticeQuestion } from "@/lib/instructor/practice-questions";

/**
 * Read one course record that Atlas can create but the LMS had nowhere to
 * show. Modules, assignments, and announcements each already own a page;
 * pages and practice sets did not, so approving one of those drafts led
 * nowhere and there was no way to read what had been added.
 *
 * Read-only and scoped twice: the course comes from the signed-in teaching
 * scope, and the record must belong to that course, so an id from another
 * course resolves to nothing rather than to someone else's material.
 */

export type CoursePageRecord = {
  kind: "page";
  id: string;
  title: string;
  bodyMd: string | null;
  published: boolean;
  updatedAt: Date | null;
};

export type CoursePracticeSetRecord = {
  kind: "practice_set";
  id: string;
  title: string;
  base: string | null;
  questions: PracticeQuestion[];
  published: boolean;
  updatedAt: Date | null;
};

export type CourseRecord = CoursePageRecord | CoursePracticeSetRecord;

export type CourseRecordView = {
  course: WorkspaceCourse;
  record: CourseRecord | null;
  problem?: { title: string; detail: string };
};

type Actor = { id: string; orgId?: string | null; role: string };

export async function loadCourseRecord(
  actor: Actor | null | undefined,
  recordId: string
): Promise<CourseRecordView> {
  const unavailable = (title: string, detail: string): CourseRecordView => ({
    course: { code: "Course", name: title, term: "" },
    record: null,
    problem: { title, detail },
  });

  if (!actor?.orgId) return unavailable("Sign in", "Sign in to read course records.");

  const scope = await resolveScope({
    orgId: actor.orgId,
    userId: actor.id,
    role: actor.role,
    teachingOnly: true,
  });
  if (!scope.course) return unavailable("No course in view", "No course is in view for this semester.");

  const [course] = await db
    .select({ id: courses.id, code: courses.code, name: courses.name, term: courses.term })
    .from(courses)
    .where(and(eq(courses.orgId, actor.orgId), eq(courses.id, scope.course.id)))
    .limit(1);
  if (!course) return unavailable("Course unavailable", "This course could not be loaded.");

  const courseHeader: WorkspaceCourse = {
    id: course.id,
    code: course.code,
    name: course.name,
    term: course.term ?? scope.term?.name ?? "",
  };

  /* Both reads are pinned to the course in view, not just the record id. */
  const [page] = await db
    .select({
      id: pages.id,
      title: pages.title,
      bodyMd: pages.bodyMd,
      published: pages.published,
      updatedAt: pages.updatedAt,
    })
    .from(pages)
    .where(and(eq(pages.orgId, actor.orgId), eq(pages.courseId, course.id), eq(pages.id, recordId)))
    .limit(1);
  if (page) {
    return { course: courseHeader, record: { kind: "page", ...page } };
  }

  const [set] = await db
    .select({
      id: practiceSets.id,
      title: practiceSets.title,
      base: practiceSets.base,
      questions: practiceSets.questions,
      published: practiceSets.published,
      updatedAt: practiceSets.updatedAt,
    })
    .from(practiceSets)
    .where(
      and(eq(practiceSets.orgId, actor.orgId), eq(practiceSets.courseId, course.id), eq(practiceSets.id, recordId))
    )
    .limit(1);
  if (set) {
    return {
      course: courseHeader,
      record: {
        kind: "practice_set",
        id: set.id,
        title: set.title,
        base: set.base,
        questions: parsePracticeQuestions(set.questions),
        published: set.published,
        updatedAt: set.updatedAt,
      },
    };
  }

  return { course: courseHeader, record: null };
}
