import { tool } from "ai";
import { z } from "zod";
import { and, eq, desc, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  courses,
  modules,
  assignments,
  enrollments,
  users,
  submissions,
  learningObjectives,
  changeProposals,
} from "@/lib/db/schema";
import { workspaceDecisionInputSchema, type WorkspaceDecision } from "@/lib/workspace/decision-schema";
import { validateWorkspaceDecision } from "@/lib/workspace/validation";
import { ok, assertCanEditCourse, type ChatToolContext, type ToolPayload } from "@/lib/ai/tools/shared";

/**
 * Instructor tools — Atlas as the PROFESSOR'S agent. Two hard rules encoded here:
 *
 *  1. NO HEURISTICS / NO UNSOLICITED JUDGMENT. There is no "at-risk", no early-warning,
 *     no Atlas-invented threshold. Read tools only return what the professor explicitly
 *     asked for (they supply the criteria). The agent never labels or decides "concerning".
 *  2. PROPOSE, NEVER PERFORM. Every write (content, grades, announcements) becomes a
 *     `change_proposals` row the professor reviews + approves. Applying happens in a
 *     server action on approval — never from a tool, never autonomously.
 */

const PROPOSAL_KINDS = [
  "course", "syllabus", "module", "assignment", "quiz", "page", "rubric", "objective", "alignment", "announcement", "grading",
] as const;

async function createProposal(
  ctx: ChatToolContext,
  args: { kind: (typeof PROPOSAL_KINDS)[number]; courseId: string | null; summary: string; diff: unknown }
) {
  if (args.courseId) await assertCanEditCourse(ctx, args.courseId);
  const [row] = await db
    .insert(changeProposals)
    .values({
      orgId: ctx.orgId,
      courseId: args.courseId,
      authorId: ctx.userId,
      kind: args.kind === "course" ? "course" : (args.kind as "syllabus" | "module" | "assignment" | "quiz" | "rubric" | "objective" | "alignment" | "import"),
      status: "pending",
      summary: args.summary,
      diff: { kind: args.kind, ...(args.diff as object) },
    })
    .returning({ id: changeProposals.id });
  return row.id;
}

