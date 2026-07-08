"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  changeProposals,
  classRollups,
  journeyReports,
  learningObjectives,
  proposalBlocks,
  rubrics,
  sessionAssignments,
  sessionSubmissions,
  submissions,
  users,
} from "@/lib/db/schema";
import { isInstructorLike } from "@/lib/auth/session";
import { findEditableCourse } from "@/lib/instructor/workspace";
import { loadSessionAssignmentBundle } from "@/lib/agent/session-store";
import { gradeLetterFor, runGradingForSubmission } from "@/lib/agent/grading";
import { recomputeClassRollup } from "@/lib/agent/rollup";
import { resolveModelForOrg } from "@/lib/agent/keys";
import { BLOCK_SCHEMA_VERSION } from "@/lib/agent/blocks";
import {
  buildPracticeSetBlock,
  draftPracticeSetBlock,
  practiceSetBlockData,
  type CourseObjectiveRef,
} from "@/lib/agent/practice-proposal";
import { parseRubricCriteria, rescaleCriterionToWeight } from "@/lib/agent/session-parts";
import { renderFinalArtifactBody } from "@/lib/agent/transcript";
import { pricingArtifactSchema } from "@/lib/agent/session-parts";
import { classRollupStatsSchema } from "@/lib/agent/rollup";

/**
 * Professor session actions, every mutation the cockpit can make. Shared
 * posture:
 *
 *   - Same scoping as every teach action: the signed-in instructor, the
 *     course in view, and an explicit row check that the target belongs to
 *     that course. Fails closed.
 *   - Finalize is the ONLY path that writes a session grade to the gradebook,
 *     and it stamps who and when (AI drafts, the educator publishes).
 *   - Proposals go through the existing changeProposals gate; nothing here
 *     writes course records directly.
 */

async function requireInstructorActor() {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || !user.orgId || !isInstructorLike(user.role)) {
    redirect("/sign-in");
  }
  return { id: user.id, orgId: user.orgId, role: user.role };
}

async function requireCourse(actor: { id: string; orgId: string; role: "superadmin" | "admin" | "instructor" | "ta" | "student" }) {
  const course = await findEditableCourse({ id: actor.id, orgId: actor.orgId, role: actor.role });
  if (!course) {
    throw new Error("No editable course found for this instructor.");
  }
  return course;
}

function revalidateCockpit(assignmentId: string, studentId?: string) {
  revalidatePath("/teach/atlas");
  revalidatePath(`/teach/atlas/${assignmentId}`);
  revalidatePath("/teach");
  revalidatePath(`/teach/work/${assignmentId}`);
  revalidatePath("/student");
  revalidatePath(`/student/session/${assignmentId}`);
  revalidatePath(`/student/work/${assignmentId}`);
  if (studentId) revalidatePath(`/teach/student/${studentId}`);
}

/* ── finalize: draft -> final -> gradebook ──────────────────── */

/**
 * Publish a draft journey report as the grade of record, in one transaction:
 * the report flips to final with the publish audit, the frozen submission is
 * marked graded, and the classic gradebook row gets the report's score so
 * every existing surface sees it without knowing about sessions.
 */
