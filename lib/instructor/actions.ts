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
  courseAiPolicies,
  courses,
  enrollments,
  learningObjectives,
  modules,
  submissions,
} from "@/lib/db/schema";
import { isInstructorLike } from "@/lib/auth/session";
import { findEditableCourse } from "@/lib/instructor/workspace";
import { applyProposal, dismissProposal } from "@/lib/agent/apply";

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
  redirect(createdId ? `/teach/week/${createdId}` : "/teach/weeks");
}

export async function createAssignmentRecord(formData: FormData) {
  const user = await requireInstructorActor();
  const course = await findEditableCourse({ id: user.id, orgId: user.orgId, role: user.role });
  if (!course) {
    throw new Error("No editable course found for this instructor.");
  }

  const title = compactField(formData.get("title"), "Assignment title is required.", 220);
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
  redirect(createdId ? `/teach/assignments/${createdId}` : "/teach/assignments");
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
  redirect("/teach/weeks");
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
  const returnTo = instructorWeekReturnPath(formData.get("returnTo"), moduleId, "/teach/weeks");

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
  const returnTo = instructorAssignmentReturnPath(formData.get("returnTo"), assignmentId, "/teach");
  if (!assignmentId) {
    throw new Error("No assignment selected.");
  }

  await db
    .update(assignments)
    .set({ published: true, updatedAt: new Date() })
    .where(and(eq(assignments.id, assignmentId), eq(assignments.orgId, user.orgId), eq(assignments.courseId, course.id)));

  revalidatePath("/teach");
  revalidatePath(returnTo);
  revalidatePath("/student");
  revalidatePath(`/student/assignments/${assignmentId}`);
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
  redirect("/teach/weeks");
}

