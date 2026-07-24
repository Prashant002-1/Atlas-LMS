import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  announcements,
  assignments,
  changeProposals,
  contentAlignments,
  learningObjectives,
  modules,
  pages,
  practiceSets,
  proposalBlocks,
  rubrics,
  sessionAssignments,
  terms,
  courses,
} from "@/lib/db/schema";
import { parseStoredBlock, type Block } from "@/lib/agent/blocks";
import { rubricCriteriaSchema } from "@/lib/agent/session-parts";

/**
 * Apply, the one door between a draft and the live course.
 *
 * A proposal's blocks were validated when the agent emitted them; applying
 * re-validates each row, writes the corresponding course records inside one
 * transaction, links objective alignments, and stamps the blocks with what they
 * created. Dismiss is the same door swinging the other way.
 */

export type AppliedRecord = {
  blockId: string;
  itemType: "module" | "assignment" | "page" | "quiz";
  itemId: string;
  title: string;
};

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function objectiveIdsForCodes(tx: Tx, orgId: string, courseId: string, codes: string[]): Promise<Map<string, string>> {
  if (codes.length === 0) return new Map();
  const rows = await tx
    .select({ id: learningObjectives.id, code: learningObjectives.code })
    .from(learningObjectives)
    .where(and(eq(learningObjectives.orgId, orgId), eq(learningObjectives.courseId, courseId)));
  const map = new Map<string, string>();
  for (const row of rows) {
    if (codes.includes(row.code)) map.set(row.code, row.id);
  }
  return map;
}

async function alignItem(
  tx: Tx,
  orgId: string,
  courseId: string,
  itemType: "module" | "assignment" | "page" | "quiz",
  itemId: string,
  codes: string[] | undefined
) {
  if (!codes?.length) return;
  const byCode = await objectiveIdsForCodes(tx, orgId, courseId, codes);
  const values = codes
    .filter((code) => byCode.has(code))
    .map((code) => ({
      orgId,
      objectiveId: byCode.get(code)!,
      itemType,
      itemId,
      weight: 1,
      createdByAgent: true,
    }));
  if (values.length) await tx.insert(contentAlignments).values(values);
}

/** Week N → due date resolved against the course's term calendar (end of that week). */
async function weekToDate(tx: Tx, courseId: string, week: number | undefined): Promise<Date | null> {
  if (!week) return null;
  const [row] = await tx
    .select({ startsAt: terms.startsAt })
    .from(courses)
    .innerJoin(terms, eq(courses.termId, terms.id))
    .where(eq(courses.id, courseId))
    .limit(1);
  if (!row) return null;
  const due = new Date(row.startsAt);
  due.setUTCDate(due.getUTCDate() + week * 7 - 1);
  due.setUTCHours(23, 59, 0, 0);
  return due;
}

