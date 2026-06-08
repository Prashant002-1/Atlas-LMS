"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, desc, eq, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  announcements,
  assignments,
  changeProposals,
  contentAlignments,
  enrollments,
  learningObjectives,
  modules,
  submissions,
} from "@/lib/db/schema";
import { isInstructorLike } from "@/lib/auth/session";
import { findEditableCourse } from "@/lib/instructor/workspace";
import {
  hasImportRows,
  importSummary,
  inferCourseCommandImport,
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
  const requestedKind = normalizeKind(String(formData.get("kind") ?? "import"));

  if (intent.length < 12) {
    throw new Error("Proposal intent is too short.");
  }

  const announcementDraft = parseAnnouncementCommand(intent);
  const focus = commandFocus(formData);
  const explicitImport = !announcementDraft && requestedKind === "import" ? parseCourseImportIntent(intent, course.code) : null;
  const parsed =
    explicitImport && hasImportRows(explicitImport)
      ? explicitImport
      : !announcementDraft && requestedKind === "import"
        ? inferCourseCommandImport(intent, course.code, focus)
        : null;
  const hasParsedRows = parsed ? hasImportRows(parsed) : false;
  const kind = announcementDraft ? "course" : requestedKind === "import" && !hasParsedRows ? "course" : requestedKind;
  const diff = announcementDraft
    ? announcementDiff(intent, course.code, announcementDraft)
    : requestedKind === "import"
      ? hasParsedRows
        ? parsed
        : commandDiff(intent, course.code)
      : {
          title: proposalTitle(intent, requestedKind),
          intent,
          courseCode: course.code,
        };

  await db.insert(changeProposals).values({
    orgId: user.orgId,
    courseId: course.id,
    authorId: user.id,
    kind,
    status: "pending",
    summary: announcementDraft ? announcementDraft.message : kind === "import" ? importSummary(diff) : summarizeIntent(intent),
    diff,
  });

  revalidatePath("/teach");
  redirect("/teach");
}

export async function updateCourseProposal(formData: FormData) {
  const user = await requireInstructorActor();
  const course = await findEditableCourse({ id: user.id, orgId: user.orgId, role: user.role });
  if (!course) {
    throw new Error("No editable course found for this instructor.");
  }

  const proposalId = String(formData.get("proposalId") ?? "");
  if (!proposalId) {
    throw new Error("No draft selected.");
  }

  const [proposal] = await db
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

  if (!proposal || proposal.kind !== "import") {
    throw new Error("Draft unavailable.");
  }

  const imported = normalizeImportDiff(proposal.diff, proposal.summary);
  if (imported.modules.length + imported.assignments.length === 0) {
    throw new Error("Draft has no editable records.");
  }

  const modules = [...imported.modules];
  const assignments = [...imported.assignments];
  const materialTitle = optionalCompactField(formData.get("materialTitle"), 220);
  const materialSummary = optionalLongField(formData.get("materialSummary"), 1200);
  const workTitle = optionalCompactField(formData.get("workTitle"), 220);
  const workDetail = optionalLongField(formData.get("workDetail"), 1600);
  const workPoints = positiveNumberField(formData.get("workPoints"));

  if (modules[0]) {
    modules[0] = {
      ...modules[0],
      name: materialTitle ?? modules[0].name,
      summaryMd: materialSummary ?? modules[0].summaryMd,
    };
  }

  if (assignments[0]) {
    assignments[0] = {
      ...assignments[0],
      name: workTitle ?? assignments[0].name,
      descriptionMd: workDetail ?? assignments[0].descriptionMd,
      pointsPossible: workPoints ?? assignments[0].pointsPossible,
    };
  }

  const nextImport = withReferencedObjectives({
    ...imported,
    modules,
    assignments,
  });
  const nextDiff = {
    ...(proposal.diff && typeof proposal.diff === "object" ? (proposal.diff as Record<string, unknown>) : {}),
    ...nextImport,
  };

  await db
    .update(changeProposals)
    .set({
      summary: importSummary(nextDiff),
      diff: nextDiff,
    })
    .where(eq(changeProposals.id, proposal.id));

  revalidatePath("/teach");
  redirect("/teach#review");
}

