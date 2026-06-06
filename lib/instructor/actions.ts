"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, desc, eq, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { assignments, changeProposals, contentAlignments, learningObjectives, modules } from "@/lib/db/schema";
import { isInstructorLike } from "@/lib/auth/session";
import { findEditableCourse } from "@/lib/instructor/workspace";
import {
  hasImportRows,
  importSummary,
  normalizeImportDiff,
  parseCourseImportIntent,
  withReferencedObjectives,
  type ParsedImport,
} from "@/lib/instructor/import-outline";

export async function draftCourseProposal(formData: FormData) {
  const user = await requireInstructorActor();
  const course = await findEditableCourse({ id: user.id, orgId: user.orgId, role: user.role });
  if (!course) {
    throw new Error("No editable course found for this instructor.");
  }

  const intent = String(formData.get("intent") ?? "").trim();
  const kind = normalizeKind(String(formData.get("kind") ?? "module"));

  if (intent.length < 12) {
    throw new Error("Proposal intent is too short.");
  }

  const diff = kind === "import" ? parseCourseImportIntent(intent, course.code) : {
    title: proposalTitle(intent, kind),
    intent,
    courseCode: course.code,
  };
  if (kind === "import" && !hasImportRows(diff)) {
    throw new Error("Outline needs at least one objective, week, or assignment.");
  }

  await db.insert(changeProposals).values({
    orgId: user.orgId,
    courseId: course.id,
    authorId: user.id,
    kind,
    status: "pending",
    summary: kind === "import" ? importSummary(diff) : summarizeIntent(intent),
    diff,
  });

  revalidatePath("/teach");
  redirect("/teach");
}

export async function publishModule(formData: FormData) {
  const user = await requireInstructorActor();
  const course = await findEditableCourse({ id: user.id, orgId: user.orgId, role: user.role });
  if (!course) {
    throw new Error("No editable course found for this instructor.");
  }

  const moduleId = String(formData.get("moduleId") ?? "");
  if (!moduleId) {
    throw new Error("No module selected.");
  }

  await db
    .update(modules)
    .set({ published: true, updatedAt: new Date() })
    .where(and(eq(modules.id, moduleId), eq(modules.orgId, user.orgId), eq(modules.courseId, course.id)));

  revalidatePath("/teach");
  redirect("/teach");
}

export async function publishAssignment(formData: FormData) {
  const user = await requireInstructorActor();
  const course = await findEditableCourse({ id: user.id, orgId: user.orgId, role: user.role });
  if (!course) {
    throw new Error("No editable course found for this instructor.");
  }

  const assignmentId = String(formData.get("assignmentId") ?? "");
  if (!assignmentId) {
    throw new Error("No work selected.");
  }

  await db
    .update(assignments)
    .set({ published: true, updatedAt: new Date() })
    .where(and(eq(assignments.id, assignmentId), eq(assignments.orgId, user.orgId), eq(assignments.courseId, course.id)));

  revalidatePath("/teach");
  revalidatePath("/student");
  redirect("/teach");
}

