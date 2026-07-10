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
  practiceSetBlockSchema,
} from "@/lib/agent/blocks";
import {
  buildSessionRubricBlock,
  normalizeRubricDraft,
  rubricDraftSchema,
  sessionRubricBlockData,
} from "@/lib/agent/rubric-proposal";
import { parseRubricCriteria, type RubricCriterion } from "@/lib/agent/session-parts";
import type { ProfessorScope } from "@/lib/agent/professor-context";

/**
 * The professor profile's closed tool set. Three moves, no more:
 *
 *   read_page        read one course page in full (the pack clips bodies);
 *   propose_rubric   draft a session rubric behind the Review gate;
 *   propose_records  draft modules, work, pages, notes, practice, objectives
 *                    behind the same gate.
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
        return { ok: false, error: "That assignment is not an AI assignment in this course. Use an id from the pack." };
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

  return { read_page, propose_rubric, propose_records };
}