export async function createModuleRecord(formData: FormData) {
  const user = await requireInstructorActor();
  const course = await findEditableCourse({ id: user.id, orgId: user.orgId, role: user.role });
  if (!course) {
    throw new Error("No editable course found for this instructor.");
  }

  const title = compactField(formData.get("title"), "Week title is required.", 200);
  const summary = optionalLongField(formData.get("summary"), 1200);
  const objectiveCodes = objectiveCodesFromForm(formData);
  let createdId: string | undefined;

  await db.transaction(async (tx) => {
    const [lastModule] = await tx
      .select({ position: modules.position })
      .from(modules)
      .where(and(eq(modules.orgId, user.orgId), eq(modules.courseId, course.id)))
      .orderBy(desc(modules.position))
      .limit(1);

    const [created] = await tx
      .insert(modules)
      .values({
        orgId: user.orgId,
        courseId: course.id,
        name: title,
        summaryMd: summary,
        position: (lastModule?.position ?? 0) + 1,
        published: false,
      })
      .returning({ id: modules.id });

    createdId = created?.id;
    if (createdId) {
      await linkObjectives(tx, user.orgId, course.id, createdId, "module", objectiveCodes);
    }
  });

  revalidatePath("/teach");
  revalidatePath("/student");
  redirect(createdId ? `/teach/week/${createdId}` : "/teach#map");
}

export async function createAssignmentRecord(formData: FormData) {
  const user = await requireInstructorActor();
  const course = await findEditableCourse({ id: user.id, orgId: user.orgId, role: user.role });
  if (!course) {
    throw new Error("No editable course found for this instructor.");
  }

  const title = compactField(formData.get("title"), "Work title is required.", 220);
  const description = optionalLongField(formData.get("description"), 1600);
  const dueAt = dateField(formData.get("dueDate"));
  const pointsPossible = positiveNumberField(formData.get("points")) ?? 100;
  const objectiveCodes = objectiveCodesFromForm(formData);
  let createdId: string | undefined;

  await db.transaction(async (tx) => {
    const [lastAssignment] = await tx
      .select({ position: assignments.position })
      .from(assignments)
      .where(and(eq(assignments.orgId, user.orgId), eq(assignments.courseId, course.id)))
      .orderBy(desc(assignments.position))
      .limit(1);

    const [created] = await tx
      .insert(assignments)
      .values({
        orgId: user.orgId,
        courseId: course.id,
        name: title,
        descriptionMd: description,
        dueAt,
        pointsPossible,
        position: (lastAssignment?.position ?? 0) + 1,
        published: false,
      })
      .returning({ id: assignments.id });

    createdId = created?.id;
    if (createdId) {
      await linkObjectives(tx, user.orgId, course.id, createdId, "assignment", objectiveCodes);
    }
  });

  revalidatePath("/teach");
  revalidatePath("/student");
  redirect(createdId ? `/teach/work/${createdId}` : "/teach#students");
}

export async function createObjectiveRecord(formData: FormData) {
  const user = await requireInstructorActor();
  const course = await findEditableCourse({ id: user.id, orgId: user.orgId, role: user.role });
  if (!course) {
    throw new Error("No editable course found for this instructor.");
  }

  const description = compactField(formData.get("description"), "Objective is required.", 360);
  const bloomLevel = bloomLevelField(formData.get("bloomLevel"));
  const assessmentWeight = assessmentWeightField(formData.get("weight"));
  const existingObjectives = await db
    .select({ code: learningObjectives.code })
    .from(learningObjectives)
    .where(and(eq(learningObjectives.orgId, user.orgId), eq(learningObjectives.courseId, course.id)));
  const existingCodes = existingObjectives.map((objective) => objective.code);
  const code = objectiveCodeField(formData.get("code"), existingCodes);

  if (existingCodes.includes(code)) {
    throw new Error("Objective code already exists.");
  }

  await db.insert(learningObjectives).values({
    orgId: user.orgId,
    courseId: course.id,
    code,
    description,
    bloomLevel,
    assessmentWeight,
  });

  revalidatePath("/teach");
  revalidatePath("/student");
  redirect("/teach#map");
}