export async function reviewCourseProposal(formData: FormData) {
  const user = await requireInstructorActor();
  const course = await findEditableCourse({ id: user.id, orgId: user.orgId, role: user.role });
  if (!course) {
    throw new Error("No editable course found for this instructor.");
  }

  const proposalId = String(formData.get("proposalId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const status = decision === "approved" ? "applied" : decision === "rejected" ? "rejected" : null;

  if (!proposalId || !status) {
    throw new Error("Invalid proposal review request.");
  }

  await db.transaction(async (tx) => {
    const [proposal] = await tx
      .select({
        id: changeProposals.id,
        kind: changeProposals.kind,
        summary: changeProposals.summary,
        diff: changeProposals.diff,
      })
      .from(changeProposals)
      .where(
        and(
          eq(changeProposals.id, proposalId),
          eq(changeProposals.orgId, user.orgId),
          eq(changeProposals.courseId, course.id),
          eq(changeProposals.status, "pending")
        )
      )
      .limit(1);

    if (!proposal) return;

    let nextDiff = proposal.diff;

    if (status === "applied" && proposal.kind === "module") {
      const [lastModule] = await tx
        .select({ position: modules.position })
        .from(modules)
        .where(and(eq(modules.orgId, user.orgId), eq(modules.courseId, course.id)))
        .orderBy(desc(modules.position))
        .limit(1);
      const position = (lastModule?.position ?? 0) + 1;
      const objectiveCodes = proposalObjectiveCodes(proposal.diff, proposal.summary);
      const [createdModule] = await tx
        .insert(modules)
        .values({
          orgId: user.orgId,
          courseId: course.id,
          name: moduleNameFromProposal(proposal.diff, proposal.summary),
          summaryMd: proposal.summary,
          position,
          published: false,
        })
        .returning({ id: modules.id });

      const linkedObjectiveCodes = createdModule
        ? await linkObjectives(tx, user.orgId, course.id, createdModule.id, "module", objectiveCodes)
        : [];
      nextDiff = withAppliedItem(proposal.diff, "appliedModuleId", createdModule?.id, linkedObjectiveCodes);
    }

    if (status === "applied" && proposal.kind === "assignment") {
      const objectiveCodes = proposalObjectiveCodes(proposal.diff, proposal.summary);
      const [createdAssignment] = await tx
        .insert(assignments)
        .values({
          orgId: user.orgId,
          courseId: course.id,
          name: assignmentNameFromProposal(proposal.diff, proposal.summary),
          descriptionMd: assignmentDescriptionFromProposal(proposal.diff, proposal.summary),
          pointsPossible: numberFromDiff(proposal.diff, "pointsPossible") ?? 100,
          published: false,
        })
        .returning({ id: assignments.id });

      const linkedObjectiveCodes = createdAssignment
        ? await linkObjectives(tx, user.orgId, course.id, createdAssignment.id, "assignment", objectiveCodes)
        : [];
      nextDiff = withAppliedItem(proposal.diff, "appliedAssignmentId", createdAssignment?.id, linkedObjectiveCodes);
    }

    if (status === "applied" && proposal.kind === "objective") {
      const existingObjectives = await tx
        .select({ code: learningObjectives.code })
        .from(learningObjectives)
        .where(and(eq(learningObjectives.orgId, user.orgId), eq(learningObjectives.courseId, course.id)));
      const existingCodes = existingObjectives.map((objective) => objective.code);
      const requestedCode = proposalObjectiveCodes(proposal.diff, proposal.summary)[0];
      const code = requestedCode && !existingCodes.includes(requestedCode) ? requestedCode : nextObjectiveCode(existingCodes);
      const [createdObjective] = await tx
        .insert(learningObjectives)
        .values({
          orgId: user.orgId,
          courseId: course.id,
          code,
          description: objectiveDescriptionFromProposal(proposal.diff, proposal.summary),
          bloomLevel: "apply",
          assessmentWeight: 0.1,
          createdByAgent: true,
        })
        .returning({ id: learningObjectives.id, code: learningObjectives.code });

      nextDiff = {
        ...(proposal.diff && typeof proposal.diff === "object" ? (proposal.diff as Record<string, unknown>) : {}),
        appliedObjectiveId: createdObjective?.id,
        objectiveCodes: createdObjective ? [createdObjective.code] : [],
      };
    }

    if (status === "applied" && proposal.kind === "import") {
      const imported = withReferencedObjectives(normalizeImportDiff(proposal.diff, proposal.summary));
      const objectiveCodes = await ensureObjectives(tx, user.orgId, course.id, imported.objectives);
      const [lastModule] = await tx
        .select({ position: modules.position })
        .from(modules)
        .where(and(eq(modules.orgId, user.orgId), eq(modules.courseId, course.id)))
        .orderBy(desc(modules.position))
        .limit(1);
      let nextPosition = lastModule?.position ?? 0;
      const appliedModuleIds: string[] = [];
      const appliedAssignmentIds: string[] = [];

      for (const moduleDraft of imported.modules) {
        nextPosition += 1;
        const [createdModule] = await tx
          .insert(modules)
          .values({
            orgId: user.orgId,
            courseId: course.id,
            name: moduleDraft.name,
            summaryMd: moduleDraft.summaryMd,
            position: nextPosition,
            published: false,
          })
          .returning({ id: modules.id });

        if (createdModule) {
          appliedModuleIds.push(createdModule.id);
          await linkObjectives(tx, user.orgId, course.id, createdModule.id, "module", moduleDraft.objectiveCodes);
        }
      }

      for (const assignment of imported.assignments) {
        const [createdAssignment] = await tx
          .insert(assignments)
          .values({
            orgId: user.orgId,
            courseId: course.id,
            name: assignment.name,
            descriptionMd: assignment.descriptionMd,
            pointsPossible: assignment.pointsPossible,
            published: false,
          })
          .returning({ id: assignments.id });

        if (createdAssignment) {
          appliedAssignmentIds.push(createdAssignment.id);
          await linkObjectives(tx, user.orgId, course.id, createdAssignment.id, "assignment", assignment.objectiveCodes);
        }
      }

      nextDiff = {
        ...(proposal.diff && typeof proposal.diff === "object" ? (proposal.diff as Record<string, unknown>) : {}),
        appliedModuleIds,
        appliedAssignmentIds,
        objectiveCodes,
      };
    }

    await tx
      .update(changeProposals)
      .set({ status, decidedAt: new Date(), diff: nextDiff })
      .where(eq(changeProposals.id, proposal.id));
  });

  revalidatePath("/teach");
  redirect("/teach");
}

async function requireInstructorActor() {
  const session = await auth();
  const user = session?.user;

  if (!user?.id || !user.orgId || !isInstructorLike(user.role)) {
    redirect("/sign-in");
  }

  return { id: user.id, orgId: user.orgId, role: user.role, email: user.email };
}

function normalizeKind(value: string): "course" | "syllabus" | "module" | "assignment" | "quiz" | "rubric" | "objective" | "alignment" | "import" {
  const allowed = ["course", "syllabus", "module", "assignment", "quiz", "rubric", "objective", "alignment", "import"] as const;
  return allowed.find((kind) => kind === value) ?? "module";
}

function summarizeIntent(intent: string) {
  const cleaned = intent.replace(/\s+/g, " ");
  const clipped = cleaned.length > 150 ? `${cleaned.slice(0, 147)}...` : cleaned;
  return clipped;
}

function proposalTitle(intent: string, kind: string) {
  if (kind === "module") return moduleNameFromProposal({ intent }, intent);
  const firstSentence = intent.split(/[.!?]/)[0]?.trim();
  if (firstSentence && firstSentence.length <= 80) return firstSentence;
  return `Draft ${kind}`;
}

function proposalObjectiveCodes(diff: unknown, summary: string) {
  const text = `${summary} ${diffText(diff)}`;
  return Array.from(new Set(text.match(/\bLO\d+\b/gi)?.map((code) => code.toUpperCase()) ?? []));
}

function moduleNameFromProposal(diff: unknown, summary: string) {
  const explicit = valueFromDiff(diff, "name") || valueFromDiff(diff, "title");
  if (explicit && explicit.length <= 160) return explicit;
  const text = `${summary} ${diffText(diff)}`;
  if (/\bLO2\b/i.test(text) && /\bLO4\b/i.test(text)) return "Inference and uncertainty checkpoint";
  if (/\bLO2\b/i.test(text)) return "Hypothesis testing practice";
  if (/\bLO4\b/i.test(text)) return "Communicating uncertainty";
  const firstSentence = summary.split(/[.!?]/)[0]?.trim();
  return firstSentence && firstSentence.length <= 72 ? firstSentence : "Draft module";
}

function assignmentNameFromProposal(diff: unknown, summary: string) {
  const explicit = valueFromDiff(diff, "name") || valueFromDiff(diff, "title");
  if (explicit && explicit.length <= 200) return explicit;
  const text = `${summary} ${diffText(diff)}`;
  if (/\bLO2\b/i.test(text)) return "Inference practice check";
  if (/\bLO3\b/i.test(text)) return "Regression evidence check";
  if (/\bLO4\b/i.test(text)) return "Uncertainty memo";
  const firstSentence = summary.split(/[.!?]/)[0]?.trim();
  return firstSentence && firstSentence.length <= 72 ? firstSentence : "Draft assignment";
}

function assignmentDescriptionFromProposal(diff: unknown, summary: string) {
  return valueFromDiff(diff, "descriptionMd") || valueFromDiff(diff, "intent") || summary;
}

function objectiveDescriptionFromProposal(diff: unknown, summary: string) {
  const title = valueFromDiff(diff, "title");
  const intent = valueFromDiff(diff, "intent");
  return (intent || title || summary).replace(/\s+/g, " ").slice(0, 280);
}

function nextObjectiveCode(existingCodes: string[]) {
  const highest = existingCodes.reduce((max, code) => {
    const match = code.match(/^LO(\d+)$/i);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `LO${highest + 1}`;
}

async function ensureObjectives(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  orgId: string,
  courseId: string,
  drafts: ParsedImport["objectives"]
) {
  if (drafts.length === 0) return [];

  const existing = await tx
    .select({ code: learningObjectives.code })
    .from(learningObjectives)
    .where(and(eq(learningObjectives.orgId, orgId), eq(learningObjectives.courseId, courseId)));
  const existingCodes = new Set(existing.map((objective) => objective.code));
  const createdCodes: string[] = [];

  for (const draft of drafts) {
    if (existingCodes.has(draft.code)) {
      createdCodes.push(draft.code);
      continue;
    }

    await tx.insert(learningObjectives).values({
      orgId,
      courseId,
      code: draft.code,
      description: draft.description,
      bloomLevel: "apply",
      assessmentWeight: draft.assessmentWeight,
      createdByAgent: true,
    });
    existingCodes.add(draft.code);
    createdCodes.push(draft.code);
  }

  return Array.from(new Set(createdCodes));
}

async function linkObjectives(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  orgId: string,
  courseId: string,
  itemId: string,
  itemType: "module" | "assignment",
  objectiveCodes: string[]
) {
  if (objectiveCodes.length === 0) return [];

  const objectives = await tx
    .select({ id: learningObjectives.id, code: learningObjectives.code })
    .from(learningObjectives)
    .where(and(eq(learningObjectives.orgId, orgId), eq(learningObjectives.courseId, courseId), inArray(learningObjectives.code, objectiveCodes)));

  if (objectives.length > 0) {
    await tx.insert(contentAlignments).values(
      objectives.map((objective) => ({
        orgId,
        objectiveId: objective.id,
        itemType,
        itemId,
        weight: 1,
        createdByAgent: true,
      }))
    );
  }

  return objectives.map((objective) => objective.code);
}

function withAppliedItem(diff: unknown, key: "appliedModuleId" | "appliedAssignmentId", itemId?: string, objectiveCodes: string[] = []) {
  const record = diff && typeof diff === "object" ? (diff as Record<string, unknown>) : {};
  return {
    ...record,
    [key]: itemId,
    objectiveCodes,
  };
}

function valueFromDiff(diff: unknown, key: string) {
  if (!diff || typeof diff !== "object") return "";
  const value = (diff as Record<string, unknown>)[key];
  return typeof value === "string" ? value.trim() : "";
}

function numberFromDiff(diff: unknown, key: string) {
  if (!diff || typeof diff !== "object") return null;
  const value = (diff as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function diffText(diff: unknown) {
  if (!diff || typeof diff !== "object") return "";
  const record = diff as Record<string, unknown>;
  return [record.title, record.intent, record.summary]
    .filter((value): value is string => typeof value === "string")
    .join(" ");
}
