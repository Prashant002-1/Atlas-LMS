"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { assignments, chatSessions, enrollments, submissions } from "@/lib/db/schema";
import { practiceBaseForObjective } from "@/lib/practice/base";
import {
  loadStudentWorkspace,
  type StudentAssignment,
  type StudentMaterial,
  type StudentObjective,
  type StudentStudyPackage,
  type StudentWorkspace,
} from "@/lib/student/workspace";

type StoredMessage = Record<string, unknown>;

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

export async function saveStudyCommand(formData: FormData) {
  const user = await requireStudentActor();
  const message = String(formData.get("message") ?? "").trim();

  if (message.length < 3) {
    throw new Error("Message is too short.");
  }

  const [enrollment] = await db
    .select({ courseId: enrollments.courseId })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.orgId, user.orgId),
        eq(enrollments.userId, user.id),
        eq(enrollments.role, "student"),
        eq(enrollments.state, "active")
      )
    )
    .orderBy(desc(enrollments.createdAt))
    .limit(1);

  if (!enrollment) {
    throw new Error("Course unavailable.");
  }

  const [session] = await db
    .select({ id: chatSessions.id, messages: chatSessions.messages })
    .from(chatSessions)
    .where(
      and(
        eq(chatSessions.orgId, user.orgId),
        eq(chatSessions.userId, user.id),
        eq(chatSessions.courseId, enrollment.courseId),
        eq(chatSessions.persona, "student")
      )
    )
    .orderBy(desc(chatSessions.updatedAt))
    .limit(1);

  const now = new Date();
  const studyPackage = buildStudyPackage(message, await loadStudentWorkspace({ ...user, role: "student" }));
  const entry = {
    id: `msg_${randomUUID()}`,
    role: "user",
    metadata: { atlas: { kind: "study_request", createdAt: now.toISOString() } },
    parts: [{ type: "text", text: message }],
  };
  const response = {
    id: `msg_${randomUUID()}`,
    role: "assistant",
    metadata: { atlas: { kind: "study_package", createdAt: now.toISOString(), package: studyPackage } },
    parts: [{ type: "text", text: studyPackage.summary }],
  };

  if (session) {
    await db
      .update(chatSessions)
      .set({ messages: [...storedMessages(session.messages), entry, response] as object, updatedAt: now })
      .where(eq(chatSessions.id, session.id));
  } else {
    await db.insert(chatSessions).values({
      orgId: user.orgId,
      userId: user.id,
      courseId: enrollment.courseId,
      persona: "student",
      title: "Study",
      messages: [entry, response],
      updatedAt: now,
    });
  }

  revalidatePath("/student");
  redirect("/student#today");
}

function assignmentReturnPath(value: FormDataEntryValue | null, assignmentId: string) {
  const path = typeof value === "string" ? value : "";
  return path === `/student/work/${assignmentId}` ? path : "/student";
}

function storedMessages(value: unknown): StoredMessage[] {
  if (!Array.isArray(value)) return [];
  return value.filter((message): message is StoredMessage => Boolean(message) && typeof message === "object");
}

function buildStudyPackage(request: string, workspace: StudentWorkspace): StudentStudyPackage {
  const focus = requestedObjective(request, workspace) ?? workspace.focus;
  const base = practiceBaseForObjective(focus.code);
  const material = bestMaterial(focus, workspace.materials);
  const assignment = bestAssignment(focus, workspace.assignments);
  const courseBase = coursePracticeBase(material, assignment, base);
  const variant = requestedVariant(request, courseBase.variants) ?? courseBase.variants[0] ?? "Work one grounded example";
  const review = material ? material.title : focus.title;
  const doText = assignment ? assignment.name : "Write a short response";

  return {
    id: `pkg_${randomUUID()}`,
    request,
    title: courseBase.title,
    summary: `Review ${review}, try ${variant.toLowerCase()}, then use ${doText} to save the work.`,
    review,
    reviewHref: material?.id ? `/student/material/${material.id}` : undefined,
    practice: `${variant}: use ${courseBase.dataset}. ${courseBase.frame}`,
    do: doText,
    doHref: assignment?.id ? `/student/work/${assignment.id}` : undefined,
    check: `Name the evidence and write the conclusion in one sentence.`,
  };
}

function coursePracticeBase(material: StudentMaterial | undefined, assignment: StudentAssignment | undefined, fallback: ReturnType<typeof practiceBaseForObjective>) {
  const sourceText = `${material?.summary ?? ""}\n${assignment?.description ?? ""}`;
  const dataset = labeledValue(sourceText, "Base") ?? fallback.dataset;
  const shifts = splitShifts(labeledValue(sourceText, "Shifts")) ?? fallback.variants;
  const frame = stripPracticeLabels(material?.summary) ?? assignment?.description ?? fallback.frame;

  return {
    title: material?.title ?? fallback.title,
    dataset,
    frame,
    variants: shifts,
  };
}

function labeledValue(value: string, label: "Base" | "Shifts") {
  const match = value.match(new RegExp(`${label}:\\s*([^\\.\\n]+)`, "i"));
  return match?.[1]?.replace(/\s+/g, " ").trim() || undefined;
}

function splitShifts(value: string | undefined) {
  const shifts = value
    ?.split(/\s*;\s*|\s*,\s*/)
    .map((item) => item.trim())
    .filter(Boolean);
  return shifts && shifts.length > 0 ? shifts.slice(0, 4) : undefined;
}

function stripPracticeLabels(value: string | null | undefined) {
  const cleaned = value
    ?.replace(/Base:\s*[^.\n]+\.?\s*/i, "")
    .replace(/Shifts:\s*[^.\n]+\.?\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || undefined;
}

function requestedObjective(request: string, workspace: StudentWorkspace) {
  const normalized = normalize(request);
  const exact = workspace.objectives.find((objective) => normalized.includes(normalize(objective.code)));
  if (exact) return exact;

  const scored = workspace.objectives
    .map((objective) => ({
      objective,
      score: importantWords(`${objective.title} ${objective.description}`).filter((word) => normalized.includes(word)).length,
    }))
    .sort((a, b) => b.score - a.score)[0];

  return scored && scored.score > 0 ? scored.objective : undefined;
}

function bestMaterial(focus: StudentObjective, materials: StudentMaterial[]) {
  return materials.find((material) => material.objectiveCodes.includes(focus.code)) ?? materials[0];
}

function bestAssignment(focus: StudentObjective, assignments: StudentAssignment[]) {
  return (
    assignments.find((assignment) => assignment.objectiveCodes.includes(focus.code) && assignment.status !== "graded") ??
    assignments.find((assignment) => assignment.objectiveCodes.includes(focus.code)) ??
    assignments.find((assignment) => assignment.status !== "graded") ??
    assignments[0]
  );
}

function requestedVariant(request: string, variants: string[]) {
  const normalized = normalize(request);
  return variants.find((variant) => importantWords(variant).some((word) => normalized.includes(word)));
}

function importantWords(value: string) {
  return normalize(value)
    .split(" ")
    .filter((word) => word.length > 4);
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

async function requireStudentActor() {
  const session = await auth();
  const user = session?.user;

  if (!user?.id || !user.orgId || user.role !== "student") {
    redirect("/sign-in?role=student");
  }

  return { id: user.id, orgId: user.orgId };
}
