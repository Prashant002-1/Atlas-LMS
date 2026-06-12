import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { assignments, changeProposals, modules, pages, proposalBlocks } from "@/lib/db/schema";
import {
  BLOCK_SCHEMA_VERSION,
  announcementBlockSchema,
  answerBlockSchema,
  assignmentBlockSchema,
  explanationBlockSchema,
  moduleBlockSchema,
  objectiveBlockSchema,
  pageBlockSchema,
  practiceSetBlockSchema,
  rubricBlockSchema,
} from "@/lib/agent/blocks";
import type { ContextPack } from "@/lib/agent/context";
import type { CourseAiPolicy } from "@/lib/db/schema";
import { searchSession, loadTurnWindow } from "@/lib/agent/session-search";

/**
 * The agent runtime, two surfaces, one doctrine.
 *
 *   command, the professor's authoring surface. Every write tool emits a typed
 *             block onto ONE pending proposal per run. Nothing touches the live
 *             course; Review owns apply/dismiss.
 *   cue    , the student surface. No chat persona, no free-roaming: a cue press
 *             runs once, grounded in the pack, shaped by the professor's policy,
 *             and must answer through a typed block.
 */

export type Surface = "command" | "cue";
export type CueKind = "explain" | "practice" | "question";

const DOCTRINE = `You are Atlas, the course's own agent. You operate ONLY on the course record provided between <<...>> section markers. Doctrine, non-negotiable:
- Grounded: never invent grades, names, dates, content, or records. Cite record ids ([id:...]) from the pack when you rely on them.
- Propose, never perform: your tools create reviewable drafts. Never claim anything is live.
- Reactive: do exactly what was asked. No unsolicited advice, alerts, or judgments.
- When the request is vague or under-specified, ask one precise clarifying question instead of guessing.
- Write plainly. Never use em dashes; use commas, colons, or separate sentences.`;

export function commandSystemPrompt(pack: ContextPack): string {
  return `${DOCTRINE}

Surface: the professor's command line. The professor states an intent; you draft it as typed blocks using the propose* tools. One command = one proposal; every block you emit lands on it for review.

Authoring standards:
- Tie every module/assignment/practice block to existing objective codes from the pack. If the right objective doesn't exist, propose it first with proposeObjective.
- Write in the professor's register: specific, concrete, no filler. Draft content the professor could publish unchanged.
- Match the course's actual material, reuse its datasets, examples, and terminology from the pack.
- To recall something from earlier in this session (a prior decision, a number, a name), use recallSession instead of guessing; it returns the actual earlier turns.
- Finish with one short text line summarizing what you drafted (the blocks carry the content; do not repeat them in prose).

COURSE RECORD:
${pack.content}`;
}

export function cueSystemPrompt(pack: ContextPack, cue: CueKind, policy: CourseAiPolicy | null): string {
  const depth = policy?.explanationDepth ?? "guided";
  const depthRule =
    depth === "hint"
      ? "Depth: HINT. Point to the relevant idea and material; never carry out the work or state final answers. End with the single next question the student should ask themselves."
      : depth === "guided"
        ? "Depth: GUIDED. Walk the reasoning in steps the student completes; you may resolve sub-steps but never hand over a final answer to open course work."
        : "Depth: FULL. Explain completely, including worked reasoning. Still teach, show why, not just what.";
  const citations = policy?.citationsRequired !== false ? "Citations are REQUIRED: every claim about the course stands on a cited record id from the pack." : "Cite course records where they ground your answer.";
  const persona =
    policy?.personaName && policy.personaStyle
      ? `Voice: you speak as "${policy.personaName}", ${policy.personaStyle}. Keep the voice light; clarity always wins over character.`
      : "";
  const custom = policy?.customInstructions ? `Professor's standing instructions (these outrank everything below them): ${policy.customInstructions}` : "";
  const task =
    cue === "explain"
      ? "The student pressed Explain on the focused record. Use emitExplanation exactly once: explain what the record is asking, the idea underneath it, and how the course material supports it."
      : cue === "practice"
        ? "The student asked for practice on the focused record. Use emitPractice exactly once: build questions from the course's own bases (datasets, examples, scenarios in the pack), aligned to the record's objectives, with rationales that teach."
        : "The student asked a quick question. Use emitAnswer exactly once: answer from the course record. If it cannot be answered from the record, say so plainly and set escalate=true so the student takes it to the professor.";

  return `${DOCTRINE}

Surface: a student cue, anchored to one record. This is not a chat: one cue, one grounded response, through the tool. No greetings, no follow-up promises.
${task}
${depthRule}
${citations}
${custom}
${persona}

COURSE RECORD:
${pack.content}`;
}

/* ── command tools: blocks → one proposal per run ─────────────── */

export type CommandRunState = {
  orgId: string;
  userId: string;
  courseId: string;
  sessionId: string;
  intent: string;
  proposalId: string | null;
  position: number;
};

async function ensureProposal(state: CommandRunState, kind: "course" | "module" | "assignment" | "objective"): Promise<string> {
  if (state.proposalId) return state.proposalId;
  const [row] = await db
    .insert(changeProposals)
    .values({
      orgId: state.orgId,
      courseId: state.courseId,
      authorId: state.userId,
      kind,
      status: "pending",
      summary: state.intent.slice(0, 280),
      diff: { intent: state.intent, blocks: true },
      sessionId: state.sessionId,
    })
    .returning({ id: changeProposals.id });
  state.proposalId = row.id;
  return row.id;
}

