import { tool } from "ai";
import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  announcements,
  assignments,
  courses,
  enrollments,
  files,
  pages,
  sessionAssignments,
  submissions,
} from "@/lib/db/schema";
import { courseMaterialRecords } from "@/lib/db/course-agent-schema";
import { gradeBandsForCourse, parseClassPolicies } from "@/lib/course/policies";
import { personalMemoryTool } from "@/lib/agent/memories";
import { upcomingCalendarFacts, type StudentAtlasScope } from "@/lib/agent/student-atlas";

/**
 * The student profile's closed tool set (ADR-0016): three reads over the
 * student's own record and their enrolled courses' published material, plus
 * the shared remember tool. Every executor repeats organization and
 * enrollment predicates; errors are structured, never thrown.
 */

type ToolError = { ok: false; error: string };

function toolError(error: string): ToolError {
  return { ok: false, error };
}

async function enrolledCourses(scope: StudentAtlasScope): Promise<Array<{ id: string; code: string; name: string }>> {
  return db
    .select({ id: courses.id, code: courses.code, name: courses.name })
    .from(enrollments)
    .innerJoin(courses, and(eq(courses.id, enrollments.courseId), eq(courses.orgId, scope.orgId)))
    .where(
      and(
        eq(enrollments.orgId, scope.orgId),
        eq(enrollments.userId, scope.studentId),
        eq(enrollments.role, "student"),
        eq(enrollments.state, "active")
      )
    )
    .orderBy(asc(courses.code))
    .limit(12);
}

async function requireEnrolledCourse(scope: StudentAtlasScope, courseId: string) {
  const list = await enrolledCourses(scope);
  return list.find((course) => course.id === courseId) ?? null;
}

function shortDate(date: Date | null): string {
  return date ? date.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "no date";
}

