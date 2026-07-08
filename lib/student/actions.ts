"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { assignments, enrollments, submissions } from "@/lib/db/schema";
import {
  activeStudentEnrollment,
  loadSessionAssignmentBundle,
  openLiveSession,
  studentDisplayName,
  submitSessionRecord,
} from "@/lib/agent/session-store";

export async function submitAssignment(formData: FormData) {
  const user = await requireStudentActor();
  const assignmentId = String(formData.get("assignmentId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const returnTo = assignmentReturnPath(formData.get("returnTo"), assignmentId);

  if (!assignmentId) {
    throw new Error("No assignment selected.");
  }
  if (body.length < 20) {
    throw new Error("Response is too short.");
  }

  const [assignment] = await db
    .select({ id: assignments.id, courseId: assignments.courseId })
    .from(assignments)
    .where(and(eq(assignments.id, assignmentId), eq(assignments.orgId, user.orgId), eq(assignments.published, true)))
    .limit(1);

  if (!assignment) {
    throw new Error("Assignment unavailable.");
  }

  const [enrollment] = await db
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.orgId, user.orgId),
        eq(enrollments.courseId, assignment.courseId),
        eq(enrollments.userId, user.id),
        eq(enrollments.role, "student"),
        eq(enrollments.state, "active")
      )
    )
    .limit(1);

  if (!enrollment) {
    throw new Error("Assignment unavailable.");
  }

  const now = new Date();
  const [existing] = await db
    .select({ assignmentId: submissions.assignmentId })
    .from(submissions)
    .where(
      and(
        eq(submissions.orgId, user.orgId),
        eq(submissions.assignmentId, assignment.id),
        eq(submissions.courseId, assignment.courseId),
        eq(submissions.userId, user.id)
      )
    )
    .limit(1);

  if (existing) {
    await db
      .update(submissions)
      .set({ submittedAt: now, missing: false, workflowState: "submitted", submissionType: "text", body })
      .where(
        and(
          eq(submissions.orgId, user.orgId),
          eq(submissions.assignmentId, assignment.id),
          eq(submissions.courseId, assignment.courseId),
          eq(submissions.userId, user.id)
        )
      );
  } else {
    await db.insert(submissions).values({
      orgId: user.orgId,
      assignmentId: assignment.id,
      courseId: assignment.courseId,
      userId: user.id,
      submittedAt: now,
      missing: false,
      workflowState: "submitted",
      submissionType: "text",
      body,
    });
  }

  revalidatePath("/teach");
  revalidatePath(`/teach/work/${assignment.id}`);
  revalidatePath(`/teach/student/${user.id}`);
  revalidatePath("/student");
  revalidatePath(returnTo);
  redirect(returnTo);
}


function assignmentReturnPath(value: FormDataEntryValue | null, assignmentId: string) {
  const path = typeof value === "string" ? value : "";
  return path === `/student/work/${assignmentId}` ? path : "/student";
}

/**
 * Submit a work session: freeze the open session into the durable record
 * (normalized transcript + final artifact) and reflect it on the gradebook
 * row. Idempotent; a second submit of the same session is a no-op.
 */
export async function submitSession(formData: FormData) {
  const user = await requireStudentActor();
  const assignmentId = String(formData.get("assignmentId") ?? "");
  if (!assignmentId) {
    throw new Error("No assignment selected.");
  }

  const bundle = await loadSessionAssignmentBundle(user.orgId, assignmentId);
  if (!bundle) {
    throw new Error("This assignment is not a work session.");
  }

  const enrollment = await activeStudentEnrollment(user.orgId, bundle.assignment.courseId, user.id);
  if (!enrollment) {
    throw new Error("Session unavailable.");
  }

  const session = await openLiveSession({
    orgId: user.orgId,
    userId: user.id,
    courseId: bundle.assignment.courseId,
    assignmentId: bundle.assignment.id,
  });
  if (!session) {
    throw new Error("There is no open session to submit.");
  }
  if (session.totalTurns < 1) {
    throw new Error("Work the session before submitting it.");
  }

  const studentName = await studentDisplayName(user.orgId, user.id);
  await submitSessionRecord({ session, bundle, studentName });

  revalidatePath("/teach");
  revalidatePath(`/teach/work/${bundle.assignment.id}`);
  revalidatePath(`/teach/student/${user.id}`);
  revalidatePath("/student");
  revalidatePath(`/student/work/${bundle.assignment.id}`);
  revalidatePath(`/student/session/${bundle.assignment.id}`);
  redirect(`/student/session/${bundle.assignment.id}`);
}













async function requireStudentActor() {
  const session = await auth();
  const user = session?.user;

  if (!user?.id || !user.orgId || user.role !== "student") {
    redirect("/sign-in?role=student");
  }

  return { id: user.id, orgId: user.orgId };
}
