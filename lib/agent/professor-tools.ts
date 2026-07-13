import { and, desc, eq } from "drizzle-orm";
import { tool } from "ai";
import { z } from "zod";
import { db } from "@/lib/db";
import { assignments, changeProposals, pages, proposalBlocks, rubrics, sessionAssignments } from "@/lib/db/schema";
import {
  BLOCK_SCHEMA_VERSION,
  announcementBlockSchema,
  assignmentBlockSchema,
  moduleBlockSchema,
  objectiveBlockSchema,
  pageBlockSchema,
  parseStoredBlock,
  practiceSetBlockSchema,
  type AiAssignmentBlock,
} from "@/lib/agent/blocks";
import {
  buildSessionRubricBlock,
  normalizeRubricDraft,
  rubricDraftCriterionSchema,
  rubricDraftSchema,
  sessionRubricBlockData,
  starterRubricCriteria,
} from "@/lib/agent/rubric-proposal";
import { parseRubricCriteria, type RubricCriterion } from "@/lib/agent/session-parts";
import type { ProfessorScope } from "@/lib/agent/professor-context";

/**
 * The professor profile's closed tool set. Four moves, no more:
 *
 *   read_page              read one course page in full (the pack clips bodies);
 *   propose_ai_assignment  set up an existing assignment as an AI assignment
 *                          (contract + rubric) behind the Review gate. This is
 *                          THE creation path; there is no form for it anywhere;
 *   propose_rubric         draft a rubric revision for an existing AI assignment;
 *   propose_records        draft modules, work, pages, notes, practice,
 *                          objectives behind the same gate.
 *
 * The write-shaped tools produce changeProposals + proposalBlocks rows ONLY.
 * Nothing here updates a live course record; applying is Review's job
 * (lib/agent/apply.ts), and every row carries the planning session as
 * provenance. Tool failures return structured errors instead of throwing,
 * so a rejected draft never kills the professor's stream.
 */

export type RubricProposalOutput =
  | {
      ok: true;
      proposalId: string;
      assignmentId: string;
      assignmentName: string;
      title: string;
      note: string | null;
      criteria: RubricCriterion[];
      replacesVersion: number;
      replacesCriteria: RubricCriterion[];
    }
  | { ok: false; error: string };

export type RecordsProposalOutput =
  | { ok: true; proposalId: string; summary: string; records: Array<{ type: string; title: string }> }
  | { ok: false; error: string };

export type AiAssignmentProposalOutput =
  | {
      ok: true;
      proposalId: string;
      assignmentId: string;
      assignmentName: string;
      instructions: string;
      durationMinutes: number;
      transcriptPolicy: string;
      personalRecordSideNotes: boolean;
      criteria: RubricCriterion[];
      usedStandardFrame: boolean;
      note: string | null;
    }
  | { ok: false; error: string };

export type ReadPageOutput = { ok: true; title: string; body: string } | { ok: false; error: string };

/** Blocks the professor profile may draft. Student-facing cue blocks and the legacy rubric shape are not in this set. */
const professorRecordBlockSchema = z.discriminatedUnion("type", [
  objectiveBlockSchema,
  moduleBlockSchema,
  assignmentBlockSchema,
  pageBlockSchema,
  announcementBlockSchema,
  practiceSetBlockSchema,
]);

const proposeRecordsSchema = z.object({
  summary: z.string().min(8).max(300).describe("One plain line naming what these drafts are, in the professor's voice."),
  blocks: z.array(professorRecordBlockSchema).min(1).max(6),
});

const aiAssignmentDraftSchema = z.object({
  assignmentId: z
    .string()
    .uuid()
    .describe("An existing assignment in the course, from the pack, that does not run as an AI assignment yet."),
  brief: z
    .string()
    .min(10)
    .max(2000)
    .describe("The brief the student sees: the problem, the deliverable, and how the session runs."),
  durationMinutes: z.number().int().min(5).max(240).optional().describe("Session length in minutes; 30 unless the professor says otherwise."),
  transcriptPolicy: z.string().min(3).max(200).optional().describe("What students are told about transcript visibility."),
  personalRecordSideNotes: z
    .boolean()
    .optional()
    .describe("Let the session surface a student's own record as margin cards. Off unless the professor turns it on."),
  criteria: z
    .array(rubricDraftCriterionSchema)
    .min(2)
    .max(8)
    .optional()
    .describe("The rubric shaped in this conversation. Omit to start from the standard four-criterion frame."),
  note: z.string().max(400).optional().describe("One line on the intent, shown with the draft."),
});