function blockTool<S extends z.ZodType>(
  state: CommandRunState,
  schema: S,
  blockType: string,
  description: string,
  proposalKind: "course" | "module" | "assignment" | "objective" = "course"
) {
  return tool({
    description,
    inputSchema: schema,
    execute: async (input: z.infer<S>) => {
      const proposalId = await ensureProposal(state, proposalKind);
      state.position += 1;
      const data = { ...(input as object) } as Record<string, unknown>;
      delete data.type;
      const [row] = await db
        .insert(proposalBlocks)
        .values({
          orgId: state.orgId,
          proposalId,
          position: state.position,
          blockType,
          schemaVersion: BLOCK_SCHEMA_VERSION,
          data,
        })
        .returning({ id: proposalBlocks.id });
      return { ok: true, blockId: row.id, position: state.position };
    },
  });
}

export function createCommandTools(state: CommandRunState) {
  return {
    proposeObjective: blockTool(
      state,
      objectiveBlockSchema,
      "objective",
      "Draft a learning objective for the course. Use when the professor's intent needs an outcome that doesn't exist yet.",
      "objective"
    ),
    proposeModule: blockTool(
      state,
      moduleBlockSchema,
      "module",
      "Draft a module/week of material aligned to objectives.",
      "module"
    ),
    proposeAssignment: blockTool(
      state,
      assignmentBlockSchema,
      "assignment",
      "Draft a piece of student work (problem set, essay, lab, project, exam) aligned to objectives.",
      "assignment"
    ),
    proposePage: blockTool(state, pageBlockSchema, "page", "Draft reference material (reading list, dataset description, guide)."),
    proposeAnnouncement: blockTool(
      state,
      announcementBlockSchema,
      "announcement",
      "Draft a course note/announcement to the class. It is NOT posted until the professor applies it."
    ),
    proposePracticeSet: blockTool(
      state,
      practiceSetBlockSchema,
      "practice_set",
      "Draft a set of practice questions on a concrete base (dataset/scenario) from the course material, with rationales.",
      "module"
    ),
    proposeRubric: blockTool(state, rubricBlockSchema, "rubric", "Draft a grading rubric with weighted criteria and levels.", "assignment"),

    inspectRecord: tool({
      description: "Read one course record in full (module, assignment, or page) when the pack excerpt is not enough.",
      inputSchema: z.object({
        recordType: z.enum(["module", "assignment", "page"]),
        recordId: z.string().describe("The [id:...] of the record, from the pack."),
      }),
      execute: async ({ recordType, recordId }) => {
        if (recordType === "module") {
          const [m] = await db
            .select({ name: modules.name, summaryMd: modules.summaryMd, published: modules.published })
            .from(modules)
            .where(and(eq(modules.id, recordId), eq(modules.orgId, state.orgId), eq(modules.courseId, state.courseId)))
            .limit(1);
          return m ?? { error: "Record not found in this course." };
        }
        if (recordType === "assignment") {
          const [a] = await db
            .select({ name: assignments.name, descriptionMd: assignments.descriptionMd, dueAt: assignments.dueAt, pointsPossible: assignments.pointsPossible, published: assignments.published })
            .from(assignments)
            .where(and(eq(assignments.id, recordId), eq(assignments.orgId, state.orgId), eq(assignments.courseId, state.courseId)))
            .limit(1);
          return a ?? { error: "Record not found in this course." };
        }
        const [p] = await db
          .select({ title: pages.title, bodyMd: pages.bodyMd, published: pages.published })
          .from(pages)
          .where(and(eq(pages.id, recordId), eq(pages.orgId, state.orgId), eq(pages.courseId, state.courseId)))
          .limit(1);
        return p ?? { error: "Record not found in this course." };
      },
    }),

    recallSession: tool({
      description:
        "Search THIS session's earlier turns by keyword. Returns matching snippets with their nearby turns and the conversation's opening/closing turns. Use to recall what was discussed or decided earlier instead of guessing. Keyword search over stored messages, no summaries.",
      inputSchema: z.object({
        query: z.string().min(2).max(200).describe("Keywords to find in earlier turns, e.g. 'midterm rubric weight'."),
        window: z
          .number()
          .int()
          .min(0)
          .max(10)
          .optional()
          .describe("Turns of context to include on each side of each hit (default 5)."),
      }),
      execute: async ({ query, window }) =>
        searchSession(state.orgId, state.sessionId, query, window != null ? { window } : {}),
    }),

    readHistoryWindow: tool({
      description:
        "Read a contiguous block of this session's turns around a given turn index, to expand context after recallSession.",
      inputSchema: z.object({
        centerTurn: z.number().int().min(1),
        before: z.number().int().min(0).max(30).optional(),
        after: z.number().int().min(0).max(30).optional(),
      }),
      execute: async ({ centerTurn, before, after }) => ({
        turns: await loadTurnWindow(state.orgId, state.sessionId, centerTurn, before ?? 8, after ?? 8),
      }),
    }),
  };
}

/* ── cue tools: one typed response block per press ────────────── */

export function createCueTools(cue: CueKind): ToolSet {
  if (cue === "explain") {
    return {
      emitExplanation: tool({
        description: "Deliver the explanation for this cue. Call exactly once.",
        inputSchema: explanationBlockSchema,
        execute: async () => ({ ok: true }),
      }),
    };
  }
  if (cue === "practice") {
    return {
      emitPractice: tool({
        description: "Deliver the practice set for this cue. Call exactly once.",
        inputSchema: practiceSetBlockSchema,
        execute: async () => ({ ok: true }),
      }),
    };
  }
  return {
    emitAnswer: tool({
      description: "Deliver the answer for this cue. Call exactly once.",
      inputSchema: answerBlockSchema,
      execute: async () => ({ ok: true }),
    }),
  };
}