export async function finalizeJourneyReport(formData: FormData) {
  const actor = await requireInstructorActor();
  const course = await requireCourse(actor);
  const reportId = String(formData.get("reportId") ?? "");
  if (!reportId) {
    throw new Error("No report selected.");
  }

  const [row] = await db
    .select({ report: journeyReports, submission: sessionSubmissions, studentName: users.name })
    .from(journeyReports)
    .innerJoin(sessionSubmissions, eq(sessionSubmissions.id, journeyReports.submissionId))
    .leftJoin(users, eq(users.id, journeyReports.userId))
    .where(
      and(eq(journeyReports.id, reportId), eq(journeyReports.orgId, actor.orgId), eq(journeyReports.courseId, course.id))
    )
    .limit(1);
  if (!row) {
    throw new Error("Report unavailable.");
  }
  if (row.report.status === "final") {
    throw new Error("This report is already finalized.");
  }

  const now = new Date();
  const score = row.report.overallScore;
  const grade = gradeLetterFor(score);
  const artifact = pricingArtifactSchema.safeParse(row.submission.finalArtifact);
  const fallbackBody = renderFinalArtifactBody(artifact.success ? artifact.data : null, row.studentName ?? "Student");

  await db.transaction(async (tx) => {
    await tx
      .update(journeyReports)
      .set({ status: "final", finalizedAt: now, finalizedById: actor.id, updatedAt: now })
      .where(and(eq(journeyReports.id, row.report.id), eq(journeyReports.orgId, actor.orgId)));

    await tx
      .update(sessionSubmissions)
      .set({ status: "graded" })
      .where(and(eq(sessionSubmissions.id, row.submission.id), eq(sessionSubmissions.orgId, actor.orgId)));

    const [gradebookRow] = await tx
      .select({ assignmentId: submissions.assignmentId, body: submissions.body })
      .from(submissions)
      .where(
        and(
          eq(submissions.orgId, actor.orgId),
          eq(submissions.assignmentId, row.report.assignmentId),
          eq(submissions.userId, row.report.userId)
        )
      )
      .limit(1);

    if (gradebookRow) {
      await tx
        .update(submissions)
        .set({
          score,
          grade,
          gradedAt: now,
          missing: false,
          workflowState: "graded",
          submissionType: "session",
          body: gradebookRow.body ?? fallbackBody,
        })
        .where(
          and(
            eq(submissions.orgId, actor.orgId),
            eq(submissions.assignmentId, row.report.assignmentId),
            eq(submissions.userId, row.report.userId)
          )
        );
    } else {
      await tx.insert(submissions).values({
        orgId: actor.orgId,
        assignmentId: row.report.assignmentId,
        courseId: row.report.courseId,
        userId: row.report.userId,
        submittedAt: row.submission.submittedAt,
        gradedAt: now,
        score,
        grade,
        missing: false,
        workflowState: "graded",
        submissionType: "session",
        body: fallbackBody,
      });
    }
  });

  revalidateCockpit(row.report.assignmentId, row.report.userId);
  revalidatePath(`/teach/atlas/journey/${row.submission.id}`);
  redirect(`/teach/atlas/journey/${row.submission.id}`);
}

/* ── regrade: rerun the pipeline on a draft ─────────────────── */

/**
 * Run the rubric again on one submission. Draft reports only: a finalized
 * report is the professor's published record and stays put (reopen is a
 * later, explicit affordance; `npm run regrade -- --submission` covers dev).
 */
export async function regradeJourneyReport(formData: FormData) {
  const actor = await requireInstructorActor();
  const course = await requireCourse(actor);
  const submissionId = String(formData.get("submissionId") ?? "");
  if (!submissionId) {
    throw new Error("No submission selected.");
  }

  const [submission] = await db
    .select({ id: sessionSubmissions.id, courseId: sessionSubmissions.courseId, assignmentId: sessionSubmissions.assignmentId })
    .from(sessionSubmissions)
    .where(and(eq(sessionSubmissions.orgId, actor.orgId), eq(sessionSubmissions.id, submissionId)))
    .limit(1);
  if (!submission || submission.courseId !== course.id) {
    throw new Error("Submission unavailable.");
  }

  const [existing] = await db
    .select({ status: journeyReports.status })
    .from(journeyReports)
    .where(and(eq(journeyReports.orgId, actor.orgId), eq(journeyReports.submissionId, submissionId)))
    .limit(1);
  if (existing && existing.status === "final") {
    throw new Error("This report is finalized and stays the record; regrade is for drafts.");
  }

  const resolved = await resolveModelForOrg(actor.orgId);
  if (!resolved) {
    throw new Error("No model key is configured for this organization. Connect one in Settings.");
  }

  await runGradingForSubmission({
    orgId: actor.orgId,
    submissionId,
    model: resolved.model,
    graderLabel: `${resolved.provider}:${resolved.modelId}`,
    force: true,
  });

  revalidateCockpit(submission.assignmentId);
  revalidatePath(`/teach/atlas/journey/${submissionId}`);
  redirect(`/teach/atlas/journey/${submissionId}`);
}

/* ── class insight ──────────────────────────────────────────── */

/** Recompute the stored rollup for one assignment, explicitly. */
export async function refreshClassRollup(formData: FormData) {
  const actor = await requireInstructorActor();
  const course = await requireCourse(actor);
  const assignmentId = String(formData.get("assignmentId") ?? "");
  const bundle = assignmentId ? await loadSessionAssignmentBundle(actor.orgId, assignmentId) : null;
  if (!bundle || bundle.assignment.courseId !== course.id) {
    throw new Error("Session assignment unavailable.");
  }

  const resolved = await resolveModelForOrg(actor.orgId);
  await recomputeClassRollup({
    orgId: actor.orgId,
    courseId: course.id,
    assignmentId,
    narrator: resolved?.model,
  });

  revalidatePath(`/teach/atlas/${assignmentId}`);
  revalidatePath("/teach/atlas");
  redirect(`/teach/atlas/${assignmentId}`);
}