async function applyBlock(
  tx: Tx,
  args: { orgId: string; courseId: string; authorId: string; planningSessionId: string | null },
  block: Block
): Promise<{ itemType: "module" | "assignment" | "page" | "quiz"; itemId: string; title: string } | null> {
  const { orgId, courseId } = args;

  if (block.type === "objective") {
    const existing = await tx
      .select({ code: learningObjectives.code })
      .from(learningObjectives)
      .where(and(eq(learningObjectives.orgId, orgId), eq(learningObjectives.courseId, courseId), eq(learningObjectives.code, block.code)))
      .limit(1);
    if (existing.length === 0) {
      await tx.insert(learningObjectives).values({
        orgId,
        courseId,
        code: block.code,
        description: block.description,
        bloomLevel: block.bloomLevel,
        assessmentWeight: block.assessmentWeight,
        createdByAgent: true,
      });
    }
    return null; // objectives are not "items"; nothing to link
  }

  if (block.type === "module") {
    const [last] = await tx
      .select({ position: modules.position })
      .from(modules)
      .where(and(eq(modules.orgId, orgId), eq(modules.courseId, courseId)))
      .orderBy(desc(modules.position))
      .limit(1);
    const [created] = await tx
      .insert(modules)
      .values({
        orgId,
        courseId,
        name: block.name,
        summaryMd: block.summaryMd,
        position: block.week ?? (last?.position ?? 0) + 1,
        published: false,
      })
      .returning({ id: modules.id });
    await alignItem(tx, orgId, courseId, "module", created.id, block.objectiveCodes);
    return { itemType: "module", itemId: created.id, title: block.name };
  }

  if (block.type === "assignment") {
    const [last] = await tx
      .select({ position: assignments.position })
      .from(assignments)
      .where(and(eq(assignments.orgId, orgId), eq(assignments.courseId, courseId)))
      .orderBy(desc(assignments.position))
      .limit(1);
    const dueAt = await weekToDate(tx, courseId, block.dueWeek);
    const [created] = await tx
      .insert(assignments)
      .values({
        orgId,
        courseId,
        name: block.name,
        descriptionMd: block.descriptionMd,
        pointsPossible: block.pointsPossible,
        dueAt,
        position: (last?.position ?? 0) + 1,
        published: false,
      })
      .returning({ id: assignments.id });
    await alignItem(tx, orgId, courseId, "assignment", created.id, block.objectiveCodes);
    return { itemType: "assignment", itemId: created.id, title: block.name };
  }

  if (block.type === "page") {
    const slugBase = block.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
    const existing = await tx
      .select({ slug: pages.slug })
      .from(pages)
      .where(and(eq(pages.orgId, orgId), eq(pages.courseId, courseId)));
    const taken = new Set(existing.map((p) => p.slug));
    let slug = slugBase || "page";
    for (let i = 2; taken.has(slug); i += 1) slug = `${slugBase}-${i}`;
    const [created] = await tx
      .insert(pages)
      .values({ orgId, courseId, slug, title: block.title, bodyMd: block.bodyMd, published: false })
      .returning({ id: pages.id });
    await alignItem(tx, orgId, courseId, "page", created.id, block.objectiveCodes);
    return { itemType: "page", itemId: created.id, title: block.title };
  }

  if (block.type === "announcement") {
    await tx.insert(announcements).values({
      orgId,
      courseId,
      authorId: args.authorId,
      title: block.title,
      messageMd: block.messageMd,
      postedAt: new Date(),
      published: true, // applying a note IS posting it, the review was the approval
    });
    return null;
  }

  if (block.type === "practice_set") {
    const [last] = await tx
      .select({ position: practiceSets.position })
      .from(practiceSets)
      .where(and(eq(practiceSets.orgId, orgId), eq(practiceSets.courseId, courseId)))
      .orderBy(desc(practiceSets.position))
      .limit(1);
    const [created] = await tx
      .insert(practiceSets)
      .values({
        orgId,
        courseId,
        title: block.title,
        base: block.base,
        questions: block.questions,
        position: (last?.position ?? 0) + 1,
        published: true, // practice goes straight to students once approved
        createdByAgent: true,
      })
      .returning({ id: practiceSets.id });
    await alignItem(tx, orgId, courseId, "quiz", created.id, block.objectiveCodes);
    return { itemType: "quiz", itemId: created.id, title: block.title };
  }

  if (block.type === "ai_assignment") {
    // Create the AI assignment: the next rubric version and the contract row
    // in one pass, targeting an existing assignment. If the assignment is
    // gone or already runs as an AI assignment, nothing is written.
    const [target] = await tx
      .select({ assignmentId: assignments.id, assignmentName: assignments.name })
      .from(assignments)
      .where(and(eq(assignments.orgId, orgId), eq(assignments.courseId, courseId), eq(assignments.id, block.assignmentId)))
      .limit(1);
    if (!target) return null;

    const [existing] = await tx
      .select({ id: sessionAssignments.id })
      .from(sessionAssignments)
      .where(and(eq(sessionAssignments.orgId, orgId), eq(sessionAssignments.assignmentId, block.assignmentId)))
      .limit(1);
    if (existing) return null;

    const criteria = rubricCriteriaSchema.safeParse(block.criteria);
    if (!criteria.success) return null;

    const [{ maxVersion }] = await tx
      .select({ maxVersion: sql<number>`coalesce(max(${rubrics.version}), 0)` })
      .from(rubrics)
      .where(and(eq(rubrics.orgId, orgId), eq(rubrics.courseId, courseId)));
    const [rubric] = await tx
      .insert(rubrics)
      .values({ orgId, courseId, version: Number(maxVersion) + 1, criteria: criteria.data })
      .returning({ id: rubrics.id });

    await tx.insert(sessionAssignments).values({
      orgId,
      courseId,
      assignmentId: block.assignmentId,
      rubricId: rubric.id,
      instructions: block.instructions,
      durationMinutes: block.durationMinutes,
      personalRecordSideNotes: block.personalRecordSideNotes,
      planningSessionId: args.planningSessionId,
    });

    return { itemType: "assignment", itemId: block.assignmentId, title: `${block.title} (${target.assignmentName})` };
  }

  if (block.type === "session_rubric") {
    // The v0 rubric, natively: a NEW rubric version for the course, repointed
    // on the target work session. Grades already given stay pinned to the
    // version that graded them; versioning is always honest on this path.
    const [target] = await tx
      .select({ assignmentId: sessionAssignments.assignmentId, assignmentName: assignments.name })
      .from(sessionAssignments)
      .innerJoin(assignments, eq(assignments.id, sessionAssignments.assignmentId))
      .where(
        and(
          eq(sessionAssignments.orgId, orgId),
          eq(sessionAssignments.courseId, courseId),
          eq(sessionAssignments.assignmentId, block.assignmentId)
        )
      )
      .limit(1);
    if (!target) return null; // Not a work session in this course; nothing to write.

    const criteria = rubricCriteriaSchema.safeParse(block.criteria);
    if (!criteria.success) return null;

    const [{ maxVersion }] = await tx
      .select({ maxVersion: sql<number>`coalesce(max(${rubrics.version}), 0)` })
      .from(rubrics)
      .where(and(eq(rubrics.orgId, orgId), eq(rubrics.courseId, courseId)));
    const [created] = await tx
      .insert(rubrics)
      .values({ orgId, courseId, version: Number(maxVersion) + 1, criteria: criteria.data })
      .returning({ id: rubrics.id });

    await tx
      .update(sessionAssignments)
      .set({
        rubricId: created.id,
        ...(args.planningSessionId ? { planningSessionId: args.planningSessionId } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(sessionAssignments.orgId, orgId), eq(sessionAssignments.assignmentId, block.assignmentId)));

    return { itemType: "assignment", itemId: block.assignmentId, title: `${block.title} (${target.assignmentName})` };
  }

  if (block.type === "rubric") {
    // Rubrics persist as reference pages until grading owns them natively.
    const body = block.criteria
      .map(
        (c) =>
          `## ${c.name} (${Math.round(c.weight * 100)}%)\n${c.levels.map((l) => `- **${l.label}**, ${l.description}`).join("\n")}`
      )
      .join("\n\n");
    const [created] = await tx
      .insert(pages)
      .values({
        orgId,
        courseId,
        slug: `rubric-${Date.now().toString(36)}`,
        title: block.title,
        bodyMd: body,
        published: false,
      })
      .returning({ id: pages.id });
    return { itemType: "page", itemId: created.id, title: block.title };
  }

  return null;
}

export async function loadProposalBlocks(orgId: string, proposalId: string) {
  const rows = await db
    .select()
    .from(proposalBlocks)
    .where(and(eq(proposalBlocks.orgId, orgId), eq(proposalBlocks.proposalId, proposalId)))
    .orderBy(asc(proposalBlocks.position));
  return rows.map((row) => ({ row, block: parseStoredBlock(row.blockType, row.data) }));
}

/** Apply every pending block on a proposal. Objectives first, so same-run alignments resolve. */
export async function applyProposal(args: {
  orgId: string;
  courseId: string;
  userId: string;
  proposalId: string;
}): Promise<AppliedRecord[]> {
  const applied: AppliedRecord[] = [];

  await db.transaction(async (tx) => {
    const [proposal] = await tx
      .select({ sessionId: changeProposals.sessionId, status: changeProposals.status })
      .from(changeProposals)
      .where(
        and(
          eq(changeProposals.id, args.proposalId),
          eq(changeProposals.orgId, args.orgId),
          eq(changeProposals.courseId, args.courseId)
        )
      )
      .limit(1);
    if (!proposal || proposal.status !== "pending") {
      throw new Error("Draft unavailable.");
    }

    const blocks = await tx
      .select()
      .from(proposalBlocks)
      .where(
        and(
          eq(proposalBlocks.orgId, args.orgId),
          eq(proposalBlocks.proposalId, args.proposalId),
          eq(proposalBlocks.status, "pending")
        )
      )
      .orderBy(asc(proposalBlocks.position));

    const typed = blocks
      .map((row) => ({ row, block: parseStoredBlock(row.blockType, row.data) }))
      .filter((entry): entry is { row: typeof blocks[number]; block: Block } => entry.block !== null);

    const ordered = [
      ...typed.filter((e) => e.block.type === "objective"),
      ...typed.filter((e) => e.block.type !== "objective"),
    ];

    for (const { row, block } of ordered) {
      const created = await applyBlock(
        tx,
        { orgId: args.orgId, courseId: args.courseId, authorId: args.userId, planningSessionId: proposal.sessionId },
        block
      );
      await tx
        .update(proposalBlocks)
        .set({
          status: "applied",
          appliedItemType: created && created.itemType !== "quiz" ? created.itemType : created ? "quiz" : null,
          appliedItemId: created?.itemId ?? null,
        })
        .where(eq(proposalBlocks.id, row.id));
      if (created) applied.push({ blockId: row.id, ...created });
    }

    await tx
      .update(changeProposals)
      .set({ status: "applied", decidedAt: new Date() })
      .where(and(eq(changeProposals.id, args.proposalId), eq(changeProposals.orgId, args.orgId)));
  });

  return applied;
}

export async function dismissProposal(args: { orgId: string; proposalId: string }): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(proposalBlocks)
      .set({ status: "rejected" })
      .where(
        and(
          eq(proposalBlocks.orgId, args.orgId),
          eq(proposalBlocks.proposalId, args.proposalId),
          eq(proposalBlocks.status, "pending")
        )
      );
    await tx
      .update(changeProposals)
      .set({ status: "rejected", decidedAt: new Date() })
      .where(and(eq(changeProposals.id, args.proposalId), eq(changeProposals.orgId, args.orgId)));
  });
}