export async function publishModule(formData: FormData) {
  const user = await requireInstructorActor();
  const course = await findEditableCourse({ id: user.id, orgId: user.orgId, role: user.role });
  if (!course) {
    throw new Error("No editable course found for this instructor.");
  }

  const moduleId = String(formData.get("moduleId") ?? "");
  const returnTo = instructorWeekReturnPath(formData.get("returnTo"), moduleId, "/teach");
  if (!moduleId) {
    throw new Error("No module selected.");
  }

  await db
    .update(modules)
    .set({ published: true, updatedAt: new Date() })
    .where(and(eq(modules.id, moduleId), eq(modules.orgId, user.orgId), eq(modules.courseId, course.id)));

  revalidatePath("/teach");
  revalidatePath(returnTo);
  revalidatePath("/student");
  revalidatePath(`/student/material/${moduleId}`);
  redirect(returnTo);
}

export async function updateModuleRecord(formData: FormData) {
  const user = await requireInstructorActor();
  const course = await findEditableCourse({ id: user.id, orgId: user.orgId, role: user.role });
  if (!course) {
    throw new Error("No editable course found for this instructor.");
  }

  const moduleId = String(formData.get("moduleId") ?? "");
  const title = compactField(formData.get("title"), "Week title is required.", 200);
  const summary = optionalLongField(formData.get("summary"), 1200);
  const objectiveCodes = objectiveCodesFromForm(formData);
  const returnTo = instructorWeekReturnPath(formData.get("returnTo"), moduleId, "/teach#map");

  if (!moduleId) {
    throw new Error("No week selected.");
  }

  await db.transaction(async (tx) => {
    await tx
      .update(modules)
      .set({ name: title, summaryMd: summary, updatedAt: new Date() })
      .where(and(eq(modules.id, moduleId), eq(modules.orgId, user.orgId), eq(modules.courseId, course.id)));

    await replaceObjectiveLinks(tx, user.orgId, course.id, moduleId, "module", objectiveCodes);
  });

  revalidatePath("/teach");
  revalidatePath(returnTo);
  revalidatePath("/student");
  revalidatePath(`/student/material/${moduleId}`);
  redirect(returnTo);
}

export async function publishAssignment(formData: FormData) {
  const user = await requireInstructorActor();
  const course = await findEditableCourse({ id: user.id, orgId: user.orgId, role: user.role });
  if (!course) {
    throw new Error("No editable course found for this instructor.");
  }

  const assignmentId = String(formData.get("assignmentId") ?? "");
  const returnTo = instructorWorkReturnPath(formData.get("returnTo"), assignmentId, "/teach");
  if (!assignmentId) {
    throw new Error("No work selected.");
  }

  await db
    .update(assignments)
    .set({ published: true, updatedAt: new Date() })
    .where(and(eq(assignments.id, assignmentId), eq(assignments.orgId, user.orgId), eq(assignments.courseId, course.id)));

  revalidatePath("/teach");
  revalidatePath(returnTo);
  revalidatePath("/student");
  revalidatePath(`/student/work/${assignmentId}`);
  redirect(returnTo);
}

export async function publishDraftRecords() {
  const user = await requireInstructorActor();
  const course = await findEditableCourse({ id: user.id, orgId: user.orgId, role: user.role });
  if (!course) {
    throw new Error("No editable course found for this instructor.");
  }

  const now = new Date();

  await db.transaction(async (tx) => {
    await tx
      .update(modules)
      .set({ published: true, updatedAt: now })
      .where(and(eq(modules.orgId, user.orgId), eq(modules.courseId, course.id), eq(modules.published, false)));

    await tx
      .update(assignments)
      .set({ published: true, updatedAt: now })
      .where(and(eq(assignments.orgId, user.orgId), eq(assignments.courseId, course.id), eq(assignments.published, false)));
  });

  revalidatePath("/teach");
  revalidatePath("/student");
  redirect("/teach#publish");
}