function clip(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max)}\n[clipped]`;
}

const inspectRecordSchema = z.object({
  resource: z.enum([
    "overview",
    "assignments",
    "grades",
    "calendar",
    "announcements",
    "syllabus",
    "materials",
  ]),
  courseId: z
    .string()
    .uuid()
    .optional()
    .describe("Limit to one enrolled course. Required for syllabus and materials."),
});

function inspectRecordTool(scope: StudentAtlasScope) {
  return tool({
    description:
      "Read this student's own record: overview (courses and standing), assignments (due and turned in), grades (returned results with topic breakdowns), calendar (the next two weeks), announcements, syllabus (one course), or materials (one course's available material).",
    inputSchema: inspectRecordSchema,
    execute: async (input) => {
      try {
        const enrolled = await enrolledCourses(scope);
        if (enrolled.length === 0) return toolError("No active enrollments.");
        const courseIds = enrolled.map((course) => course.id);
        const codeById = new Map(enrolled.map((course) => [course.id, course.code]));

        if (input.courseId && !codeById.has(input.courseId)) {
          return toolError("That course is not one of this student's enrollments.");
        }
        const scopedIds = input.courseId ? [input.courseId] : courseIds;

        if (input.resource === "overview") {
          const rows = await db
            .select({
              courseId: enrollments.courseId,
              currentScore: enrollments.currentScore,
              currentGrade: enrollments.currentGrade,
            })
            .from(enrollments)
            .where(
              and(
                eq(enrollments.orgId, scope.orgId),
                eq(enrollments.userId, scope.studentId),
                eq(enrollments.role, "student"),
                eq(enrollments.state, "active")
              )
            );
          const byCourse = new Map(rows.map((row) => [row.courseId, row]));
          return {
            ok: true as const,
            courses: enrolled.map((course) => {
              const standing = byCourse.get(course.id);
              return {
                courseId: course.id,
                code: course.code,
                name: course.name,
                standing:
                  typeof standing?.currentScore === "number"
                    ? `${standing.currentScore}%${standing.currentGrade ? ` (${standing.currentGrade})` : ""}`
                    : "no grades yet",
              };
            }),
          };
        }

        if (input.resource === "assignments") {
          const rows = await db
            .select({
              id: assignments.id,
              courseId: assignments.courseId,
              name: assignments.name,
              dueAt: assignments.dueAt,
              pointsPossible: assignments.pointsPossible,
              submittedAt: submissions.submittedAt,
              score: submissions.score,
              aiAssignment: sessionAssignments.id,
            })
            .from(assignments)
            .leftJoin(
              submissions,
              and(
                eq(submissions.assignmentId, assignments.id),
                eq(submissions.userId, scope.studentId),
                eq(submissions.orgId, scope.orgId)
              )
            )
            .leftJoin(
              sessionAssignments,
              and(eq(sessionAssignments.assignmentId, assignments.id), eq(sessionAssignments.orgId, scope.orgId))
            )
            .where(
              and(
                eq(assignments.orgId, scope.orgId),
                inArray(assignments.courseId, scopedIds),
                eq(assignments.published, true)
              )
            )
            .orderBy(asc(assignments.dueAt))
            .limit(40);
          const now = Date.now();
          return {
            ok: true as const,
            assignments: rows.map((row) => ({
              id: row.id,
              course: codeById.get(row.courseId) ?? "",
              name: row.name,
              dueAt: shortDate(row.dueAt),
              points: row.pointsPossible,
              state: row.submittedAt
                ? "turned in"
                : row.dueAt && row.dueAt.getTime() < now
                  ? "overdue"
                  : "open",
              aiAssignment: Boolean(row.aiAssignment),
            })),
          };
        }

        if (input.resource === "grades") {
          const rows = await db
            .select({
              assignmentName: assignments.name,
              courseId: submissions.courseId,
              score: submissions.score,
              grade: submissions.grade,
              gradedAt: submissions.gradedAt,
              pointsPossible: assignments.pointsPossible,
              topicScores: submissions.topicScores,
            })
            .from(submissions)
            .innerJoin(assignments, eq(assignments.id, submissions.assignmentId))
            .where(
              and(
                eq(submissions.orgId, scope.orgId),
                eq(submissions.userId, scope.studentId),
                inArray(submissions.courseId, scopedIds),
                sql`${submissions.gradedAt} IS NOT NULL`
              )
            )
            .orderBy(desc(submissions.gradedAt))
            .limit(15);
          return {
            ok: true as const,
            grades: rows.map((row) => ({
              course: codeById.get(row.courseId) ?? "",
              assignment: row.assignmentName,
              score: row.score,
              outOf: row.pointsPossible,
              letter: row.grade,
              byTopic:
                row.topicScores && typeof row.topicScores === "object"
                  ? Object.fromEntries(
                      Object.entries(row.topicScores as Record<string, unknown>).map(([topic, value]) => [
                        topic.replaceAll("_", " "),
                        value,
                      ])
                    )
                  : null,
            })),
          };
        }

        if (input.resource === "calendar") {
          const facts = await upcomingCalendarFacts(scope, scopedIds, 14);
          return {
            ok: true as const,
            due: facts.due.map((row) => ({
              course: codeById.get(row.courseId) ?? "",
              name: row.name,
              dueAt: shortDate(row.dueAt),
            })),
            opening: facts.opening.map((row) => ({
              course: codeById.get(row.courseId ?? "") ?? "",
              module: row.name,
              opensAt: shortDate(row.unlockAt),
            })),
          };
        }

        if (input.resource === "announcements") {
          const rows = await db
            .select({ title: announcements.title, messageMd: announcements.messageMd, courseId: announcements.courseId, postedAt: announcements.postedAt })
            .from(announcements)
            .where(
              and(
                eq(announcements.orgId, scope.orgId),
                inArray(announcements.courseId, scopedIds),
                eq(announcements.published, true)
              )
            )
            .orderBy(desc(announcements.postedAt))
            .limit(10);
          return {
            ok: true as const,
            announcements: rows.map((row) => ({
              course: codeById.get(row.courseId) ?? "",
              title: row.title,
              postedAt: shortDate(row.postedAt),
              message: row.messageMd ? clip(row.messageMd, 600) : null,
            })),
          };
        }

        if (input.resource === "syllabus") {
          if (!input.courseId) return toolError("The syllabus read needs a courseId.");
          const [course] = await db
            .select({
              code: courses.code,
              name: courses.name,
              syllabusMd: courses.syllabusMd,
              gradeScale: courses.gradeScale,
              classPolicies: courses.classPolicies,
            })
            .from(courses)
            .where(and(eq(courses.id, input.courseId), eq(courses.orgId, scope.orgId)))
            .limit(1);
          if (!course) return toolError("Course not found.");
          return {
            ok: true as const,
            course: `${course.code} ${course.name}`,
            syllabus: course.syllabusMd ? clip(course.syllabusMd, 5000) : "No syllabus text.",
            gradeScale: gradeBandsForCourse(course.gradeScale).map((band) => `${band.letter} at ${band.min}`),
            classPolicies: parseClassPolicies(course.classPolicies),
          };
        }

        // materials
        if (!input.courseId) return toolError("The materials read needs a courseId.");
        const rows = await db
          .select({
            id: files.id,
            displayName: files.displayName,
            contentType: files.contentType,
            materialKind: courseMaterialRecords.materialKind,
            processingStatus: courseMaterialRecords.processingStatus,
            visibility: courseMaterialRecords.visibility,
          })
          .from(files)
          .leftJoin(
            courseMaterialRecords,
            and(
              eq(courseMaterialRecords.fileId, files.id),
              eq(courseMaterialRecords.orgId, scope.orgId),
              eq(courseMaterialRecords.courseId, input.courseId)
            )
          )
          .where(and(eq(files.orgId, scope.orgId), eq(files.courseId, input.courseId)))
          .orderBy(asc(files.displayName))
          .limit(40);
        const visible = rows.filter(
          (row) => (row.processingStatus ?? "ready") === "ready" && (row.visibility ?? "course") === "course"
        );
        return {
          ok: true as const,
          materials: visible.map((row) => ({
            id: row.id,
            name: row.displayName,
            kind: row.materialKind ?? "document",
          })),
        };
      } catch (error) {
        console.error("student inspect_record failed", error);
        return toolError("That read did not complete.");
      }
    },
  });
}

const searchCourseSchema = z.object({
  courseId: z.string().uuid(),
  query: z.string().trim().min(2).max(120),
});

function searchCourseTool(scope: StudentAtlasScope) {
  return tool({
    description:
      "Search one enrolled course's published pages and available materials by keyword. Returns titles with short snippets; follow up with read_page for a page's full text.",
    inputSchema: searchCourseSchema,
    execute: async (input) => {
      try {
        const course = await requireEnrolledCourse(scope, input.courseId);
        if (!course) return toolError("That course is not one of this student's enrollments.");
        const pattern = `%${input.query.replaceAll("%", "").replaceAll("_", "")}%`;

        const [pageRows, fileRows] = await Promise.all([
          db
            .select({ id: pages.id, title: pages.title, bodyMd: pages.bodyMd })
            .from(pages)
            .where(
              and(
                eq(pages.orgId, scope.orgId),
                eq(pages.courseId, input.courseId),
                eq(pages.published, true),
                or(ilike(pages.title, pattern), ilike(pages.bodyMd, pattern))
              )
            )
            .orderBy(asc(pages.title))
            .limit(8),
          db
            .select({
              id: files.id,
              displayName: files.displayName,
              processingStatus: courseMaterialRecords.processingStatus,
              visibility: courseMaterialRecords.visibility,
            })
            .from(files)
            .leftJoin(
              courseMaterialRecords,
              and(
                eq(courseMaterialRecords.fileId, files.id),
                eq(courseMaterialRecords.orgId, scope.orgId),
                eq(courseMaterialRecords.courseId, input.courseId)
              )
            )
            .where(
              and(
                eq(files.orgId, scope.orgId),
                eq(files.courseId, input.courseId),
                ilike(files.displayName, pattern)
              )
            )
            .orderBy(asc(files.displayName))
            .limit(8),
        ]);

        const needle = input.query.toLowerCase();
        return {
          ok: true as const,
          pages: pageRows.map((row) => {
            const body = row.bodyMd ?? "";
            const at = body.toLowerCase().indexOf(needle);
            const snippet = at >= 0 ? body.slice(Math.max(0, at - 60), at + 180).replace(/\s+/g, " ").trim() : "";
            return { id: row.id, title: row.title, snippet };
          }),
          materials: fileRows
            .filter((row) => (row.processingStatus ?? "ready") === "ready" && (row.visibility ?? "course") === "course")
            .map((row) => ({ id: row.id, name: row.displayName })),
        };
      } catch (error) {
        console.error("student search_course failed", error);
        return toolError("That search did not complete.");
      }
    },
  });
}

const readPageSchema = z.object({
  courseId: z.string().uuid(),
  pageId: z.string().uuid(),
});

function readPageTool(scope: StudentAtlasScope) {
  return tool({
    description: "Read one published page from an enrolled course, for explaining or citing the material.",
    inputSchema: readPageSchema,
    execute: async (input) => {
      try {
        const course = await requireEnrolledCourse(scope, input.courseId);
        if (!course) return toolError("That course is not one of this student's enrollments.");
        const [page] = await db
          .select({ title: pages.title, bodyMd: pages.bodyMd })
          .from(pages)
          .where(
            and(
              eq(pages.orgId, scope.orgId),
              eq(pages.courseId, input.courseId),
              eq(pages.id, input.pageId),
              eq(pages.published, true)
            )
          )
          .limit(1);
        if (!page) return toolError("That page is not published in this course.");
        return { ok: true as const, title: page.title, body: clip(page.bodyMd ?? "", 6000) };
      } catch (error) {
        console.error("student read_page failed", error);
        return toolError("That read did not complete.");
      }
    },
  });
}

export function studentAtlasTools(args: { scope: StudentAtlasScope; sessionId: string }) {
  return {
    inspect_record: inspectRecordTool(args.scope),
    search_course: searchCourseTool(args.scope),
    read_page: readPageTool(args.scope),
    remember: personalMemoryTool({
      scope: { orgId: args.scope.orgId, userId: args.scope.studentId, profile: "student" },
      sessionId: args.sessionId,
    }),
  };
}