export function createInstructorTools(ctx: ChatToolContext) {
  return {
    setWorkspaceDecision: tool({
      description:
        "Choose the workspace goal, view, panels, actions, and evidence for this turn. Call before other tools so the canvas reflects what you're doing. Instructor views only.",
      inputSchema: workspaceDecisionInputSchema,
      execute: async (input): Promise<ToolPayload<WorkspaceDecision>> => {
        const v = validateWorkspaceDecision(input, { persona: "instructor" });
        if (!v.success) throw new Error(v.errors.join(" "));
        return ok("workspace.decision", `Workspace: ${input.view} for ${input.goal.replaceAll("_", " ")}.`, input);
      },
    }),

    /* ─────────── READ — exactly what the professor asks, nothing inferred ─────────── */

    getCourseOverview: tool({
      description:
        "Fetch a factual overview of one of the professor's courses: counts of modules/assignments/objectives/students and the lists. Read-only. Use when the professor asks what's in a course.",
      inputSchema: z.object({ courseId: z.string().uuid() }),
      execute: async ({ courseId }) => {
        await assertCanEditCourse(ctx, courseId);
        const [course] = await db.select().from(courses).where(and(eq(courses.orgId, ctx.orgId), eq(courses.id, courseId))).limit(1);
        if (!course) throw new Error("Course not found.");
        const mods = await db.select({ id: modules.id, name: modules.name, position: modules.position, published: modules.published }).from(modules).where(eq(modules.courseId, courseId)).orderBy(modules.position);
        const asg = await db.select({ id: assignments.id, name: assignments.name, dueAt: assignments.dueAt, points: assignments.pointsPossible, published: assignments.published }).from(assignments).where(eq(assignments.courseId, courseId)).orderBy(assignments.dueAt);
        const objs = await db.select({ id: learningObjectives.id, code: learningObjectives.code, description: learningObjectives.description }).from(learningObjectives).where(eq(learningObjectives.courseId, courseId));
        const studentCount = (await db.select({ id: enrollments.id }).from(enrollments).where(and(eq(enrollments.courseId, courseId), eq(enrollments.role, "student")))).length;
        return ok("course.overview", `${course.code}: ${mods.length} modules, ${asg.length} assignments, ${objs.length} objectives, ${studentCount} students.`, {
          course: { id: course.id, code: course.code, name: course.name, term: course.term, status: course.status },
          modules: mods, assignments: asg, objectives: objs, studentCount,
        });
      },
    }),

    queryStudents: tool({
      description:
        "Return students that match criteria THE PROFESSOR SPECIFIES. You never invent thresholds or labels — only apply the filters given. Use for requests like 'who scored below 70 on PS3' or 'who hasn't submitted the midterm'. If the professor hasn't given a concrete criterion, ask them for it instead of guessing.",
      inputSchema: z.object({
        courseId: z.string().uuid(),
        assignmentId: z.string().uuid().optional().describe("Scope the filter to one assignment's submissions."),
        scoreBelow: z.number().optional().describe("Professor-specified score threshold; matches submissions strictly below this."),
        scoreAtOrAbove: z.number().optional(),
        status: z.enum(["submitted", "graded", "unsubmitted", "missing"]).optional().describe("Submission status for the given assignment."),
        limit: z.number().int().min(1).max(200).default(100),
      }),
      execute: async ({ courseId, assignmentId, scoreBelow, scoreAtOrAbove, status, limit }) => {
        await assertCanEditCourse(ctx, courseId);
        const roster = await db
          .select({ userId: enrollments.userId, name: users.name, email: users.email, currentScore: enrollments.currentScore, currentGrade: enrollments.currentGrade })
          .from(enrollments)
          .innerJoin(users, eq(users.id, enrollments.userId))
          .where(and(eq(enrollments.orgId, ctx.orgId), eq(enrollments.courseId, courseId), eq(enrollments.role, "student")));

        let rows: Array<Record<string, unknown>> = roster.map((r) => ({ userId: r.userId, name: r.name, email: r.email, currentScore: r.currentScore, currentGrade: r.currentGrade }));

        if (assignmentId) {
          const subs = await db
            .select({ userId: submissions.userId, score: submissions.score, submittedAt: submissions.submittedAt, gradedAt: submissions.gradedAt, missing: submissions.missing })
            .from(submissions)
            .where(and(eq(submissions.orgId, ctx.orgId), eq(submissions.assignmentId, assignmentId)));
          const byUser = new Map(subs.map((s) => [s.userId, s]));
          rows = roster.map((r) => {
            const s = byUser.get(r.userId);
            return {
              userId: r.userId, name: r.name, email: r.email,
              score: s?.score ?? null,
              status: !s ? "unsubmitted" : s.missing ? "missing" : s.gradedAt ? "graded" : s.submittedAt ? "submitted" : "unsubmitted",
            };
          });
        }

        const matches = rows.filter((r) => {
          const score = (assignmentId ? r.score : r.currentScore) as number | null;
          if (scoreBelow !== undefined && !(score !== null && score < scoreBelow)) return false;
          if (scoreAtOrAbove !== undefined && !(score !== null && score >= scoreAtOrAbove)) return false;
          if (status !== undefined && r.status !== status) return false;
          return true;
        }).slice(0, limit);

        const crit = [
          assignmentId ? "on the specified assignment" : "by current course score",
          scoreBelow !== undefined ? `score < ${scoreBelow}` : null,
          scoreAtOrAbove !== undefined ? `score ≥ ${scoreAtOrAbove}` : null,
          status ? `status = ${status}` : null,
        ].filter(Boolean).join(", ");
        return ok("students.query", `${matches.length} student(s) match your criteria (${crit || "no filter — full roster"}).`, { criteria: { assignmentId, scoreBelow, scoreAtOrAbove, status }, students: matches });
      },
    }),

    getAssignmentResults: tool({
      description: "Return the raw results for one assignment: each student's score and submission status. Read-only, no interpretation.",
      inputSchema: z.object({ courseId: z.string().uuid(), assignmentId: z.string().uuid() }),
      execute: async ({ courseId, assignmentId }) => {
        await assertCanEditCourse(ctx, courseId);
        const rows = await db
          .select({ userId: submissions.userId, name: users.name, score: submissions.score, grade: submissions.grade, submittedAt: submissions.submittedAt, gradedAt: submissions.gradedAt, missing: submissions.missing })
          .from(submissions)
          .innerJoin(users, eq(users.id, submissions.userId))
          .where(and(eq(submissions.orgId, ctx.orgId), eq(submissions.assignmentId, assignmentId)));
        return ok("assignment.results", `${rows.length} submission record(s).`, { assignmentId, results: rows });
      },
    }),

    computeStat: tool({
      description: "Compute a descriptive statistic the professor asks for over one assignment's scores (count, mean, median, min, max). Only runs when requested; no flags, no labels.",
      inputSchema: z.object({ courseId: z.string().uuid(), assignmentId: z.string().uuid() }),
      execute: async ({ courseId, assignmentId }) => {
        await assertCanEditCourse(ctx, courseId);
        const rows = await db.select({ score: submissions.score }).from(submissions).where(and(eq(submissions.orgId, ctx.orgId), eq(submissions.assignmentId, assignmentId), sql`${submissions.score} is not null`));
        const scores = rows.map((r) => Number(r.score)).sort((a, b) => a - b);
        const n = scores.length;
        const mean = n ? scores.reduce((a, b) => a + b, 0) / n : null;
        const median = n ? (n % 2 ? scores[(n - 1) / 2] : (scores[n / 2 - 1] + scores[n / 2]) / 2) : null;
        return ok("assignment.stat", `n=${n}${mean !== null ? `, mean=${mean.toFixed(1)}` : ""}.`, {
          assignmentId, count: n, mean, median, min: n ? scores[0] : null, max: n ? scores[n - 1] : null,
        });
      },
    }),

    /* ─────────── WRITE — drafts only; the professor approves ─────────── */

    proposeContent: tool({
      description:
        "Draft course content as a PROPOSAL for the professor to review and approve — never applied directly. Use for syllabus, a module, an assignment, a quiz, a page, a rubric, an objective, a content↔objective alignment, or an announcement (drafted, NOT sent). Put the full structured content in `body`.",
      inputSchema: z.object({
        kind: z.enum(["course", "syllabus", "module", "assignment", "quiz", "page", "rubric", "objective", "alignment", "announcement"]),
        courseId: z.string().uuid().optional().describe("Omit only when proposing a brand-new course."),
        summary: z.string().min(6).max(200).describe("One line the professor will see in the review queue."),
        body: z.record(z.string(), z.unknown()).describe("The structured draft (markdown, fields, items) for this kind."),
      }),
      execute: async ({ kind, courseId, summary, body }) => {
        const id = await createProposal(ctx, { kind, courseId: courseId ?? null, summary, diff: { body } });
        return ok("authoring.proposal", `Drafted a ${kind} proposal — review to apply. (${summary})`, { proposalId: id, kind, summary, body });
      },
    }),

    draftFeedback: tool({
      description:
        "Draft grades and/or feedback for an assignment as a PROPOSAL. Nothing is posted to students until the professor approves. Provide one entry per student you were asked to grade.",
      inputSchema: z.object({
        courseId: z.string().uuid(),
        assignmentId: z.string().uuid(),
        items: z.array(z.object({
          userId: z.string().uuid(),
          score: z.number().optional(),
          feedback: z.string().max(4000),
        })).min(1).max(300),
      }),
      execute: async ({ courseId, assignmentId, items }) => {
        const id = await createProposal(ctx, { kind: "grading", courseId, summary: `Drafted feedback for ${items.length} submission(s)`, diff: { assignmentId, items } });
        return ok("grading.proposal", `Drafted feedback for ${items.length} submission(s) — review before posting.`, { proposalId: id, assignmentId, count: items.length });
      },
    }),

    listProposals: tool({
      description: "List the professor's pending (or other status) change proposals for review.",
      inputSchema: z.object({
        courseId: z.string().uuid().optional(),
        status: z.enum(["pending", "approved", "rejected", "applied"]).default("pending"),
        limit: z.number().int().min(1).max(50).default(20),
      }),
      execute: async ({ courseId, status, limit }) => {
        const rows = await db
          .select({ id: changeProposals.id, kind: changeProposals.kind, status: changeProposals.status, summary: changeProposals.summary, courseId: changeProposals.courseId, createdAt: changeProposals.createdAt })
          .from(changeProposals)
          .where(and(eq(changeProposals.orgId, ctx.orgId), eq(changeProposals.status, status), ...(courseId ? [eq(changeProposals.courseId, courseId)] : [])))
          .orderBy(desc(changeProposals.createdAt))
          .limit(limit);
        return ok("proposals.list", `${rows.length} ${status} proposal(s).`, { proposals: rows });
      },
    }),
  };
}

export type InstructorToolSet = ReturnType<typeof createInstructorTools>;