export async function updateAssignmentRecord(formData: FormData) {
  const user = await requireInstructorActor();
  const course = await findEditableCourse({ id: user.id, orgId: user.orgId, role: user.role });
  if (!course) {
    throw new Error("No editable course found for this instructor.");
  }

  const assignmentId = String(formData.get("assignmentId") ?? "");
  const title = compactField(formData.get("title"), "Work title is required.", 220);
  const description = optionalLongField(formData.get("description"), 1600);
  const dueAt = dateField(formData.get("dueDate"));
  const pointsPossible = positiveNumberField(formData.get("points"));
  const objectiveCodes = objectiveCodesFromForm(formData);
  const returnTo = instructorWorkReturnPath(formData.get("returnTo"), assignmentId, "/teach#students");

  if (!assignmentId) {
    throw new Error("No work selected.");
  }

  await db.transaction(async (tx) => {
    await tx
      .update(assignments)
      .set({
        name: title,
        descriptionMd: description,
        dueAt,
        pointsPossible,
        updatedAt: new Date(),
      })
      .where(and(eq(assignments.id, assignmentId), eq(assignments.orgId, user.orgId), eq(assignments.courseId, course.id)));

    await replaceObjectiveLinks(tx, user.orgId, course.id, assignmentId, "assignment", objectiveCodes);
  });

  revalidatePath("/teach");
  revalidatePath(returnTo);
  revalidatePath("/student");
  revalidatePath(`/student/work/${assignmentId}`);
  redirect(returnTo);
}

export async function gradeSubmission(formData: FormData) {
  const user = await requireInstructorActor();
  const course = await findEditableCourse({ id: user.id, orgId: user.orgId, role: user.role });
  if (!course) {
    throw new Error("No editable course found for this instructor.");
  }

  const assignmentId = String(formData.get("assignmentId") ?? "");
  const studentId = String(formData.get("studentId") ?? "");
  const score = numericScore(formData.get("score"));
  const grade = String(formData.get("grade") ?? "").trim();
  const returnTo = instructorWorkReturnPath(formData.get("returnTo"), assignmentId);

  if (!assignmentId || !studentId) {
    throw new Error("No submission selected.");
  }
  if (score === null) {
    throw new Error("Score is required.");
  }

  const [assignment] = await db
    .select({ id: assignments.id, courseId: assignments.courseId, pointsPossible: assignments.pointsPossible })
    .from(assignments)
    .where(and(eq(assignments.id, assignmentId), eq(assignments.orgId, user.orgId), eq(assignments.courseId, course.id)))
    .limit(1);

  if (!assignment) {
    throw new Error("Work unavailable.");
  }
  if (assignment.pointsPossible && score > assignment.pointsPossible) {
    throw new Error("Score is above the points possible.");
  }

  const [studentEnrollment] = await db
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.orgId, user.orgId),
        eq(enrollments.courseId, course.id),
        eq(enrollments.userId, studentId),
        eq(enrollments.role, "student"),
        eq(enrollments.state, "active")
      )
    )
    .limit(1);

  if (!studentEnrollment) {
    throw new Error("Student unavailable.");
  }

  const now = new Date();
  const [existing] = await db
    .select({ userId: submissions.userId })
    .from(submissions)
    .where(
      and(
        eq(submissions.orgId, user.orgId),
        eq(submissions.assignmentId, assignment.id),
        eq(submissions.courseId, course.id),
        eq(submissions.userId, studentId)
      )
    )
    .limit(1);

  const gradeValue = grade.length > 0 ? grade.slice(0, 24) : null;
  if (existing) {
    await db
      .update(submissions)
      .set({
        gradedAt: now,
        score,
        grade: gradeValue,
        missing: false,
        workflowState: "graded",
      })
      .where(
        and(
          eq(submissions.orgId, user.orgId),
          eq(submissions.assignmentId, assignment.id),
          eq(submissions.courseId, course.id),
          eq(submissions.userId, studentId)
        )
      );
  } else {
    await db.insert(submissions).values({
      orgId: user.orgId,
      assignmentId: assignment.id,
      courseId: course.id,
      userId: studentId,
      gradedAt: now,
      score,
      grade: gradeValue,
      missing: false,
      workflowState: "graded",
    });
  }

  await refreshStudentStanding(user.orgId, assignment.courseId, studentId);

  revalidatePath("/teach");
  revalidatePath(returnTo);
  revalidatePath(`/teach/student/${studentId}`);
  revalidatePath("/student");
  revalidatePath(`/student/work/${assignment.id}`);
  redirect(returnTo);
}

