import { and, asc, desc, eq, ilike, inArray, sql, type SQL } from "drizzle-orm";
import { tool } from "ai";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  announcements,
  assignments,
  changeProposals,
  classRollups,
  modules,
  pages,
  proposalBlocks,
  rubrics,
  sessionAssignments,
} from "@/lib/db/schema";
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
import { loadAtlasSkill } from "@/lib/agent/atlas-harness";
import { parseRubricCriteria, type RubricCriterion } from "@/lib/agent/session-parts";
import type { ProfessorScope } from "@/lib/agent/professor-context";

/**
 * The professor harness exposes five domain tools. There is no arbitrary SQL,
 * filesystem, network, shell, code execution, publishing, grading, deletion,
 * or apply capability. Every query repeats the authenticated organization and
 * course scope. Draft tools write proposal rows only.
 * ADR-0011 migration marker: propose_ai_assignment is now draft_ai_assignment.
 */

export type InspectCourseOutput =
  | { ok: true; domain: string; asOf: string; records: unknown[]; count: number }
  | { ok: false; error: string };

export type LoadSkillOutput =
  | { ok: true; skillId: string; name: string; instructions: string }
  | { ok: false; error: string };

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

export type CourseDraftOutput =
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

const inspectCourseSchema = z.object({
  domain: z.enum(["assignments", "modules", "pages", "announcements", "ai_assignments", "drafts", "class_results"]),
  ids: z.array(z.string().uuid()).max(10).optional().describe("Exact ids already known from the current course."),
  query: z.string().trim().min(1).max(160).optional().describe("Optional case-insensitive title or name search."),
  limit: z.number().int().min(1).max(20).default(8),
});

const professorCourseBlockSchema = z.discriminatedUnion("type", [
  objectiveBlockSchema,
  moduleBlockSchema,
  assignmentBlockSchema,
  pageBlockSchema,
  announcementBlockSchema,
  practiceSetBlockSchema,
]);

const draftCourseSchema = z.object({
  summary: z.string().min(8).max(300).describe("One plain line naming the requested drafts."),
  blocks: z.array(professorCourseBlockSchema).min(1).max(6),
});

const aiAssignmentDraftSchema = z.object({
  assignmentId: z.string().uuid().describe("An existing assignment id returned by inspect_course."),
  brief: z.string().min(10).max(2000).describe("The problem, deliverable, and session instructions the student sees."),
  durationMinutes: z.number().int().min(5).max(240).optional(),
  transcriptPolicy: z.string().min(3).max(200).optional(),
  personalRecordSideNotes: z.boolean().optional(),
  criteria: z.array(rubricDraftCriterionSchema).min(2).max(8).optional(),
  note: z.string().max(400).optional(),
});

const clip = (value: string | null | undefined, max = 500) => {
  if (!value) return "";
  return value.length <= max ? value : `${value.slice(0, max)}...`;
};

class DraftConflict extends Error {}

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

