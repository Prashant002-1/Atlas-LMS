"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTenant, isInstructorLike } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { assignments, enrollments, submissions } from "@/lib/db/schema";
import { findEditableCourse } from "@/lib/instructor/workspace";

/**
 * Write the instructor's comment on one submission.
 *
 * Feedback is saved on its own, not folded into the grade action. A grader
 * often writes the comment before settling on a number, or revises the comment
 * without touching the score, and a combined save would force one to wait on
 * the other. The score path stays exactly where it was.
 */

const MAX_FEEDBACK_CHARACTERS = 8000;

export async function saveSubmissionFeedback(formData: FormData) {
  const tenant = await requireTenant();
  if (!isInstructorLike(tenant.role)) throw new Error("Only instructors leave feedback.");

  const course = await findEditableCourse({ id: tenant.userId, orgId: tenant.orgId, role: tenant.role });
  if (!course) throw new Error("No editable course found for this instructor.");

  const assignmentId = String(formData.get("assignmentId") ?? "");
  const studentId = String(formData.get("studentId") ?? "");
  const raw = String(formData.get("feedback") ?? "");
  const feedback = raw.trim().slice(0, MAX_FEEDBACK_CHARACTERS);
  const returnTo = safeReturnPath(formData.get("returnTo"), assignmentId, studentId);

  if (!assignmentId || !studentId) throw new Error("No submission selected.");

  /* The assignment must be in the course in view, not merely exist. */
  const [assignment] = await db
    .select({ id: assignments.id })
    .from(assignments)
    .where(
      and(eq(assignments.orgId, tenant.orgId), eq(assignments.courseId, course.id), eq(assignments.id, assignmentId))
    )
    .limit(1);
  if (!assignment) throw new Error("Assignment unavailable.");

  const [studentEnrollment] = await db
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.orgId, tenant.orgId),
        eq(enrollments.courseId, course.id),
        eq(enrollments.userId, studentId),
        eq(enrollments.role, "student"),
        eq(enrollments.state, "active")
      )
    )
    .limit(1);
  if (!studentEnrollment) throw new Error("Student unavailable.");

  const now = new Date();
  const scope = and(
    eq(submissions.orgId, tenant.orgId),
    eq(submissions.assignmentId, assignment.id),
    eq(submissions.courseId, course.id),
    eq(submissions.userId, studentId)
  );

  const [existing] = await db.select({ userId: submissions.userId }).from(submissions).where(scope).limit(1);

  /* Clearing the box clears the record, including who wrote it and when. */
  const values = feedback
    ? { feedback, feedbackAt: now, feedbackById: tenant.userId }
    : { feedback: null, feedbackAt: null, feedbackById: null };

  if (existing) {
    await db.update(submissions).set(values).where(scope);
  } else {
    /*
     * Feedback can precede a submission: a note on work that has not arrived
     * is still the instructor's record of the conversation.
     */
    await db.insert(submissions).values({
      orgId: tenant.orgId,
      assignmentId: assignment.id,
      courseId: course.id,
      userId: studentId,
      ...values,
    });
  }

  revalidatePath(returnTo);
  revalidatePath(`/teach/assignments/${assignmentId}`);
  revalidatePath(`/teach/student/${studentId}`);
  revalidatePath(`/student/assignments/${assignmentId}`);
  redirect(returnTo);
}

function safeReturnPath(value: FormDataEntryValue | null, assignmentId: string, studentId: string): string {
  const path = String(value ?? "");
  if (path.startsWith("/") && !path.startsWith("//")) return path;
  return `/teach/assignments/${assignmentId}/submissions/${studentId}`;
}