export async function markSubmissionMissing(formData: FormData) {
  const user = await requireInstructorActor();
  const course = await findEditableCourse({ id: user.id, orgId: user.orgId, role: user.role });
  if (!course) {
    throw new Error("No editable course found for this instructor.");
  }

  const assignmentId = String(formData.get("assignmentId") ?? "");
  const studentId = String(formData.get("studentId") ?? "");
  const returnTo = instructorWorkReturnPath(formData.get("returnTo"), assignmentId);

  if (!assignmentId || !studentId) {
    throw new Error("No student work selected.");
  }

  const [assignment] = await db
    .select({ id: assignments.id, courseId: assignments.courseId })
    .from(assignments)
    .where(and(eq(assignments.id, assignmentId), eq(assignments.orgId, user.orgId), eq(assignments.courseId, course.id)))
    .limit(1);

  if (!assignment) {
    throw new Error("Work unavailable.");
  }

  const [studentEnrollment] = await db
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.orgId, user.orgId),
        eq(enrollments.courseId, course.id),
        eq(enrollments.userId, studentId),
        eq(enrollments.role, "student"),
        eq(enrollments.state, "active")
      )
    )
    .limit(1);

  if (!studentEnrollment) {
    throw new Error("Student unavailable.");
  }

  const [existing] = await db
    .select({
      userId: submissions.userId,
      submittedAt: submissions.submittedAt,
      gradedAt: submissions.gradedAt,
    })
    .from(submissions)
    .where(
      and(
        eq(submissions.orgId, user.orgId),
        eq(submissions.assignmentId, assignment.id),
        eq(submissions.courseId, assignment.courseId),
        eq(submissions.userId, studentId)
      )
    )
    .limit(1);

  if (existing?.submittedAt || existing?.gradedAt) {
    throw new Error("Submitted work cannot be marked missing.");
  }

  if (existing) {
    await db
      .update(submissions)
      .set({
        submittedAt: null,
        gradedAt: null,
        score: null,
        grade: null,
        missing: true,
        workflowState: "missing",
        submissionType: null,
        body: null,
        url: null,
      })
      .where(
        and(
          eq(submissions.orgId, user.orgId),
          eq(submissions.assignmentId, assignment.id),
          eq(submissions.courseId, assignment.courseId),
          eq(submissions.userId, studentId)
        )
      );
  } else {
    await db.insert(submissions).values({
      orgId: user.orgId,
      assignmentId: assignment.id,
      courseId: assignment.courseId,
      userId: studentId,
      missing: true,
      workflowState: "missing",
    });
  }

  revalidatePath("/teach");
  revalidatePath(returnTo);
  revalidatePath(`/teach/student/${studentId}`);
  revalidatePath("/student");
  revalidatePath(`/student/work/${assignment.id}`);
  redirect(returnTo);
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
  const publishReviewedRecords = decision === "approved";

  if (!proposalId || !status) {
    throw new Error("Invalid proposal review request.");
  }

  let redirectTo = status === "rejected" ? "/teach#review" : "/teach";
  const revalidateTargets = new Set<string>(["/teach", "/student"]);

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
          published: publishReviewedRecords,
        })
        .returning({ id: modules.id });

      const linkedObjectiveCodes = createdModule
        ? await linkObjectives(tx, user.orgId, course.id, createdModule.id, "module", objectiveCodes)
        : [];
      nextDiff = withAppliedItem(proposal.diff, "appliedModuleId", createdModule?.id, linkedObjectiveCodes, publishReviewedRecords);
      if (createdModule) {
        redirectTo = `/teach/week/${createdModule.id}`;
        revalidateTargets.add(`/teach/week/${createdModule.id}`);
        revalidateTargets.add(`/student/material/${createdModule.id}`);
      }
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
          published: publishReviewedRecords,
        })
        .returning({ id: assignments.id });

      const linkedObjectiveCodes = createdAssignment
        ? await linkObjectives(tx, user.orgId, course.id, createdAssignment.id, "assignment", objectiveCodes)
        : [];
      nextDiff = withAppliedItem(proposal.diff, "appliedAssignmentId", createdAssignment?.id, linkedObjectiveCodes, publishReviewedRecords);
      if (createdAssignment) {
        redirectTo = `/teach/work/${createdAssignment.id}`;
        revalidateTargets.add(`/teach/work/${createdAssignment.id}`);
        revalidateTargets.add(`/student/work/${createdAssignment.id}`);
      }
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
      if (createdObjective) {
        redirectTo = "/teach#map";
      }
    }

    if (status === "applied" && isAnnouncementDiff(proposal.diff)) {
      const now = new Date();
      const title = valueFromDiff(proposal.diff, "title") || "Course note";
      const messageMd = valueFromDiff(proposal.diff, "messageMd") || proposal.summary;
      const [createdAnnouncement] = await tx
        .insert(announcements)
        .values({
          orgId: user.orgId,
          courseId: course.id,
          authorId: user.id,
          title,
          messageMd,
          postedAt: now,
          published: true,
        })
        .returning({ id: announcements.id });

      nextDiff = {
        ...(proposal.diff && typeof proposal.diff === "object" ? (proposal.diff as Record<string, unknown>) : {}),
        appliedAnnouncementId: createdAnnouncement?.id,
        postedAt: now.toISOString(),
      };
      if (createdAnnouncement) {
        redirectTo = "/teach#review";
      }
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
            published: publishReviewedRecords,
          })
          .returning({ id: modules.id });

        if (createdModule) {
          appliedModuleIds.push(createdModule.id);
          await linkObjectives(tx, user.orgId, course.id, createdModule.id, "module", moduleDraft.objectiveCodes);
          revalidateTargets.add(`/teach/week/${createdModule.id}`);
          revalidateTargets.add(`/student/material/${createdModule.id}`);
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
            published: publishReviewedRecords,
          })
          .returning({ id: assignments.id });

        if (createdAssignment) {
          appliedAssignmentIds.push(createdAssignment.id);
          await linkObjectives(tx, user.orgId, course.id, createdAssignment.id, "assignment", assignment.objectiveCodes);
          revalidateTargets.add(`/teach/work/${createdAssignment.id}`);
          revalidateTargets.add(`/student/work/${createdAssignment.id}`);
        }
      }

      if (appliedAssignmentIds[0]) {
        redirectTo = `/teach/work/${appliedAssignmentIds[0]}`;
      } else if (appliedModuleIds[0]) {
        redirectTo = `/teach/week/${appliedModuleIds[0]}`;
      }

      nextDiff = {
        ...(proposal.diff && typeof proposal.diff === "object" ? (proposal.diff as Record<string, unknown>) : {}),
        appliedModuleIds,
        appliedAssignmentIds,
        objectiveCodes,
        published: publishReviewedRecords,
      };
    }

    await tx
      .update(changeProposals)
      .set({ status, decidedAt: new Date(), diff: nextDiff })
      .where(eq(changeProposals.id, proposal.id));
  });

  for (const target of revalidateTargets) {
    revalidatePath(target);
  }
  redirect(redirectTo);
}

