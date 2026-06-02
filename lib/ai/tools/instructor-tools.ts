import { tool } from "ai";
import { z } from "zod";
import { and, eq, inArray, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { changeProposals, learningObjectives, contentAlignments, enrollments, submissions } from "@/lib/db/schema";
import { workspaceDecisionInputSchema, type WorkspaceDecision } from "@/lib/workspace/decision-schema";
import { validateWorkspaceDecision } from "@/lib/workspace/validation";
import { ok, assertCanEditCourse, type ChatToolContext, type ToolPayload } from "@/lib/ai/tools/shared";

const objectiveDraft = z.object({
  code: z.string().min(1).max(16),
  description: z.string().min(4).max(400),
  bloomLevel: z.enum(["remember", "understand", "apply", "analyze", "evaluate", "create"]).optional(),
  assessmentWeight: z.number().min(0).max(1).optional(),
});

async function createProposal(
  ctx: ChatToolContext,
  args: { kind: "course" | "syllabus" | "module" | "assignment" | "quiz" | "rubric" | "objective" | "alignment" | "import"; courseId: string | null; summary: string; diff: unknown }
) {
  if (args.courseId) await assertCanEditCourse(ctx, args.courseId);
  const [row] = await db
    .insert(changeProposals)
    .values({
      orgId: ctx.orgId,
      courseId: args.courseId,
      authorId: ctx.userId,
      kind: args.kind,
      status: "pending",
      summary: args.summary,
      diff: args.diff as object,
    })
    .returning({ id: changeProposals.id });
  return row.id;
}

/**
 * Instructor tools — the agent acts as instructional designer. Every write produces a
 * pending `change_proposal` (a structured diff) for the professor to review/approve.
 * Nothing mutates the live course until approval (applied in a server action, Phase 3).
 */
export function createInstructorTools(ctx: ChatToolContext) {
  return {
    setWorkspaceDecision: tool({
      description:
        "Declare the authoring goal, focus, view, panels, actions, reason, evidence for this turn. Call before other tools. Instructor views only: courseBuilder, syllabusComposer, assessmentBuilder, gradingDesk, classInsights, objectiveMap.",
      inputSchema: workspaceDecisionInputSchema,
      execute: async (input): Promise<ToolPayload<WorkspaceDecision>> => {
        const v = validateWorkspaceDecision(input, { persona: "instructor" });
        if (!v.success) throw new Error(v.errors.join(" "));
        return ok("workspace.decision", `Authoring decision: ${input.view} for ${input.goal.replaceAll("_", " ")}.`, input);
      },
    }),

    draftCourseOutline: tool({
      description:
        "Propose a full course outline (modules + learning objectives) from the instructor's intent. Produces a reviewable proposal; does not create the course until approved.",
      inputSchema: z.object({
        title: z.string().min(3).max(160),
        code: z.string().min(2).max(32),
        term: z.string().max(60).optional(),
        summary: z.string().min(10).max(800),
        objectives: z.array(objectiveDraft).min(1).max(12),
        modules: z
          .array(
            z.object({
              name: z.string().min(2).max(160),
              summaryMd: z.string().max(1200).optional(),
              position: z.number().int().min(1),
              objectiveCodes: z.array(z.string()).max(12).optional(),
            })
          )
          .min(1)
          .max(20),
      }),
      execute: async (input) => {
        const id = await createProposal(ctx, {
          kind: "course",
          courseId: null,
          summary: `New course "${input.title}" (${input.code}) — ${input.modules.length} modules, ${input.objectives.length} objectives.`,
          diff: input,
        });
        return ok("authoring.course-outline", `Drafted course outline as proposal ${id}. Review to create the course.`, {
          proposalId: id,
          outline: input,
        });
      },
    }),

    generateSyllabus: tool({
      description: "Propose a syllabus (markdown) for an existing course, optionally with refined objectives. Reviewable proposal.",
      inputSchema: z.object({
        courseId: z.string().uuid(),
        syllabusMd: z.string().min(50).max(20000),
        objectives: z.array(objectiveDraft).max(12).optional(),
      }),
      execute: async ({ courseId, syllabusMd, objectives }) => {
        const id = await createProposal(ctx, {
          kind: "syllabus",
          courseId,
          summary: `Syllabus draft (${syllabusMd.length} chars)${objectives ? ` + ${objectives.length} objectives` : ""}.`,
          diff: { syllabusMd, objectives: objectives ?? [] },
        });
        return ok("authoring.syllabus", `Drafted syllabus as proposal ${id}.`, { proposalId: id, syllabusMd, objectives: objectives ?? [] });
      },
    }),

    proposeAssignment: tool({
      description: "Propose a new assignment aligned to one or more objective codes. Reviewable proposal.",
      inputSchema: z.object({
        courseId: z.string().uuid(),
        name: z.string().min(2).max(200),
        descriptionMd: z.string().min(10).max(8000),
        pointsPossible: z.number().min(0).max(1000).optional(),
        dueAt: z.string().datetime().optional(),
        objectiveCodes: z.array(z.string()).max(12).optional(),
      }),
      execute: async (input) => {
        const id = await createProposal(ctx, {
          kind: "assignment",
          courseId: input.courseId,
          summary: `Assignment "${input.name}"${input.objectiveCodes?.length ? ` aligned to ${input.objectiveCodes.join(", ")}` : ""}.`,
          diff: input,
        });
        return ok("authoring.assessment", `Drafted assignment as proposal ${id}.`, { proposalId: id, assignment: input });
      },
    }),

    generateRubric: tool({
      description: "Propose a grading rubric for an assignment. Reviewable proposal.",
      inputSchema: z.object({
        courseId: z.string().uuid(),
        assignmentId: z.string().uuid(),
        criteria: z
          .array(
            z.object({
              name: z.string().min(2).max(120),
              levels: z
                .array(z.object({ label: z.string().min(1).max(40), points: z.number().min(0), descriptor: z.string().max(400) }))
                .min(2)
                .max(6),
            })
          )
          .min(1)
          .max(12),
      }),
      execute: async (input) => {
        const id = await createProposal(ctx, {
          kind: "rubric",
          courseId: input.courseId,
          summary: `Rubric for assignment ${input.assignmentId} — ${input.criteria.length} criteria.`,
          diff: input,
        });
        return ok("authoring.assessment", `Drafted rubric as proposal ${id}.`, { proposalId: id, rubric: input });
      },
    }),

    alignContentToObjectives: tool({
      description: "Propose alignments between existing content items and learning objectives. Reviewable proposal.",
      inputSchema: z.object({
        courseId: z.string().uuid(),
        alignments: z
          .array(
            z.object({
              objectiveCode: z.string().min(1).max(16),
              itemType: z.enum(["module", "assignment", "quiz", "page", "file", "discussion"]),
              itemId: z.string().uuid(),
              weight: z.number().min(0).max(1).default(1),
            })
          )
          .min(1)
          .max(50),
      }),
      execute: async (input) => {
        const id = await createProposal(ctx, {
          kind: "alignment",
          courseId: input.courseId,
          summary: `Align ${input.alignments.length} item(s) to objectives.`,
          diff: input,
        });
        return ok("alignment.matrix", `Drafted ${input.alignments.length} alignment(s) as proposal ${id}.`, { proposalId: id, alignments: input.alignments });
      },
    }),

    listProposals: tool({
      description: "List change proposals for review (optionally filter by course and status).",
      inputSchema: z.object({
        courseId: z.string().uuid().optional(),
        status: z.enum(["pending", "approved", "rejected", "applied"]).default("pending"),
        limit: z.number().int().min(1).max(50).default(20),
      }),
      execute: async ({ courseId, status, limit }) => {
        const rows = await db
          .select({ id: changeProposals.id, kind: changeProposals.kind, status: changeProposals.status, summary: changeProposals.summary, courseId: changeProposals.courseId, createdAt: changeProposals.createdAt })
          .from(changeProposals)
          .where(
            and(
              eq(changeProposals.orgId, ctx.orgId),
              eq(changeProposals.status, status),
              ...(courseId ? [eq(changeProposals.courseId, courseId)] : [])
            )
          )
          .orderBy(desc(changeProposals.createdAt))
          .limit(limit);
        return ok("authoring.course-outline", `Found ${rows.length} ${status} proposal(s).`, { proposals: rows });
      },
    }),

    getClassInsights: tool({
      description: "Cohort-level objective coverage for a course: how the class as a whole is tracking against each objective.",
      inputSchema: z.object({ courseId: z.string().uuid() }),
      execute: async ({ courseId }) => {
        await assertCanEditCourse(ctx, courseId);

        const students = await db
          .select({ userId: enrollments.userId })
          .from(enrollments)
          .where(and(eq(enrollments.orgId, ctx.orgId), eq(enrollments.courseId, courseId), eq(enrollments.role, "student")));
        const studentIds = students.map((s) => s.userId);

        const objectives = await db
          .select()
          .from(learningObjectives)
          .where(and(eq(learningObjectives.orgId, ctx.orgId), eq(learningObjectives.courseId, courseId)));

        const cohort = [];
        for (const obj of objectives) {
          const aligned = await db
            .select({ itemId: contentAlignments.itemId })
            .from(contentAlignments)
            .where(and(eq(contentAlignments.orgId, ctx.orgId), eq(contentAlignments.objectiveId, obj.id), eq(contentAlignments.itemType, "assignment")));
          const alignedIds = aligned.map((a) => a.itemId);

          let avgCoverage: number | null = null;
          if (alignedIds.length > 0 && studentIds.length > 0) {
            const done = await db
              .select({ userId: submissions.userId })
              .from(submissions)
              .where(and(eq(submissions.orgId, ctx.orgId), eq(submissions.courseId, courseId), inArray(submissions.assignmentId, alignedIds)));
            // crude: completed submissions / (students * aligned items)
            avgCoverage = Math.round((done.length / (studentIds.length * alignedIds.length)) * 100);
          }
          cohort.push({ objectiveId: obj.id, code: obj.code, description: obj.description, alignedItems: alignedIds.length, avgCoverage });
        }

        return ok("insights.cohort", `Cohort coverage across ${objectives.length} objectives for ${studentIds.length} students.`, {
          courseId,
          studentCount: studentIds.length,
          objectives: cohort,
        });
      },
    }),
  };
}

export type InstructorToolSet = ReturnType<typeof createInstructorTools>;
