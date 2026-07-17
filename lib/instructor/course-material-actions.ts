"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { isInstructorLike } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { files } from "@/lib/db/schema";
import { courseMaterialRecords } from "@/lib/db/course-agent-schema";
import { findEditableCourse } from "@/lib/instructor/workspace";
import {
  classifyCourseMaterial,
  ingestLinkedCourseMaterial,
  ingestUploadedCourseMaterial,
  materialKinds,
  type MaterialKind,
} from "@/lib/course/materials";

export async function uploadCourseMaterial(formData: FormData) {
  const actor = await requireInstructorActor();
  const course = await findEditableCourse(actor);
  if (!course) throw new Error("No editable course found for this instructor.");

  const value = formData.get("file");
  if (!(value instanceof File)) throw new Error("Choose a course material to upload.");
  const displayName = compactOptional(formData.get("displayName"), 240) ?? value.name;
  const visibility = visibilityField(formData.get("visibility"));
  const classification = classifyCourseMaterial(value.name, value.type || null);
  const requestedKind = materialKindField(formData.get("materialKind"));
  const ingested = await ingestUploadedCourseMaterial({
    orgId: actor.orgId,
    courseId: course.id,
    uploadedById: actor.id,
    file: value,
  });

  await db.transaction(async (tx) => {
    const [createdFile] = await tx
      .insert(files)
      .values({
        orgId: actor.orgId,
        courseId: course.id,
        displayName,
        filename: value.name,
        contentType: value.type || null,
        sizeBytes: value.size,
        url: ingested.url,
        extractedText: ingested.extractedText ?? null,
      })
      .returning({ id: files.id });

    await tx.insert(courseMaterialRecords).values({
      orgId: actor.orgId,
      courseId: course.id,
      fileId: createdFile.id,
      ingestionJobId: ingested.jobId,
      materialKind: requestedKind ?? classification.kind,
      ingestionSource: classification.source,
      processingStatus: ingested.status,
      visibility,
      pageCount: ingested.pageCount ?? null,
      checksumSha256: ingested.checksumSha256,
      metadata: ingested.metadata,
      updatedById: actor.id,
    });
  });

  refreshCourseMaterials(course.id);
  redirect("/teach/course#materials");
}

export async function addLinkedCourseMaterial(formData: FormData) {
  const actor = await requireInstructorActor();
  const course = await findEditableCourse(actor);
  if (!course) throw new Error("No editable course found for this instructor.");

  const displayName = compactRequired(formData.get("displayName"), "Material name is required.", 240);
  const sourceUrl = compactRequired(formData.get("sourceUrl"), "Material URL is required.", 2000);
  const visibility = visibilityField(formData.get("visibility"));
  const ingested = await ingestLinkedCourseMaterial({
    orgId: actor.orgId,
    courseId: course.id,
    uploadedById: actor.id,
    sourceUrl,
    displayName,
  });

  await db.transaction(async (tx) => {
    const [createdFile] = await tx
      .insert(files)
      .values({
        orgId: actor.orgId,
        courseId: course.id,
        displayName,
        filename: null,
        contentType: null,
        sizeBytes: null,
        url: ingested.url,
        extractedText: ingested.extractedText ?? null,
      })
      .returning({ id: files.id });

    await tx.insert(courseMaterialRecords).values({
      orgId: actor.orgId,
      courseId: course.id,
      fileId: createdFile.id,
      ingestionJobId: ingested.jobId,
      materialKind: "link",
      ingestionSource: "external",
      processingStatus: ingested.status,
      visibility,
      pageCount: ingested.pageCount ?? null,
      checksumSha256: null,
      metadata: ingested.metadata,
      updatedById: actor.id,
    });
  });

  refreshCourseMaterials(course.id);
  redirect("/teach/course#materials");
}

export async function setCourseMaterialVisibility(formData: FormData) {
  const actor = await requireInstructorActor();
  const course = await findEditableCourse(actor);
  if (!course) throw new Error("No editable course found for this instructor.");

  const materialId = String(formData.get("materialId") ?? "");
  if (!materialId) throw new Error("No course material selected.");
  const visibility = visibilityField(formData.get("visibility"));

  const [material] = await db
    .select({
      fileId: files.id,
      filename: files.filename,
      displayName: files.displayName,
      contentType: files.contentType,
      recordId: courseMaterialRecords.id,
    })
    .from(files)
    .leftJoin(
      courseMaterialRecords,
      and(
        eq(courseMaterialRecords.fileId, files.id),
        eq(courseMaterialRecords.orgId, actor.orgId),
        eq(courseMaterialRecords.courseId, course.id)
      )
    )
    .where(and(eq(files.id, materialId), eq(files.orgId, actor.orgId), eq(files.courseId, course.id)))
    .limit(1);
  if (!material) throw new Error("That course material is unavailable.");

  if (material.recordId) {
    await db
      .update(courseMaterialRecords)
      .set({ visibility, updatedById: actor.id, updatedAt: new Date() })
      .where(
        and(
          eq(courseMaterialRecords.id, material.recordId),
          eq(courseMaterialRecords.orgId, actor.orgId),
          eq(courseMaterialRecords.courseId, course.id)
        )
      );
  } else {
    await db.insert(courseMaterialRecords).values({
      orgId: actor.orgId,
      courseId: course.id,
      fileId: material.fileId,
      materialKind: classifyCourseMaterial(material.filename ?? material.displayName, material.contentType).kind,
      ingestionSource: "lms_import",
      processingStatus: "ready",
      visibility,
      metadata: {},
      updatedById: actor.id,
    });
  }

  refreshCourseMaterials(course.id);
  redirect("/teach/course#materials");
}

async function requireInstructorActor() {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || !user.orgId || !isInstructorLike(user.role)) redirect("/sign-in");
  return { id: user.id, orgId: user.orgId, role: user.role };
}

function visibilityField(value: FormDataEntryValue | null): "course" | "instructors" {
  return value === "instructors" ? "instructors" : "course";
}

function materialKindField(value: FormDataEntryValue | null): MaterialKind | null {
  return typeof value === "string" && materialKinds.includes(value as MaterialKind) ? (value as MaterialKind) : null;
}

function compactRequired(value: FormDataEntryValue | null, message: string, maxLength: number) {
  const text = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  if (!text) throw new Error(message);
  return text.slice(0, maxLength);
}

function compactOptional(value: FormDataEntryValue | null, maxLength: number) {
  const text = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return text ? text.slice(0, maxLength) : null;
}

function refreshCourseMaterials(courseId: string) {
  revalidatePath("/teach/course");
  revalidatePath("/teach/atlas");
  revalidatePath("/student");
  revalidatePath(`/student/course/${courseId}`);
  revalidatePath(`/student/course/${courseId}/modules`);
}
