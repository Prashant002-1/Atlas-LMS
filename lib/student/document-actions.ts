"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { createUploadedPersonalDocument } from "@/lib/course/documents";
import { createStudentAtlasSession, loadStudentAtlasSession } from "@/lib/agent/student-atlas";
import { loadActiveOrgAgentPolicy } from "@/lib/agent/org-policy";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function uploadStudentAtlasDocument(formData: FormData) {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || !user.orgId || user.role !== "student") {
    throw new Error("Sign in as a student to attach a document.");
  }

  const orgPolicy = await loadActiveOrgAgentPolicy(user.orgId);
  if (!orgPolicy.policy.studentAgentEnabled) {
    throw new Error(`${orgPolicy.policy.authorityLabel} has not enabled Atlas for students.`);
  }

  const requestedId = String(formData.get("sessionId") ?? "new");
  if (requestedId !== "new" && !UUID_PATTERN.test(requestedId)) {
    throw new Error("That personal Atlas thread is invalid.");
  }
  const scope = { orgId: user.orgId, studentId: user.id };
  const thread = requestedId === "new"
    ? await createStudentAtlasSession(scope)
    : await loadStudentAtlasSession(scope, requestedId);
  if (!thread) throw new Error("That personal Atlas thread is not yours.");

  const value = formData.get("file");
  if (!(value instanceof File)) throw new Error("Choose a document to attach.");
  const created = await createUploadedPersonalDocument({
    actor: { id: user.id, orgId: user.orgId, role: user.role },
    sessionId: thread.id,
    file: value,
  });

  revalidatePath("/student/atlas");
  return {
    sessionId: thread.id,
    attachmentId: created.attachmentId,
    fileId: created.fileId,
    displayName: created.displayName,
    filename: created.filename,
    processingStatus: created.processingStatus,
  };
}