async function inspectCourse(
  scope: ProfessorScope,
  input: z.infer<typeof inspectCourseSchema>
): Promise<InspectCourseOutput> {
  const asOf = new Date().toISOString();
  const limit = input.limit;

  if (input.domain === "assignments") {
    const conditions: SQL[] = [eq(assignments.orgId, scope.orgId), eq(assignments.courseId, scope.courseId)];
    if (input.ids?.length) conditions.push(inArray(assignments.id, input.ids));
    if (input.query) conditions.push(ilike(assignments.name, `%${input.query}%`));
    const rows = await db
      .select({
        id: assignments.id,
        name: assignments.name,
        description: assignments.descriptionMd,
        dueAt: assignments.dueAt,
        pointsPossible: assignments.pointsPossible,
        published: assignments.published,
      })
      .from(assignments)
      .where(and(...conditions))
      .orderBy(asc(assignments.position), asc(assignments.createdAt))
      .limit(limit);
    const records = rows.map((row) => ({
      ...row,
      description: clip(row.description, input.ids?.length ? 4000 : 500),
      dueAt: row.dueAt?.toISOString() ?? null,
    }));
    return { ok: true, domain: input.domain, asOf, records, count: records.length };
  }

  if (input.domain === "modules") {
    const conditions: SQL[] = [eq(modules.orgId, scope.orgId), eq(modules.courseId, scope.courseId)];
    if (input.ids?.length) conditions.push(inArray(modules.id, input.ids));
    if (input.query) conditions.push(ilike(modules.name, `%${input.query}%`));
    const rows = await db
      .select({
        id: modules.id,
        name: modules.name,
        summary: modules.summaryMd,
        position: modules.position,
        unlockAt: modules.unlockAt,
        published: modules.published,
      })
      .from(modules)
      .where(and(...conditions))
      .orderBy(asc(modules.position))
      .limit(limit);
    const records = rows.map((row) => ({
      ...row,
      summary: clip(row.summary, input.ids?.length ? 4000 : 500),
      unlockAt: row.unlockAt?.toISOString() ?? null,
    }));
    return { ok: true, domain: input.domain, asOf, records, count: records.length };
  }

  if (input.domain === "pages") {
    const conditions: SQL[] = [eq(pages.orgId, scope.orgId), eq(pages.courseId, scope.courseId)];
    if (input.ids?.length) conditions.push(inArray(pages.id, input.ids));
    if (input.query) conditions.push(ilike(pages.title, `%${input.query}%`));
    const rows = await db
      .select({ id: pages.id, title: pages.title, slug: pages.slug, body: pages.bodyMd, published: pages.published })
      .from(pages)
      .where(and(...conditions))
      .orderBy(asc(pages.slug))
      .limit(limit);
    const records = rows.map((row) => ({ ...row, body: clip(row.body, input.ids?.length ? 12_000 : 1200) }));
    return { ok: true, domain: input.domain, asOf, records, count: records.length };
  }

  if (input.domain === "announcements") {
    const conditions: SQL[] = [eq(announcements.orgId, scope.orgId), eq(announcements.courseId, scope.courseId)];
    if (input.ids?.length) conditions.push(inArray(announcements.id, input.ids));
    if (input.query) conditions.push(ilike(announcements.title, `%${input.query}%`));
    const rows = await db
      .select({
        id: announcements.id,
        title: announcements.title,
        message: announcements.messageMd,
        postedAt: announcements.postedAt,
        published: announcements.published,
      })
      .from(announcements)
      .where(and(...conditions))
      .orderBy(desc(announcements.postedAt))
      .limit(limit);
    const records = rows.map((row) => ({
      ...row,
      message: clip(row.message, input.ids?.length ? 6000 : 800),
      postedAt: row.postedAt?.toISOString() ?? null,
    }));
    return { ok: true, domain: input.domain, asOf, records, count: records.length };
  }

  if (input.domain === "ai_assignments") {
    const conditions: SQL[] = [
      eq(sessionAssignments.orgId, scope.orgId),
      eq(sessionAssignments.courseId, scope.courseId),
      eq(assignments.orgId, scope.orgId),
      eq(assignments.courseId, scope.courseId),
      eq(rubrics.orgId, scope.orgId),
      eq(rubrics.courseId, scope.courseId),
    ];
    if (input.ids?.length) conditions.push(inArray(sessionAssignments.assignmentId, input.ids));
    if (input.query) conditions.push(ilike(assignments.name, `%${input.query}%`));
    const rows = await db
      .select({
        assignmentId: sessionAssignments.assignmentId,
        name: assignments.name,
        instructions: sessionAssignments.instructions,
        durationMinutes: sessionAssignments.durationMinutes,
        transcriptPolicy: sessionAssignments.transcriptPolicy,
        personalRecordSideNotes: sessionAssignments.personalRecordSideNotes,
        rubricId: rubrics.id,
        rubricVersion: rubrics.version,
        rubricCriteria: rubrics.criteria,
      })
      .from(sessionAssignments)
      .innerJoin(assignments, eq(assignments.id, sessionAssignments.assignmentId))
      .innerJoin(rubrics, eq(rubrics.id, sessionAssignments.rubricId))
      .where(and(...conditions))
      .orderBy(asc(assignments.position))
      .limit(limit);
    const records = rows.map((row) => ({
      assignmentId: row.assignmentId,
      name: row.name,
      instructions: row.instructions,
      durationMinutes: row.durationMinutes,
      transcriptPolicy: row.transcriptPolicy,
      personalRecordSideNotes: row.personalRecordSideNotes,
      rubric: { id: row.rubricId, version: row.rubricVersion, criteria: parseRubricCriteria(row.rubricCriteria) ?? [] },
    }));
    return { ok: true, domain: input.domain, asOf, records, count: records.length };
  }

  if (input.domain === "drafts") {
    const conditions: SQL[] = [eq(changeProposals.orgId, scope.orgId), eq(changeProposals.courseId, scope.courseId)];
    if (input.ids?.length) conditions.push(inArray(changeProposals.id, input.ids));
    if (input.query) conditions.push(ilike(changeProposals.summary, `%${input.query}%`));
    const rows = await db
      .select({
        id: changeProposals.id,
        kind: changeProposals.kind,
        status: changeProposals.status,
        summary: changeProposals.summary,
        createdAt: changeProposals.createdAt,
        decidedAt: changeProposals.decidedAt,
      })
      .from(changeProposals)
      .where(and(...conditions))
      .orderBy(desc(changeProposals.createdAt))
      .limit(limit);
    const records = rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      decidedAt: row.decidedAt?.toISOString() ?? null,
    }));
    return { ok: true, domain: input.domain, asOf, records, count: records.length };
  }

  const conditions: SQL[] = [
    eq(classRollups.orgId, scope.orgId),
    eq(classRollups.courseId, scope.courseId),
    eq(assignments.orgId, scope.orgId),
    eq(assignments.courseId, scope.courseId),
  ];
  if (input.ids?.length) conditions.push(inArray(classRollups.assignmentId, input.ids));
  if (input.query) conditions.push(ilike(assignments.name, `%${input.query}%`));
  const rows = await db
    .select({
      assignmentId: classRollups.assignmentId,
      assignmentName: assignments.name,
      stats: classRollups.stats,
      narrative: classRollups.narrativeDraft,
      computedAt: classRollups.computedAt,
    })
    .from(classRollups)
    .innerJoin(assignments, eq(assignments.id, classRollups.assignmentId))
    .where(and(...conditions))
    .orderBy(desc(classRollups.computedAt))
    .limit(limit);
  const records = rows.map((row) => ({
    ...row,
    narrative: clip(row.narrative, 1200),
    computedAt: row.computedAt.toISOString(),
  }));
  return { ok: true, domain: input.domain, asOf, records, count: records.length };
}