export async function updateAssignmentRecord(formData: FormData) {
  const user = await requireInstructorActor();
  const course = await findEditableCourse({ id: user.id, orgId: user.orgId, role: user.role });
  if (!course) {
    throw new Error("No editable course found for this instructor.");
  }

  const assignmentId = String(formData.get("assignmentId") ?? "");
  const title = compactField(formData.get("title"), "Assignment title is required.", 220);
  const description = optionalLongField(formData.get("description"), 1600);
  const dueAt = dateField(formData.get("dueDate"));
  const pointsPossible = positiveNumberField(formData.get("points"));
  const objectiveCodes = objectiveCodesFromForm(formData);
  const returnTo = instructorAssignmentReturnPath(formData.get("returnTo"), assignmentId, "/teach/assignments");

  if (!assignmentId) {
    throw new Error("No assignment selected.");
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
  revalidatePath(`/student/assignments/${assignmentId}`);
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
  const returnTo = instructorAssignmentReturnPath(formData.get("returnTo"), assignmentId);

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
    throw new Error("Assignment unavailable.");
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
  revalidatePath(`/student/assignments/${assignment.id}`);
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
  const returnTo = instructorAssignmentReturnPath(formData.get("returnTo"), assignmentId);

  if (!assignmentId || !studentId) {
    throw new Error("No student work selected.");
  }

  const [assignment] = await db
    .select({ id: assignments.id, courseId: assignments.courseId })
    .from(assignments)
    .where(and(eq(assignments.id, assignmentId), eq(assignments.orgId, user.orgId), eq(assignments.courseId, course.id)))
    .limit(1);

  if (!assignment) {
    throw new Error("Assignment unavailable.");
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
  revalidatePath(`/student/assignments/${assignment.id}`);
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
  if (!proposalId || (decision !== "approved" && decision !== "rejected")) {
    throw new Error("Invalid proposal review request.");
  }

  // The proposal must belong to this course and still be open.
  const [proposal] = await db
    .select({ id: changeProposals.id })
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
  if (!proposal) {
    throw new Error("Draft unavailable.");
  }

  let redirectTo = "/teach/review";
  if (decision === "approved") {
    const applied = await applyProposal({ orgId: user.orgId, courseId: course.id, userId: user.id, proposalId });
    const first = applied[0];
    redirectTo =
      first?.itemType === "module"
        ? `/teach/week/${first.itemId}`
        : first?.itemType === "assignment"
          ? `/teach/assignments/${first.itemId}`
          : "/teach/review";
  } else {
    await dismissProposal({ orgId: user.orgId, proposalId });
  }

  revalidatePath("/teach");
  revalidatePath("/student");
  redirect(redirectTo);
}

/**
 * The course AI policy, the professor's control surface for student cues.
 * One form, one row, everything the runtime needs.
 */
export async function updateCourseAiPolicy(formData: FormData) {
  const user = await requireInstructorActor();
  const course = await findEditableCourse({ id: user.id, orgId: user.orgId, role: user.role });
  if (!course) {
    throw new Error("No editable course found for this instructor.");
  }

  const depthRaw = String(formData.get("explanationDepth") ?? "guided");
  const explanationDepth = depthRaw === "hint" || depthRaw === "full" ? depthRaw : "guided";
  const dailyLimit = positiveNumberField(formData.get("studentDailyLimit"));
  const personaName = optionalCompactField(formData.get("personaName"), 80);
  const personaStyle = optionalLongField(formData.get("personaStyle"), 600);
  const customInstructions = optionalLongField(formData.get("customInstructions"), 2000);

  await db
    .insert(courseAiPolicies)
    .values({
      orgId: user.orgId,
      courseId: course.id,
      allowExplain: formData.get("allowExplain") === "on",
      allowPractice: formData.get("allowPractice") === "on",
      allowQuestions: formData.get("allowQuestions") === "on",
      explanationDepth,
      citationsRequired: formData.get("citationsRequired") === "on",
      personaName,
      personaStyle,
      customInstructions,
      studentDailyLimit: dailyLimit ? Math.min(Math.round(dailyLimit), 500) : 40,
      shareStruggleSignal: formData.get("shareStruggleSignal") === "on",
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [courseAiPolicies.courseId],
      set: {
        allowExplain: formData.get("allowExplain") === "on",
        allowPractice: formData.get("allowPractice") === "on",
        allowQuestions: formData.get("allowQuestions") === "on",
        explanationDepth,
        citationsRequired: formData.get("citationsRequired") === "on",
        personaName,
        personaStyle,
        customInstructions,
        studentDailyLimit: dailyLimit ? Math.min(Math.round(dailyLimit), 500) : 40,
        shareStruggleSignal: formData.get("shareStruggleSignal") === "on",
        updatedAt: new Date(),
      },
    });

  revalidatePath("/teach");
  revalidatePath("/teach/settings");
  revalidatePath("/student");
  redirect("/teach/settings");
}

/**
 * Post an announcement: a one-way course post, published on creation with
 * the posting time as its record fact. There is no inbox and no thread.
 */
export async function createAnnouncementRecord(formData: FormData) {
  const user = await requireInstructorActor();
  const course = await findEditableCourse({ id: user.id, orgId: user.orgId, role: user.role });
  if (!course) {
    throw new Error("No editable course found for this instructor.");
  }

  const title = compactField(formData.get("title"), "Announcement title is required.", 200);
  const message = optionalLongField(formData.get("message"), 4000);

  await db.insert(announcements).values({
    orgId: user.orgId,
    courseId: course.id,
    authorId: user.id,
    title,
    messageMd: message,
    postedAt: new Date(),
    published: true,
  });

  revalidatePath("/teach");
  revalidatePath("/student");
  redirect("/teach/announcements");
}

/**
 * Course setup: the roster-facing course details. Name and description only;
 * the syllabus text has its own action on the Syllabus page, and Atlas policy
 * lives in Settings, deliberately not here.
 */
export async function updateCourseDetails(formData: FormData) {
  const user = await requireInstructorActor();
  const course = await findEditableCourse({ id: user.id, orgId: user.orgId, role: user.role });
  if (!course) {
    throw new Error("No editable course found for this instructor.");
  }

  const name = compactField(formData.get("name"), "Course name is required.", 200);
  const description = optionalLongField(formData.get("description"), 2000);

  await db
    .update(courses)
    .set({ name, description, updatedAt: new Date() })
    .where(and(eq(courses.orgId, user.orgId), eq(courses.id, course.id)));

  revalidatePath("/teach");
  revalidatePath("/teach/syllabus");
  revalidatePath("/student");
  redirect("/teach/course");
}

/** The syllabus text, edited from the Syllabus page it renders on. */
export async function updateCourseSyllabus(formData: FormData) {
  const user = await requireInstructorActor();
  const course = await findEditableCourse({ id: user.id, orgId: user.orgId, role: user.role });
  if (!course) {
    throw new Error("No editable course found for this instructor.");
  }

  const syllabusMd = optionalLongField(formData.get("syllabus"), 80000);

  await db
    .update(courses)
    .set({ syllabusMd, updatedAt: new Date() })
    .where(and(eq(courses.orgId, user.orgId), eq(courses.id, course.id)));

  revalidatePath("/teach/syllabus");
  revalidatePath("/teach/course");
  revalidatePath("/student");
  redirect("/teach/syllabus");
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

function nextObjectiveCode(existingCodes: string[]) {
  const highest = existingCodes.reduce((max, code) => {
    const match = code.match(/^LO(\d+)$/i);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `LO${highest + 1}`;
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

function instructorAssignmentReturnPath(value: FormDataEntryValue | null, assignmentId: string, fallback = "/teach/assignments") {
  const path = typeof value === "string" ? value : "";
  return path === `/teach/assignments/${assignmentId}` ? path : fallback;
}

function instructorWeekReturnPath(value: FormDataEntryValue | null, moduleId: string, fallback = "/teach/weeks") {
  const path = typeof value === "string" ? value : "";
  return path === `/teach/week/${moduleId}` ? path : fallback;
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
