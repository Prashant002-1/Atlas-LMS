import { z } from "zod";
import { rubricCriteriaSchema } from "@/lib/agent/session-parts";

/**
 * The block registry, Atlas's generative-UI contract.
 *
 * The agent never draws UI. It emits typed blocks; the client renders each block
 * through a fixed component registry; the server validates every block against
 * these schemas before anything is persisted. One schema, three consumers:
 *
 *   1. the agent's tool inputs (what it is allowed to say),
 *   2. the React registry (what the professor sees),
 *   3. the proposal_blocks rows (what gets applied to the course).
 *
 * Versioned so persisted blocks stay renderable as schemas evolve.
 */

export const BLOCK_SCHEMA_VERSION = "1";

const objectiveCodes = z
  .array(z.string().min(1).max(16))
  .max(6)
  .describe("Objective codes this item serves, e.g. ['LO2']. Use existing codes from the course record.");

/* ── course structure blocks ─────────────────────────────────── */

export const objectiveBlockSchema = z.object({
  type: z.literal("objective"),
  code: z.string().min(2).max(16).describe("Short stable code, e.g. 'LO5'. Must not collide with existing codes."),
  description: z.string().min(8).max(400),
  bloomLevel: z.enum(["remember", "understand", "apply", "analyze", "evaluate", "create"]),
  assessmentWeight: z.number().min(0).max(1).describe("Share of assessed weight, 0..1."),
});

export const moduleBlockSchema = z.object({
  type: z.literal("module"),
  name: z.string().min(3).max(200),
  summaryMd: z.string().min(20).max(2400).describe("What the week covers and why it matters, in the professor's voice."),
  objectiveCodes,
  week: z.number().int().min(1).max(20).optional().describe("1-based week of the term, if the module is week-shaped."),
});

export const assignmentBlockSchema = z.object({
  type: z.literal("assignment"),
  name: z.string().min(3).max(220),
  descriptionMd: z.string().min(20).max(4000).describe("The task, the deliverable, and what good work looks like."),
  objectiveCodes,
  pointsPossible: z.number().min(1).max(1000),
  dueWeek: z.number().int().min(1).max(20).optional(),
});

export const pageBlockSchema = z.object({
  type: z.literal("page"),
  title: z.string().min(3).max(200),
  bodyMd: z.string().min(40).max(12000),
  objectiveCodes: objectiveCodes.optional(),
});

export const announcementBlockSchema = z.object({
  type: z.literal("announcement"),
  title: z.string().min(3).max(200),
  messageMd: z.string().min(10).max(4000),
});

/* ── practice & assessment blocks ────────────────────────────── */

export const practiceQuestionSchema = z.object({
  prompt: z.string().min(10).max(2000),
  kind: z.enum(["multiple_choice", "short_answer", "worked_problem"]),
  options: z.array(z.string().min(1).max(400)).min(2).max(6).optional().describe("Choices, multiple_choice only."),
  answer: z.string().min(1).max(2000).describe("The correct answer (or model answer)."),
  rationaleMd: z.string().min(10).max(2000).describe("Why the answer is right; what mistake each distractor encodes."),
});

export const practiceSetBlockSchema = z.object({
  type: z.literal("practice_set"),
  title: z.string().min(3).max(200),
  objectiveCodes,
  base: z.string().min(10).max(1200).describe("The shared scenario/dataset the questions stand on, concrete, from course material."),
  questions: z.array(practiceQuestionSchema).min(1).max(12),
});

export const rubricBlockSchema = z.object({
  type: z.literal("rubric"),
  title: z.string().min(3).max(200),
  criteria: z
    .array(
      z.object({
        name: z.string().min(2).max(160),
        weight: z.number().min(0).max(1),
        levels: z
          .array(z.object({ label: z.string().min(1).max(60), description: z.string().min(4).max(600) }))
          .min(2)
          .max(6),
      })
    )
    .min(1)
    .max(10),
});

/**
 * The v0 session rubric as a proposal payload: the SAME criteria shape the
 * rubrics table stores and the grading pipeline reads (session-parts), plus
 * the work-session assignment it targets. Applying writes a new rubric
 * version and repoints the session assignment; grades already given stay
 * pinned to the version that graded them.
 */
