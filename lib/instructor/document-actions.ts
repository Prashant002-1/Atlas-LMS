"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isInstructorLike } from "@/lib/auth/session";
import { createUploadedDocument } from "@/lib/course/documents";
import { findEditableCourse } from "@/lib/instructor/workspace";

export async function uploadOwnedDocument(formData: FormData) {
  const { actor, courseId } = await requireInstructorCourse();
  const file = documentFile(formData);
  const ownerType = String(formData.get("ownerType") ?? "");
  const ownerId = String(formData.get("ownerId") ?? "");
  const returnTo = safeReturnTo(formData.get("returnTo"));

  const target =
    ownerType === "syllabus"
      ? { type: "syllabus" as const, id: ownerId }
      : ownerType === "assignment"
        ? { type: "assignment" as const, id: ownerId }
        : null;
  if (!target) throw new Error("Choose a syllabus or assignment for this document.");

  await createUploadedDocument({
    actor,
    courseId,
    file,
    displayName: compactOptional(formData.get("displayName")),
    visibility: "course",
    target,
  });

  revalidatePath(returnTo);
  revalidatePath("/teach/materials");
  redirect(returnTo);
}

export async function uploadProfessorChatDocument(formData: FormData) {
  const { actor, courseId } = await requireInstructorCourse();
  const file = documentFile(formData);
  const created = await createUploadedDocument({
    actor,
    courseId,
    file,
    displayName: compactOptional(formData.get("displayName")),
    visibility: "instructors",
  });
  revalidatePath("/teach/materials");
  return {
    attachmentId: created.attachmentId,
    fileId: created.fileId,
    displayName: created.displayName,
    filename: created.filename,
    contentType: created.contentType,
    sizeBytes: created.sizeBytes,
    processingStatus: created.processingStatus,
    processingError: created.processingError,
  };
}

async function requireInstructorCourse() {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || !user.orgId || !isInstructorLike(user.role)) redirect("/sign-in");
  const actor = { id: user.id, orgId: user.orgId, role: user.role };
  const course = await findEditableCourse(actor);
  if (!course) throw new Error("No editable course found for this instructor.");
  return { actor, courseId: course.id };
}

function documentFile(formData: FormData) {
  const value = formData.get("file");
  if (!(value instanceof File)) throw new Error("Choose a document to attach.");
  return value;
}

function compactOptional(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return text ? text.slice(0, 240) : null;
}

function safeReturnTo(value: FormDataEntryValue | null) {
  const path = typeof value === "string" ? value : "";
  if (!path.startsWith("/teach/") || path.startsWith("//")) return "/teach/materials";
  return path;
}
