import { tool } from "ai";
import { z } from "zod";
import { and, eq, gte, lt, or, isNull, asc, desc, inArray, sql } from "drizzle-orm";
import { db, toVectorLiteral } from "@/lib/db";
import {
  courses,
  assignments,
  announcements,
  submissions,
  learningObjectives,
  contentAlignments,
  chatMemories,
} from "@/lib/db/schema";
import { embedText } from "@/lib/ai/embeddings";
import { workspaceDecisionInputSchema, type WorkspaceDecision } from "@/lib/workspace/decision-schema";
import { validateWorkspaceDecision } from "@/lib/workspace/validation";
import { ok, enrolledCourseIds, type ChatToolContext, type ToolPayload } from "@/lib/ai/tools/shared";

/**
 * Student tools — READ-ONLY and scoped to the signed-in learner's enrollments.
 * (The prototype read the entire database unscoped; every query here is org + user bounded.)
 */
export function createStudentTools(ctx: ChatToolContext) {
  return {
    setWorkspaceDecision: tool({
      description:
        "Declare the workspace goal, focus, view, panels, actions, reason, and evidence for this turn. Call before data tools. Student views only: todayDesk, weekMap, assignmentFocus, coursePulse, searchResults, studySession, objectiveCoverage.",
      inputSchema: workspaceDecisionInputSchema,
      execute: async (input): Promise<ToolPayload<WorkspaceDecision>> => {
        const v = validateWorkspaceDecision(input, { persona: "student" });
        if (!v.success) throw new Error(v.errors.join(" "));
        return ok("workspace.decision", `Workspace decision: ${input.view} for ${input.goal.replaceAll("_", " ")}.`, input);
      },
    }),

    getDashboardSnapshot: tool({
      description: "Get the student's enrolled courses, upcoming assignments, and recent announcements.",
      inputSchema: z.object({ limit: z.number().int().min(1).max(20).default(6) }),
      execute: async ({ limit }) => {
        const courseIds = await enrolledCourseIds(ctx, "student");
        if (courseIds.length === 0) {
          return ok("dashboard.snapshot", "You are not enrolled in any courses yet.", {
            courses: [],
            upcomingAssignments: [],
            announcements: [],
          });
        }

        const courseRows = await db
          .select({ id: courses.id, name: courses.name, code: courses.code, term: courses.term })
          .from(courses)
          .where(and(eq(courses.orgId, ctx.orgId), inArray(courses.id, courseIds)));

        const upcoming = await db
          .select({
            id: assignments.id,
            name: assignments.name,
            dueAt: assignments.dueAt,
            pointsPossible: assignments.pointsPossible,
            courseId: assignments.courseId,
          })
          .from(assignments)
          .where(
            and(
              eq(assignments.orgId, ctx.orgId),
              inArray(assignments.courseId, courseIds),
              eq(assignments.published, true),
              or(isNull(assignments.dueAt), gte(assignments.dueAt, new Date()))
            )
          )
          .orderBy(asc(assignments.dueAt))
          .limit(limit);

        const recent = await db
          .select({ id: announcements.id, title: announcements.title, postedAt: announcements.postedAt, courseId: announcements.courseId })
          .from(announcements)
          .where(and(eq(announcements.orgId, ctx.orgId), inArray(announcements.courseId, courseIds)))
          .orderBy(desc(announcements.postedAt))
          .limit(limit);

        return ok(
          "dashboard.snapshot",
          `Loaded ${courseRows.length} courses, ${upcoming.length} upcoming assignments, ${recent.length} announcements.`,
          { courses: courseRows, upcomingAssignments: upcoming, announcements: recent }
        );
      },
    }),

    getTodayPlanSnapshot: tool({
      description: "Get the student's due-today and overdue assignments across their enrolled courses.",
      inputSchema: z.object({ assignmentLimit: z.number().int().min(1).max(20).default(10) }),
      execute: async ({ assignmentLimit }) => {
        const courseIds = await enrolledCourseIds(ctx, "student");
        if (courseIds.length === 0) {
          return ok("planner.today", "No enrolled courses.", { dueToday: [], overdue: [], recentAnnouncements: [] });
        }
        const startOfDay = sql`date_trunc('day', now())`;
        const endOfDay = sql`date_trunc('day', now()) + interval '1 day'`;

        const dueToday = await db
          .select({ id: assignments.id, name: assignments.name, dueAt: assignments.dueAt, courseId: assignments.courseId })
          .from(assignments)
          .where(
            and(
              eq(assignments.orgId, ctx.orgId),
              inArray(assignments.courseId, courseIds),
              gte(assignments.dueAt, startOfDay),
              lt(assignments.dueAt, endOfDay)
            )
          )
          .orderBy(asc(assignments.dueAt))
          .limit(assignmentLimit);

        const overdue = await db
          .select({ id: assignments.id, name: assignments.name, dueAt: assignments.dueAt, courseId: assignments.courseId })
          .from(assignments)
          .where(
            and(
              eq(assignments.orgId, ctx.orgId),
              inArray(assignments.courseId, courseIds),
              lt(assignments.dueAt, sql`now()`)
            )
          )
          .orderBy(desc(assignments.dueAt))
          .limit(assignmentLimit);

        return ok("planner.today", `Detected ${dueToday.length} due-today and ${overdue.length} overdue.`, {
          dueToday,
          overdue,
          recentAnnouncements: [],
        });
      },
    }),

    // The differentiator: does the student's progress match what the syllabus assesses?
    getObjectiveCoverage: tool({
      description:
        "For a course the student is enrolled in, compute coverage of each learning objective: how much of the objective's aligned, assessed work the student has completed. This is the 'no surprises' signal.",
      inputSchema: z.object({ courseId: z.string().uuid() }),
      execute: async ({ courseId }) => {
        const courseIds = await enrolledCourseIds(ctx, "student");
        if (!courseIds.includes(courseId)) {
          throw new Error("You are not enrolled in that course.");
        }

        const objectives = await db
          .select()
          .from(learningObjectives)
          .where(and(eq(learningObjectives.orgId, ctx.orgId), eq(learningObjectives.courseId, courseId)));

        const coverage = [];
        for (const obj of objectives) {
          // assignments aligned to this objective
          const aligned = await db
            .select({ itemId: contentAlignments.itemId })
            .from(contentAlignments)
            .where(
              and(
                eq(contentAlignments.orgId, ctx.orgId),
                eq(contentAlignments.objectiveId, obj.id),
                eq(contentAlignments.itemType, "assignment")
              )
            );
          const alignedIds = aligned.map((a) => a.itemId);
          const total = alignedIds.length;

          let completed = 0;
          if (total > 0) {
            const done = await db
              .select({ assignmentId: submissions.assignmentId })
              .from(submissions)
              .where(
                and(
                  eq(submissions.orgId, ctx.orgId),
                  eq(submissions.userId, ctx.userId),
                  inArray(submissions.assignmentId, alignedIds),
                  sql`${submissions.score} is not null`
                )
              );
            completed = done.length;
          }

          coverage.push({
            objectiveId: obj.id,
            code: obj.code,
            description: obj.description,
            assessmentWeight: obj.assessmentWeight ?? null,
            alignedItems: total,
            completedItems: completed,
            coverage: total > 0 ? Math.round((completed / total) * 100) : null,
          });
        }

        const gaps = coverage.filter((c) => c.coverage !== null && c.coverage < 60);
        return ok(
          "objective.coverage",
          `Evaluated ${coverage.length} objectives; ${gaps.length} below 60% coverage.`,
          { courseId, objectives: coverage, gaps }
        );
      },
    }),

    saveMemory: tool({
      description: "Store a durable personal memory (preference, fact) for this student across sessions.",
      inputSchema: z.object({
        memoryKey: z.string().min(2).max(120),
        memoryValue: z.string().min(2).max(500),
      }),
      execute: async ({ memoryKey, memoryValue }) => {
        let vec: number[] | null = null;
        try {
          vec = await embedText(`${memoryKey}: ${memoryValue}`);
        } catch {
          /* best-effort; ILIKE fallback covers recall */
        }
        await db
          .insert(chatMemories)
          .values({
            orgId: ctx.orgId,
            userId: ctx.userId,
            scope: ctx.courseId ? "course" : "global",
            courseId: ctx.courseId ?? null,
            memoryKey,
            memoryValue,
            source: "assistant-tool",
            embedding: vec,
          })
          .onConflictDoUpdate({
            target: [chatMemories.userId, chatMemories.memoryKey],
            set: { memoryValue, updatedAt: new Date(), ...(vec ? { embedding: vec } : {}) },
          });
        return ok("memory.store", `Stored memory "${memoryKey}".`, { memoryKey });
      },
    }),

    searchMemories: tool({
      description: "Recall this student's stored memories by semantic similarity (with keyword fallback).",
      inputSchema: z.object({ queryText: z.string().min(2).max(180), limit: z.number().int().min(1).max(20).default(8) }),
      execute: async ({ queryText, limit }) => {
        try {
          const lit = toVectorLiteral(await embedText(queryText));
          const rows = await db
            .select({ memoryKey: chatMemories.memoryKey, memoryValue: chatMemories.memoryValue, source: chatMemories.source })
            .from(chatMemories)
            .where(and(eq(chatMemories.orgId, ctx.orgId), eq(chatMemories.userId, ctx.userId)))
            .orderBy(sql`case when ${chatMemories.embedding} is not null then ${chatMemories.embedding} <=> ${lit}::vector else 2.0 end asc`)
            .limit(limit);
          return ok("memory.search-results", `Found ${rows.length} matching memories.`, { matches: rows });
        } catch {
          const rows = await db
            .select({ memoryKey: chatMemories.memoryKey, memoryValue: chatMemories.memoryValue, source: chatMemories.source })
            .from(chatMemories)
            .where(
              and(
                eq(chatMemories.orgId, ctx.orgId),
                eq(chatMemories.userId, ctx.userId),
                or(sql`${chatMemories.memoryKey} ilike ${"%" + queryText + "%"}`, sql`${chatMemories.memoryValue} ilike ${"%" + queryText + "%"}`)
              )
            )
            .limit(limit);
          return ok("memory.search-results", `Found ${rows.length} matching memories.`, { matches: rows });
        }
      },
    }),
  };
}

export type StudentToolSet = ReturnType<typeof createStudentTools>;