function kindForBlockTypes(types: string[]): "module" | "assignment" | "quiz" | "objective" | "course" {
  const unique = [...new Set(types)];
  if (unique.length !== 1) return "course";
  switch (unique[0]) {
    case "module":
      return "module";
    case "assignment":
      return "assignment";
    case "practice_set":
      return "quiz";
    case "objective":
      return "objective";
    default:
      return "course";
  }
}

function blockTitle(block: { type: string } & Record<string, unknown>): string {
  if (typeof block.title === "string") return block.title;
  if (typeof block.name === "string") return block.name;
  if (block.type === "objective" && typeof block.code === "string") return String(block.code);
  return block.type.replaceAll("_", " ");
}

export function professorTools(args: { scope: ProfessorScope; sessionId: string }) {
  const { scope, sessionId } = args;

  const read_page = tool({
    description:
      "Read one course page in full. The context pack clips page bodies; use this before drafting from a page whose clipped text is not enough.",
    inputSchema: z.object({ pageId: z.string().uuid().describe("A page id from the context pack.") }),
    execute: async ({ pageId }): Promise<ReadPageOutput> => {
      const [row] = await db
        .select({ title: pages.title, bodyMd: pages.bodyMd })
        .from(pages)
        .where(and(eq(pages.orgId, scope.orgId), eq(pages.courseId, scope.courseId), eq(pages.id, pageId)))
        .limit(1);
      if (!row) return { ok: false, error: "No such page in this course." };
      return { ok: true, title: row.title, body: (row.bodyMd ?? "").slice(0, 12_000) };
    },
  });

  const propose_ai_assignment = tool({
    description:
      "Set up an existing assignment as an AI assignment: the brief, duration, transcript policy, side-notes toggle, and the rubric, as ONE reviewable draft. Applying creates the AI assignment. This is the only way one is created.",
    inputSchema: aiAssignmentDraftSchema,
    execute: async (draft): Promise<AiAssignmentProposalOutput> => {
      const [target] = await db
        .select({ id: assignments.id, name: assignments.name })
        .from(assignments)
        .where(
          and(eq(assignments.orgId, scope.orgId), eq(assignments.courseId, scope.courseId), eq(assignments.id, draft.assignmentId))
        )
        .limit(1);
      if (!target) {
        return { ok: false, error: "That assignment is not in this course. Use an id from the pack." };
      }

      const [configured] = await db
        .select({ id: sessionAssignments.id })
        .from(sessionAssignments)
        .where(and(eq(sessionAssignments.orgId, scope.orgId), eq(sessionAssignments.assignmentId, draft.assignmentId)))
        .limit(1);
      if (configured) {
        return {
          ok: false,
          error: `${target.name} already runs as an AI assignment. Use propose_rubric to revise its rubric, or the grade view for its contract.`,
        };
      }

      const pending = await db
        .select({ id: changeProposals.id, diff: changeProposals.diff })
        .from(changeProposals)
        .where(
          and(
            eq(changeProposals.orgId, scope.orgId),
            eq(changeProposals.courseId, scope.courseId),
            eq(changeProposals.kind, "assignment"),
            eq(changeProposals.status, "pending")
          )
        );
      const alreadyWaiting = pending.some((row) => {
        const diff = row.diff as { assignmentId?: string } | null;
        return diff?.assignmentId === draft.assignmentId;
      });
      if (alreadyWaiting) {
        return {
          ok: false,
          error: "An AI assignment draft for that assignment is already waiting in Review. The professor decides that one first.",
        };
      }

      const usedStandardFrame = !draft.criteria || draft.criteria.length === 0;
      let criteria: RubricCriterion[];
      if (usedStandardFrame) {
        criteria = starterRubricCriteria();
      } else {
        const normalized = normalizeRubricDraft({ criteria: draft.criteria! });
        if (!normalized.ok) return { ok: false, error: normalized.error };
        criteria = normalized.criteria;
      }

      const block: AiAssignmentBlock = {
        type: "ai_assignment",
        assignmentId: draft.assignmentId,
        title: `Run ${target.name} as an AI assignment`,
        instructions: draft.brief,
        durationMinutes: draft.durationMinutes ?? 30,
        transcriptPolicy: draft.transcriptPolicy ?? "shared on request / for review",
        personalRecordSideNotes: draft.personalRecordSideNotes ?? false,
        criteria,
      };
      const blockData = {
        assignmentId: block.assignmentId,
        title: block.title,
        instructions: block.instructions,
        durationMinutes: block.durationMinutes,
        transcriptPolicy: block.transcriptPolicy,
        personalRecordSideNotes: block.personalRecordSideNotes,
        criteria: block.criteria,
      };
      const roundTrip = parseStoredBlock("ai_assignment", blockData);
      if (!roundTrip || roundTrip.type !== "ai_assignment") {
        return { ok: false, error: "The draft did not pass the AI assignment block contract; adjust it and try again." };
      }

      try {
        const proposalId = await db.transaction(async (tx) => {
          const [proposal] = await tx
            .insert(changeProposals)
            .values({
              orgId: scope.orgId,
              courseId: scope.courseId,
              authorId: scope.instructorId,
              kind: "assignment",
              status: "pending",
              summary: `AI assignment draft: ${target.name}`,
              diff: { source: "planning_chat", assignmentId: draft.assignmentId, note: draft.note ?? null },
              sessionId,
            })
            .returning({ id: changeProposals.id });
          await tx.insert(proposalBlocks).values({
            orgId: scope.orgId,
            proposalId: proposal.id,
            position: 1,
            blockType: "ai_assignment",
            schemaVersion: BLOCK_SCHEMA_VERSION,
            data: blockData,
            status: "pending",
          });
          return proposal.id;
        });

        return {
          ok: true,
          proposalId,
          assignmentId: draft.assignmentId,
          assignmentName: target.name,
          instructions: block.instructions,
          durationMinutes: block.durationMinutes,
          transcriptPolicy: block.transcriptPolicy,
          personalRecordSideNotes: block.personalRecordSideNotes,
          criteria,
          usedStandardFrame,
          note: draft.note ?? null,
        };
      } catch {
        return { ok: false, error: "Could not store the draft. Nothing was written; try once more." };
      }
    },
  });

  const propose_rubric = tool({
    description:
      "Draft a rubric for one AI assignment as a reviewable change. The draft lands in Review; applying writes a new rubric version and repoints the assignment. Use for new rubrics and for revisions.",
    inputSchema: rubricDraftSchema,
    execute: async (draft): Promise<RubricProposalOutput> => {
      const [target] = await db
        .select({
          assignmentId: sessionAssignments.assignmentId,
          assignmentName: assignments.name,
          rubricVersion: rubrics.version,
          rubricCriteria: rubrics.criteria,
        })
        .from(sessionAssignments)
        .innerJoin(assignments, eq(assignments.id, sessionAssignments.assignmentId))
        .innerJoin(rubrics, eq(rubrics.id, sessionAssignments.rubricId))
        .where(
          and(
            eq(sessionAssignments.orgId, scope.orgId),
            eq(sessionAssignments.courseId, scope.courseId),
            eq(sessionAssignments.assignmentId, draft.assignmentId)
          )
        )
        .limit(1);
      if (!target) {
        return {
          ok: false,
          error:
            "That assignment does not run as an AI assignment yet. Set it up with propose_ai_assignment; propose_rubric revises existing ones.",
        };
      }

      const pending = await db
        .select({ id: changeProposals.id, diff: changeProposals.diff })
        .from(changeProposals)
        .where(
          and(
            eq(changeProposals.orgId, scope.orgId),
            eq(changeProposals.courseId, scope.courseId),
            eq(changeProposals.kind, "rubric"),
            eq(changeProposals.status, "pending")
          )
        )
        .orderBy(desc(changeProposals.createdAt));
      const alreadyWaiting = pending.some((row) => {
        const diff = row.diff as { assignmentId?: string } | null;
        return diff?.assignmentId === draft.assignmentId;
      });
      if (alreadyWaiting) {
        return {
          ok: false,
          error: "A rubric draft for this AI assignment is already waiting in Review. The professor decides that one first.",
        };
      }

      const normalized = normalizeRubricDraft(draft);
      if (!normalized.ok) return { ok: false, error: normalized.error };

      const block = buildSessionRubricBlock({
        assignmentId: draft.assignmentId,
        title: draft.title,
        criteria: normalized.criteria,
      });
      if (!block) {
        return { ok: false, error: "The draft did not pass the rubric block contract; adjust it and try again." };
      }

      try {
        const proposalId = await db.transaction(async (tx) => {
          const [proposal] = await tx
            .insert(changeProposals)
            .values({
              orgId: scope.orgId,
              courseId: scope.courseId,
              authorId: scope.instructorId,
              kind: "rubric",
              status: "pending",
              summary: `Rubric draft for ${target.assignmentName}: ${draft.title}`,
              diff: {
                source: "planning_chat",
                assignmentId: draft.assignmentId,
                replacesVersion: target.rubricVersion,
                note: draft.note ?? null,
              },
              sessionId,
            })
            .returning({ id: changeProposals.id });
          await tx.insert(proposalBlocks).values({
            orgId: scope.orgId,
            proposalId: proposal.id,
            position: 1,
            blockType: "session_rubric",
            schemaVersion: BLOCK_SCHEMA_VERSION,
            data: sessionRubricBlockData(block),
            status: "pending",
          });
          return proposal.id;
        });

        return {
          ok: true,
          proposalId,
          assignmentId: draft.assignmentId,
          assignmentName: target.assignmentName,
          title: draft.title,
          note: draft.note ?? null,
          criteria: normalized.criteria,
          replacesVersion: target.rubricVersion,
          replacesCriteria: parseRubricCriteria(target.rubricCriteria) ?? [],
        };
      } catch {
        return { ok: false, error: "Could not store the draft. Nothing was written; try once more." };
      }
    },
  });

  const propose_records = tool({
    description:
      "Draft course records (modules, work, pages, announcements, practice sets, objectives) as one reviewable change. Drafts land in Review; nothing touches the course until the professor applies them.",
    inputSchema: proposeRecordsSchema,
    execute: async ({ summary, blocks }): Promise<RecordsProposalOutput> => {
      try {
        const proposalId = await db.transaction(async (tx) => {
          const [proposal] = await tx
            .insert(changeProposals)
            .values({
              orgId: scope.orgId,
              courseId: scope.courseId,
              authorId: scope.instructorId,
              kind: kindForBlockTypes(blocks.map((block) => block.type)),
              status: "pending",
              summary,
              diff: { source: "planning_chat" },
              sessionId,
            })
            .returning({ id: changeProposals.id });
          await tx.insert(proposalBlocks).values(
            blocks.map((block, index) => {
              const { type, ...data } = block;
              return {
                orgId: scope.orgId,
                proposalId: proposal.id,
                position: index + 1,
                blockType: type,
                schemaVersion: BLOCK_SCHEMA_VERSION,
                data,
                status: "pending" as const,
              };
            })
          );
          return proposal.id;
        });

        return {
          ok: true,
          proposalId,
          summary,
          records: blocks.map((block) => ({ type: block.type, title: blockTitle(block) })),
        };
      } catch {
        return { ok: false, error: "Could not store the drafts. Nothing was written; try once more." };
      }
    },
  });

  return { read_page, propose_ai_assignment, propose_rubric, propose_records };
}