/**
 * Draft a practice set from the class record and park it behind the existing
 * approve gate. Prefers the stored rollup recommendation (deterministic);
 * falls back to a model draft grounded on the rollup stats. The payload must
 * round-trip the SAME block schema applyProposal validates, so an approved
 * draft can never fail to apply.
 */
export async function proposePracticeSet(formData: FormData) {
  const actor = await requireInstructorActor();
  const course = await requireCourse(actor);
  const assignmentId = String(formData.get("assignmentId") ?? "");
  const bundle = assignmentId ? await loadSessionAssignmentBundle(actor.orgId, assignmentId) : null;
  if (!bundle || bundle.assignment.courseId !== course.id) {
    throw new Error("Session assignment unavailable.");
  }

  // One pending practice-set draft per assignment; Review decides first.
  const pendingRows = await db
    .select({ id: changeProposals.id, diff: changeProposals.diff })
    .from(changeProposals)
    .where(
      and(
        eq(changeProposals.orgId, actor.orgId),
        eq(changeProposals.courseId, course.id),
        eq(changeProposals.kind, "quiz"),
        eq(changeProposals.status, "pending")
      )
    );
  const alreadyPending = pendingRows.some((row) => {
    const diff = row.diff as { assignmentId?: string } | null;
    return diff?.assignmentId === assignmentId;
  });
  if (alreadyPending) {
    redirect("/teach/review");
  }

  const [rollupRow] = await db
    .select()
    .from(classRollups)
    .where(
      and(
        eq(classRollups.orgId, actor.orgId),
        eq(classRollups.courseId, course.id),
        eq(classRollups.assignmentId, assignmentId)
      )
    )
    .limit(1);
  if (!rollupRow) {
    throw new Error("Compute the class insight first; the practice set is drafted from it.");
  }

  const objectiveRows = await db
    .select({ code: learningObjectives.code, description: learningObjectives.description })
    .from(learningObjectives)
    .where(and(eq(learningObjectives.orgId, actor.orgId), eq(learningObjectives.courseId, course.id)));
  const objectives: CourseObjectiveRef[] = objectiveRows.map((row) => ({ code: row.code, description: row.description }));

  let block = buildPracticeSetBlock(rollupRow.recommendedPracticeSet, objectives);
  if (!block) {
    const stats = classRollupStatsSchema.safeParse(rollupRow.stats);
    const resolved = await resolveModelForOrg(actor.orgId);
    if (!stats.success || !resolved) {
      throw new Error("Nothing to draft from: no stored recommendation and no model key to draft with.");
    }
    block = await draftPracticeSetBlock({
      model: resolved.model,
      stats: stats.data,
      objectives,
      assignmentName: bundle.assignment.name,
    });
  }
  if (!block) {
    throw new Error("Could not draft a practice set that passes the block contract.");
  }

  const weakest = describeWeakest(rollupRow.stats);
  await db.transaction(async (tx) => {
    const [proposal] = await tx
      .insert(changeProposals)
      .values({
        orgId: actor.orgId,
        courseId: course.id,
        authorId: actor.id,
        kind: "quiz",
        status: "pending",
        summary: `Practice set drafted from the class record for ${bundle.assignment.name}${weakest ? `, targeting ${weakest}` : ""}.`,
        diff: { source: "class_rollup", assignmentId, rollupComputedAt: rollupRow.computedAt.toISOString() },
        sessionId: null,
      })
      .returning({ id: changeProposals.id });

    await tx.insert(proposalBlocks).values({
      orgId: actor.orgId,
      proposalId: proposal.id,
      position: 1,
      blockType: "practice_set",
      schemaVersion: BLOCK_SCHEMA_VERSION,
      data: practiceSetBlockData(block),
      status: "pending",
    });
  });

  revalidatePath("/teach/review");
  revalidatePath(`/teach/atlas/${assignmentId}`);
  redirect("/teach/review");
}

function describeWeakest(stats: unknown): string | null {
  const parsed = classRollupStatsSchema.safeParse(stats);
  if (!parsed.success) return null;
  const worst = Object.entries(parsed.data.criterionCounts)
    .map(([key, counts]) => ({ key, low: counts.Developing + counts.Missing }))
    .sort((a, b) => b.low - a.low)[0];
  return worst && worst.low > 0 ? worst.key : null;
}

/* ── the session contract (per-assignment policy) ───────────── */