export const sessionRubricBlockSchema = z.object({
  type: z.literal("session_rubric"),
  assignmentId: z.string().uuid(),
  title: z.string().min(3).max(200),
  criteria: rubricCriteriaSchema,
});

/**
 * A whole AI assignment as a proposal payload: the contract (brief, duration,
 * side-notes toggle) and the rubric that grades it, both targeting an existing
 * assignment. Creation happens in conversation with
 * Atlas and lands here; applying writes the next rubric version and the
 * session-assignment row in one transaction. The tab only sees and governs.
 */
export const aiAssignmentBlockSchema = z.object({
  type: z.literal("ai_assignment"),
  assignmentId: z.string().uuid(),
  title: z.string().min(3).max(200),
  instructions: z.string().min(10).max(2000),
  durationMinutes: z.number().int().min(5).max(240),
  personalRecordSideNotes: z.boolean(),
  criteria: rubricCriteriaSchema,
});

/* ── student-facing response blocks (cue surface) ────────────── */

export const explanationBlockSchema = z.object({
  type: z.literal("explanation"),
  headline: z.string().min(3).max(200).describe("One line naming the idea being explained."),
  bodyMd: z.string().min(20).max(6000),
  citations: z
    .array(
      z.object({
        sourceType: z.enum(["module", "page", "assignment", "syllabus"]),
        sourceId: z.string().describe("The id of the course record cited, must come from the context pack."),
        label: z.string().min(1).max(200),
      })
    )
    .max(8)
    .describe("Course records this explanation stands on. Required when course policy requires citations."),
  checkQuestion: z.string().min(10).max(400).optional().describe("One quick self-check question, when depth allows."),
});

export const answerBlockSchema = z.object({
  type: z.literal("answer"),
  bodyMd: z.string().min(10).max(4000),
  citations: z
    .array(
      z.object({
        sourceType: z.enum(["module", "page", "assignment", "syllabus", "announcement"]),
        sourceId: z.string(),
        label: z.string().min(1).max(200),
      })
    )
    .max(8),
  escalate: z
    .boolean()
    .describe("True when the question can't be answered from course records and belongs with the professor."),
});

/* ── registry ────────────────────────────────────────────────── */

export const proposalBlockSchemas = {
  objective: objectiveBlockSchema,
  module: moduleBlockSchema,
  assignment: assignmentBlockSchema,
  page: pageBlockSchema,
  announcement: announcementBlockSchema,
  practice_set: practiceSetBlockSchema,
  rubric: rubricBlockSchema,
  session_rubric: sessionRubricBlockSchema,
  ai_assignment: aiAssignmentBlockSchema,
} as const;

export const blockSchema = z.discriminatedUnion("type", [
  objectiveBlockSchema,
  moduleBlockSchema,
  assignmentBlockSchema,
  pageBlockSchema,
  announcementBlockSchema,
  practiceSetBlockSchema,
  rubricBlockSchema,
  sessionRubricBlockSchema,
  aiAssignmentBlockSchema,
  explanationBlockSchema,
  answerBlockSchema,
]);

export type Block = z.infer<typeof blockSchema>;
export type BlockType = Block["type"];
export type ObjectiveBlock = z.infer<typeof objectiveBlockSchema>;
export type ModuleBlock = z.infer<typeof moduleBlockSchema>;
export type AssignmentBlock = z.infer<typeof assignmentBlockSchema>;
export type PageBlock = z.infer<typeof pageBlockSchema>;
export type AnnouncementBlock = z.infer<typeof announcementBlockSchema>;
export type PracticeSetBlock = z.infer<typeof practiceSetBlockSchema>;
export type RubricBlock = z.infer<typeof rubricBlockSchema>;
export type SessionRubricBlock = z.infer<typeof sessionRubricBlockSchema>;
export type AiAssignmentBlock = z.infer<typeof aiAssignmentBlockSchema>;
export type ExplanationBlock = z.infer<typeof explanationBlockSchema>;
export type AnswerBlock = z.infer<typeof answerBlockSchema>;

/** Parse a persisted block row back into a typed block (or null when invalid/unknown). */
export function parseStoredBlock(blockType: string, data: unknown): Block | null {
  const result = blockSchema.safeParse({ ...(data as object), type: blockType });
  return result.success ? result.data : null;
}