async function requireInstructorActor() {
  const session = await auth();
  const user = session?.user;

  if (!user?.id || !user.orgId || !isInstructorLike(user.role)) {
    redirect("/sign-in");
  }

  return { id: user.id, orgId: user.orgId, role: user.role, email: user.email };
}

function numericScore(value: FormDataEntryValue | null) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return null;
  const score = Number(raw);
  if (!Number.isFinite(score) || score < 0) return null;
  return Math.round(score * 100) / 100;
}

async function refreshStudentStanding(orgId: string, courseId: string, studentId: string) {
  const gradedRows = (
    await db
      .select({
        assignmentId: submissions.assignmentId,
        gradedAt: submissions.gradedAt,
        score: submissions.score,
        missing: submissions.missing,
      })
      .from(submissions)
      .where(and(eq(submissions.orgId, orgId), eq(submissions.courseId, courseId), eq(submissions.userId, studentId)))
  ).filter((submission) => submission.gradedAt && !submission.missing && typeof submission.score === "number");

  if (gradedRows.length === 0) return;

  const assignmentIds = Array.from(new Set(gradedRows.map((submission) => submission.assignmentId)));
  const assignmentRows = await db
    .select({
      id: assignments.id,
      pointsPossible: assignments.pointsPossible,
    })
    .from(assignments)
    .where(and(eq(assignments.orgId, orgId), eq(assignments.courseId, courseId), inArray(assignments.id, assignmentIds)));

  const pointsByAssignment = new Map(assignmentRows.map((assignment) => [assignment.id, assignment.pointsPossible]));
  const totals = gradedRows.reduce(
    (sum, submission) => {
      const possible = pointsByAssignment.get(submission.assignmentId) ?? 100;
      if (!possible || possible <= 0 || typeof submission.score !== "number") return sum;

      return {
        earned: sum.earned + Math.min(submission.score, possible),
        possible: sum.possible + possible,
      };
    },
    { earned: 0, possible: 0 }
  );

  if (totals.possible <= 0) return;

  const currentScore = Math.round((totals.earned / totals.possible) * 10000) / 100;
  await db
    .update(enrollments)
    .set({
      currentScore,
      currentGrade: letterGrade(currentScore),
      lastActivityAt: new Date(),
    })
    .where(
      and(
        eq(enrollments.orgId, orgId),
        eq(enrollments.courseId, courseId),
        eq(enrollments.userId, studentId),
        eq(enrollments.role, "student"),
        eq(enrollments.state, "active")
      )
    );
}