/** Direct record edit: the professor's per-assignment session contract. */
export async function updateSessionContract(formData: FormData) {
  const actor = await requireInstructorActor();
  const course = await requireCourse(actor);
  const assignmentId = String(formData.get("assignmentId") ?? "");
  const bundle = assignmentId ? await loadSessionAssignmentBundle(actor.orgId, assignmentId) : null;
  if (!bundle || bundle.assignment.courseId !== course.id) {
    throw new Error("Session assignment unavailable.");
  }

  const instructions = String(formData.get("instructions") ?? "").trim();
  if (instructions.length < 10 || instructions.length > 2000) {
    throw new Error("Session brief must be 10 to 2000 characters.");
  }
  const durationMinutes = Number(formData.get("durationMinutes"));
  if (!Number.isInteger(durationMinutes) || durationMinutes < 5 || durationMinutes > 240) {
    throw new Error("Duration must be a whole number of minutes between 5 and 240.");
  }
  const transcriptPolicy = String(formData.get("transcriptPolicy") ?? "").trim();
  if (transcriptPolicy.length < 3 || transcriptPolicy.length > 200) {
    throw new Error("Transcript policy must be 3 to 200 characters.");
  }
  const personalRecordSideNotes = formData.get("personalRecordSideNotes") === "on";

  await db
    .update(sessionAssignments)
    .set({ instructions, durationMinutes, transcriptPolicy, personalRecordSideNotes, updatedAt: new Date() })
    .where(and(eq(sessionAssignments.orgId, actor.orgId), eq(sessionAssignments.assignmentId, assignmentId)));

  revalidateCockpit(assignmentId);
  redirect(`/teach/atlas/${assignmentId}`);
}

/* ── rubric weights (honest versioning) ─────────────────────── */

/**
 * Reweight the rubric. Level points rescale proportionally so "Meets is 80%
 * of full credit" survives the edit, and weights must still sum to 100.
 * Versioning is honest: once ANY report has been graded against the rubric,
 * an edit writes a NEW version and repoints the assignment; existing reports
 * keep the version that actually graded them. Before any grading, the edit
 * is in place.
 */
export async function updateRubricWeights(formData: FormData) {
  const actor = await requireInstructorActor();
  const course = await requireCourse(actor);
  const assignmentId = String(formData.get("assignmentId") ?? "");
  const bundle = assignmentId ? await loadSessionAssignmentBundle(actor.orgId, assignmentId) : null;
  if (!bundle || bundle.assignment.courseId !== course.id) {
    throw new Error("Session assignment unavailable.");
  }

  const criteria = parseRubricCriteria(bundle.rubric.criteria);
  if (!criteria) {
    throw new Error("The rubric on file is malformed.");
  }

  const nextWeights = new Map<string, number>();
  for (const criterion of criteria) {
    const raw = formData.get(`weight:${criterion.key}`);
    const weight = Number(raw);
    if (!Number.isInteger(weight) || weight < 1 || weight > 97) {
      throw new Error(`Weight for ${criterion.name} must be a whole number between 1 and 97.`);
    }
    nextWeights.set(criterion.key, weight);
  }
  const total = [...nextWeights.values()].reduce((sum, value) => sum + value, 0);
  if (total !== 100) {
    throw new Error(`Weights must sum to 100 (currently ${total}).`);
  }

  const changed = criteria.some((criterion) => nextWeights.get(criterion.key) !== criterion.weight);
  if (!changed) {
    redirect(`/teach/atlas/${assignmentId}`);
  }

  const rescaled = criteria.map((criterion) => rescaleCriterionToWeight(criterion, nextWeights.get(criterion.key)!));

  const [gradedAgainst] = await db
    .select({ id: journeyReports.id })
    .from(journeyReports)
    .where(and(eq(journeyReports.orgId, actor.orgId), eq(journeyReports.rubricId, bundle.rubric.id)))
    .limit(1);

  await db.transaction(async (tx) => {
    if (gradedAgainst) {
      const [{ maxVersion }] = await tx
        .select({ maxVersion: sql<number>`coalesce(max(${rubrics.version}), 0)` })
        .from(rubrics)
        .where(and(eq(rubrics.orgId, actor.orgId), eq(rubrics.courseId, course.id)));
      const [created] = await tx
        .insert(rubrics)
        .values({
          orgId: actor.orgId,
          courseId: course.id,
          version: Number(maxVersion) + 1,
          criteria: rescaled,
        })
        .returning({ id: rubrics.id });
      await tx
        .update(sessionAssignments)
        .set({ rubricId: created.id, updatedAt: new Date() })
        .where(and(eq(sessionAssignments.orgId, actor.orgId), eq(sessionAssignments.assignmentId, assignmentId)));
    } else {
      await tx
        .update(rubrics)
        .set({ criteria: rescaled })
        .where(and(eq(rubrics.orgId, actor.orgId), eq(rubrics.id, bundle.rubric.id)));
    }
  });

  revalidateCockpit(assignmentId);
  redirect(`/teach/atlas/${assignmentId}`);
}