export function professorTools(args: { scope: ProfessorScope; sessionId: string }) {
  const { scope, sessionId } = args;

  const inspect_course = tool({
    description:
      "Read a small, current slice of this course. Pass a domain and optionally exact ids, a title search, and a result limit. Every result is scoped and timestamped.",
    inputSchema: inspectCourseSchema,
    execute: async (input): Promise<InspectCourseOutput> => inspectCourse(scope, input),
  });

  const load_skill = tool({
    description: "Load one allowlisted Atlas workflow by id when its catalog description matches the professor's request.",
    inputSchema: z.object({ skillId: z.enum(["ai-assignment", "course-authoring", "class-insight"]) }),
    execute: async ({ skillId }): Promise<LoadSkillOutput> => {
      const loaded = await loadAtlasSkill(skillId);
      if (!loaded) return { ok: false, error: "That Atlas skill is not available." };
      return { ok: true, skillId, name: loaded.skill.name, instructions: loaded.instructions };
    },
  });

  const draft_ai_assignment = tool({
    description: "Prepare one existing assignment as an AI assignment, including its session contract and rubric.",
    inputSchema: aiAssignmentDraftSchema,
    execute: async (draft): Promise<AiAssignmentProposalOutput> => {
      const [target] = await db
        .select({ id: assignments.id, name: assignments.name })
        .from(assignments)
        .where(and(eq(assignments.orgId, scope.orgId), eq(assignments.courseId, scope.courseId), eq(assignments.id, draft.assignmentId)))
        .limit(1);
      if (!target) return { ok: false, error: "That assignment is not in this course." };

      const usedStandardFrame = !draft.criteria?.length;
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
      if (!roundTrip || roundTrip.type !== "ai_assignment") return { ok: false, error: "The AI assignment draft is invalid." };

      try {
        const proposalId = await db.transaction(async (tx) => {
          await tx.execute(
            sql`select pg_advisory_xact_lock(hashtextextended(${`atlas:ai-assignment:${scope.orgId}:${scope.courseId}:${draft.assignmentId}`}, 0))`
          );
          const [configured] = await tx
            .select({ id: sessionAssignments.id })
            .from(sessionAssignments)
            .where(
              and(
                eq(sessionAssignments.orgId, scope.orgId),
                eq(sessionAssignments.courseId, scope.courseId),
                eq(sessionAssignments.assignmentId, draft.assignmentId)
              )
            )
            .limit(1);
          if (configured) {
            throw new DraftConflict(`${target.name} is already an AI assignment. Use draft_rubric to revise its rubric.`);
          }
          const pending = await tx
            .select({ diff: changeProposals.diff })
            .from(changeProposals)
            .where(
              and(
                eq(changeProposals.orgId, scope.orgId),
                eq(changeProposals.courseId, scope.courseId),
                eq(changeProposals.kind, "assignment"),
                eq(changeProposals.status, "pending")
              )
            );
          if (pending.some((row) => (row.diff as { assignmentId?: string } | null)?.assignmentId === draft.assignmentId)) {
            throw new DraftConflict("A draft for that AI assignment is already open.");
          }

          const [proposal] = await tx
            .insert(changeProposals)
            .values({
              orgId: scope.orgId,
              courseId: scope.courseId,
              authorId: scope.instructorId,
              kind: "assignment",
              status: "pending",
              summary: `AI assignment: ${target.name}`,
              diff: { source: "atlas_harness", assignmentId: draft.assignmentId, note: draft.note ?? null },
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
      } catch (error) {
        if (error instanceof DraftConflict) return { ok: false, error: error.message };
        return { ok: false, error: "Could not store the draft. Nothing changed." };
      }
    },
  });

  const draft_rubric = tool({
    description: "Prepare a rubric revision for an existing AI assignment.",
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
            eq(assignments.orgId, scope.orgId),
            eq(assignments.courseId, scope.courseId),
            eq(rubrics.orgId, scope.orgId),
            eq(rubrics.courseId, scope.courseId),
            eq(sessionAssignments.assignmentId, draft.assignmentId)
          )
        )
        .limit(1);
      if (!target) return { ok: false, error: "That assignment is not an AI assignment yet." };

      const normalized = normalizeRubricDraft(draft);
      if (!normalized.ok) return { ok: false, error: normalized.error };
      const block = buildSessionRubricBlock({ assignmentId: draft.assignmentId, title: draft.title, criteria: normalized.criteria });
      if (!block) return { ok: false, error: "The rubric draft is invalid." };

      try {
        const proposalId = await db.transaction(async (tx) => {
          await tx.execute(
            sql`select pg_advisory_xact_lock(hashtextextended(${`atlas:rubric:${scope.orgId}:${scope.courseId}:${draft.assignmentId}`}, 0))`
          );
          const pending = await tx
            .select({ diff: changeProposals.diff })
            .from(changeProposals)
            .where(
              and(
                eq(changeProposals.orgId, scope.orgId),
                eq(changeProposals.courseId, scope.courseId),
                eq(changeProposals.kind, "rubric"),
                eq(changeProposals.status, "pending")
              )
            );
          if (pending.some((row) => (row.diff as { assignmentId?: string } | null)?.assignmentId === draft.assignmentId)) {
            throw new DraftConflict("A rubric draft for that assignment is already open.");
          }

          const [proposal] = await tx
            .insert(changeProposals)
            .values({
              orgId: scope.orgId,
              courseId: scope.courseId,
              authorId: scope.instructorId,
              kind: "rubric",
              status: "pending",
              summary: `Rubric: ${target.assignmentName} · ${draft.title}`,
              diff: {
                source: "atlas_harness",
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
      } catch (error) {
        if (error instanceof DraftConflict) return { ok: false, error: error.message };
        return { ok: false, error: "Could not store the draft. Nothing changed." };
      }
    },
  });

  const draft_course = tool({
    description: "Prepare up to six modules, assignments, pages, announcements, practice sets, or internal objective links.",
    inputSchema: draftCourseSchema,
    execute: async ({ summary, blocks }): Promise<CourseDraftOutput> => {
      const storedBlocks = blocks.map((block) => {
        const { type, ...data } = block;
        return { type, data };
      });
      if (storedBlocks.some((block) => !parseStoredBlock(block.type, block.data))) {
        return { ok: false, error: "One of the course drafts is invalid." };
      }

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
              diff: { source: "atlas_harness" },
              sessionId,
            })
            .returning({ id: changeProposals.id });
          await tx.insert(proposalBlocks).values(
            storedBlocks.map((block, index) => ({
              orgId: scope.orgId,
              proposalId: proposal.id,
              position: index + 1,
              blockType: block.type,
              schemaVersion: BLOCK_SCHEMA_VERSION,
              data: block.data,
              status: "pending" as const,
            }))
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
        return { ok: false, error: "Could not store the drafts. Nothing changed." };
      }
    },
  });

  return { inspect_course, load_skill, draft_ai_assignment, draft_rubric, draft_course };
}