function letterGrade(score: number) {
  if (score >= 93) return "A";
  if (score >= 90) return "A-";
  if (score >= 87) return "B+";
  if (score >= 83) return "B";
  if (score >= 80) return "B-";
  if (score >= 77) return "C+";
  if (score >= 73) return "C";
  if (score >= 70) return "C-";
  if (score >= 67) return "D+";
  if (score >= 63) return "D";
  if (score >= 60) return "D-";
  return "F";
}

function compactField(value: FormDataEntryValue | null, message: string, maxLength: number) {
  const text = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  if (!text) {
    throw new Error(message);
  }
  return text.slice(0, maxLength);
}

function optionalCompactField(value: FormDataEntryValue | null, maxLength: number) {
  const text = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return text ? text.slice(0, maxLength) : null;
}

function optionalLongField(value: FormDataEntryValue | null, maxLength: number) {
  const text = typeof value === "string" ? value.replace(/\r\n/g, "\n").trim() : "";
  return text ? text.slice(0, maxLength) : null;
}

function positiveNumberField(value: FormDataEntryValue | null) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return null;
  const number = Number(raw);
  if (!Number.isFinite(number) || number <= 0) {
    throw new Error("Points must be greater than zero.");
  }
  return Math.round(number * 100) / 100;
}

function dateField(value: FormDataEntryValue | null) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new Error("Due date is invalid.");
  }
  return new Date(`${raw}T12:00:00.000Z`);
}

function objectiveCodesFromForm(formData: FormData) {
  return Array.from(
    new Set(
      formData
        .getAll("objectiveCode")
        .map((value) => (typeof value === "string" ? value.trim().toUpperCase() : ""))
        .filter(Boolean)
    )
  );
}

function objectiveCodeField(value: FormDataEntryValue | null, existingCodes: string[]) {
  const raw = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (!raw) return nextObjectiveCode(existingCodes);
  if (!/^[A-Z]{1,4}\d{1,3}$/.test(raw)) {
    throw new Error("Objective code is invalid.");
  }
  return raw;
}

function bloomLevelField(value: FormDataEntryValue | null) {
  const raw = typeof value === "string" ? value.trim() : "";
  const allowed = ["remember", "understand", "apply", "analyze", "evaluate", "create"] as const;
  return allowed.find((level) => level === raw) ?? "apply";
}

function assessmentWeightField(value: FormDataEntryValue | null) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return 0.1;
  const percentage = Number(raw);
  if (!Number.isFinite(percentage) || percentage <= 0 || percentage > 100) {
    throw new Error("Weight must be between 1 and 100.");
  }
  return Math.round(percentage * 100) / 10000;
}

function instructorWorkReturnPath(value: FormDataEntryValue | null, assignmentId: string, fallback = "/teach#students") {
  const path = typeof value === "string" ? value : "";
  return path === `/teach/work/${assignmentId}` ? path : fallback;
}

function instructorWeekReturnPath(value: FormDataEntryValue | null, moduleId: string, fallback = "/teach#map") {
  const path = typeof value === "string" ? value : "";
  return path === `/teach/week/${moduleId}` ? path : fallback;
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

function commandDiff(intent: string, courseCode: string) {
  return {
    title: proposalTitle(intent, "course"),
    intent,
    courseCode,
    source: "command",
    schemaVersion: 1,
  };
}

function announcementDiff(intent: string, courseCode: string, draft: { title: string; message: string }) {
  return {
    type: "announcement",
    title: draft.title,
    messageMd: draft.message,
    intent,
    courseCode,
    source: "command",
    schemaVersion: 1,
  };
}

function parseAnnouncementCommand(intent: string) {
  const cleaned = intent.replace(/\s+/g, " ").trim();
  const command = /^(?:please\s+)?(?:(?:announce|post|send)\s+(?:a\s+)?(?:note|announcement|message)?|tell\s+(?:the\s+)?(?:class|students)|remind\s+(?:the\s+)?(?:class|students))\b[:\s-]*(?:that|to)?\s*/i;
  const match = cleaned.match(command);
  if (!match) return null;

  const message = cleaned.slice(match[0].length).replace(/\s+/g, " ").trim() || cleaned;
  if (message.length < 8) return null;

  return {
    title: announcementTitle(message),
    message: message.slice(0, 1200),
  };
}

function announcementTitle(message: string) {
  const firstSentence = message.split(/[.!?]/)[0]?.trim();
  if (firstSentence && firstSentence.length <= 72) return firstSentence;
  return "Course note";
}

function isAnnouncementDiff(diff: unknown) {
  return Boolean(diff && typeof diff === "object" && (diff as Record<string, unknown>).type === "announcement");
}

function commandFocus(formData: FormData) {
  return {
    code: stringField(formData.get("focusCode")),
    title: stringField(formData.get("focusTitle")),
    description: stringField(formData.get("focusDescription")),
  };
}

function stringField(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
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

async function replaceObjectiveLinks(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  orgId: string,
  courseId: string,
  itemId: string,
  itemType: "module" | "assignment",
  objectiveCodes: string[]
) {
  await tx
    .delete(contentAlignments)
    .where(and(eq(contentAlignments.orgId, orgId), eq(contentAlignments.itemType, itemType), eq(contentAlignments.itemId, itemId)));

  await linkObjectives(tx, orgId, courseId, itemId, itemType, objectiveCodes);
}

function withAppliedItem(
  diff: unknown,
  key: "appliedModuleId" | "appliedAssignmentId",
  itemId?: string,
  objectiveCodes: string[] = [],
  published = false
) {
  const record = diff && typeof diff === "object" ? (diff as Record<string, unknown>) : {};
  return {
    ...record,
    [key]: itemId,
    objectiveCodes,
    published,
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
