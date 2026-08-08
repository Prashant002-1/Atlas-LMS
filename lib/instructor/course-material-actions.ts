"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { isInstructorLike } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { assignments, files, moduleItems, modules } from "@/lib/db/schema";
import { courseMaterialRecords, documentAttachments } from "@/lib/db/course-agent-schema";
import { createUploadedCourseMaterial, isDocumentFilename } from "@/lib/course/documents";
import { findEditableCourse } from "@/lib/instructor/workspace";
import {
  classifyCourseMaterial,
  normalizeCourseMaterialLink,
} from "@/lib/course/materials";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const MODULE_RETURN_PATH = /^\/teach\/week\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

type MaterialPlacement = {
  moduleId: string | null;
  assignmentId: string | null;
};

export async function uploadCourseMaterial(formData: FormData) {
  const actor = await requireInstructorActor();
  const course = await findEditableCourse(actor);
  if (!course) throw new Error("No editable course found for this instructor.");

  const value = formData.get("file");
  if (!(value instanceof File)) throw new Error("Choose a course material to upload.");
  const displayName = compactOptional(formData.get("displayName"), 240) ?? value.name;
  const visibility = visibilityField(formData.get("visibility"));
  const placement = materialPlacementFields(formData);
  const returnTo = materialReturnPath(formData.get("returnTo"));

  await createUploadedCourseMaterial({
    actor,
    courseId: course.id,
    file: value,
    displayName,
    visibility,
    target: placement.assignmentId ? { type: "assignment", id: placement.assignmentId } : undefined,
    moduleId: placement.moduleId ?? undefined,
  });

  refreshCourseMaterials(course.id, placement);
  redirect(returnTo);
}

export async function addLinkedCourseMaterial(formData: FormData) {
  const actor = await requireInstructorActor();
  const course = await findEditableCourse(actor);
  if (!course) throw new Error("No editable course found for this instructor.");

  const displayName = compactRequired(formData.get("displayName"), "Material name is required.", 240);
  const sourceUrl = normalizeCourseMaterialLink(
    compactRequired(formData.get("sourceUrl"), "Material URL is required.", 2000)
  );
  const visibility = visibilityField(formData.get("visibility"));
  const placement = materialPlacementFields(formData);
  const returnTo = materialReturnPath(formData.get("returnTo"));

  await assertMaterialPlacement({ actor, courseId: course.id, placement });

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
        url: sourceUrl,
        extractedText: null,
      })
      .returning({ id: files.id });

    const [material] = await tx
      .insert(courseMaterialRecords)
      .values({
        orgId: actor.orgId,
        courseId: course.id,
        fileId: createdFile.id,
        materialKind: "link",
        ingestionSource: "external",
        processingStatus: "ready",
        visibility,
        checksumSha256: null,
        metadata: {},
        updatedById: actor.id,
      })
      .returning({ id: courseMaterialRecords.id });

    await tx.insert(documentAttachments).values({
      orgId: actor.orgId,
      courseId: course.id,
      fileId: createdFile.id,
      courseMaterialId: material.id,
      createdById: actor.id,
    });

    if (placement.assignmentId) {
      await tx.insert(documentAttachments).values({
        orgId: actor.orgId,
        courseId: course.id,
        fileId: createdFile.id,
        assignmentId: placement.assignmentId,
        createdById: actor.id,
      });
    }

    if (placement.moduleId) {
      const [lastItem] = await tx
        .select({ position: moduleItems.position })
        .from(moduleItems)
        .where(
          and(
            eq(moduleItems.orgId, actor.orgId),
            eq(moduleItems.courseId, course.id),
            eq(moduleItems.moduleId, placement.moduleId)
          )
        )
        .orderBy(desc(moduleItems.position))
        .limit(1);
      await tx.insert(moduleItems).values({
        orgId: actor.orgId,
        courseId: course.id,
        moduleId: placement.moduleId,
        title: displayName,
        type: "ExternalUrl",
        contentId: createdFile.id,
        position: (lastItem?.position ?? 0) + 1,
        published: visibility === "course",
      });
    }
  });

  refreshCourseMaterials(course.id, placement);
  redirect(returnTo);
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
    await db.transaction(async (tx) => {
      await tx
        .update(courseMaterialRecords)
        .set({ visibility, updatedById: actor.id, updatedAt: new Date() })
        .where(
          and(
            eq(courseMaterialRecords.id, material.recordId!),
            eq(courseMaterialRecords.orgId, actor.orgId),
            eq(courseMaterialRecords.courseId, course.id)
          )
        );
      if (isDocumentFilename(material.filename ?? material.displayName)) {
        await tx.insert(documentAttachments).values({
          orgId: actor.orgId,
          courseId: course.id,
          fileId: material.fileId,
          courseMaterialId: material.recordId,
          createdById: actor.id,
        }).onConflictDoNothing();
      }
    });
  } else {
    await db.transaction(async (tx) => {
      const [created] = await tx.insert(courseMaterialRecords).values({
        orgId: actor.orgId,
        courseId: course.id,
        fileId: material.fileId,
        materialKind: classifyCourseMaterial(material.filename ?? material.displayName, material.contentType).kind,
        ingestionSource: "lms_import",
        processingStatus: "ready",
        visibility,
        metadata: {},
        updatedById: actor.id,
      }).returning({ id: courseMaterialRecords.id });
      if (isDocumentFilename(material.filename ?? material.displayName)) {
        await tx.insert(documentAttachments).values({
          orgId: actor.orgId,
          courseId: course.id,
          fileId: material.fileId,
          courseMaterialId: created.id,
          createdById: actor.id,
        });
      }
    });
  }

  refreshCourseMaterials(course.id);
  redirect("/teach/materials");
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

function compactRequired(value: FormDataEntryValue | null, message: string, maxLength: number) {
  const text = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  if (!text) throw new Error(message);
  return text.slice(0, maxLength);
}

function compactOptional(value: FormDataEntryValue | null, maxLength: number) {
  const text = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return text ? text.slice(0, maxLength) : null;
}

function materialPlacementFields(formData: FormData): MaterialPlacement {
  const moduleId = optionalUuid(formData.get("moduleId"), "module");
  const assignmentId = optionalUuid(formData.get("assignmentId"), "assignment");
  if (!moduleId && !assignmentId) throw new Error("Attach this material to a module or assignment.");
  return { moduleId, assignmentId };
}

function optionalUuid(value: FormDataEntryValue | null, label: string) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return null;
  if (!UUID.test(text)) throw new Error(`Choose a valid ${label}.`);
  return text;
}

async function assertMaterialPlacement(args: {
  actor: { id: string; orgId: string; role: string };
  courseId: string;
  placement: MaterialPlacement;
}) {
  const [moduleRow, assignmentRow] = await Promise.all([
    args.placement.moduleId
      ? db
          .select({ id: modules.id })
          .from(modules)
          .where(
            and(
              eq(modules.id, args.placement.moduleId),
              eq(modules.orgId, args.actor.orgId),
              eq(modules.courseId, args.courseId)
            )
          )
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
    args.placement.assignmentId
      ? db
          .select({ id: assignments.id })
          .from(assignments)
          .where(
            and(
              eq(assignments.id, args.placement.assignmentId),
              eq(assignments.orgId, args.actor.orgId),
              eq(assignments.courseId, args.courseId)
            )
          )
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
  ]);
  if (args.placement.moduleId && !moduleRow) throw new Error("That module is not in this course.");
  if (args.placement.assignmentId && !assignmentRow) throw new Error("That assignment is not in this course.");
}

function materialReturnPath(value: FormDataEntryValue | null) {
  const path = typeof value === "string" ? value : "";
  if (path === "/teach/materials") return path;
  if (MODULE_RETURN_PATH.test(path)) return path;
  return "/teach/materials";
}

function refreshCourseMaterials(courseId: string, placement: MaterialPlacement = { moduleId: null, assignmentId: null }) {
  revalidatePath("/teach/materials");
  revalidatePath("/teach/course");
  revalidatePath("/teach/atlas");
  revalidatePath("/student");
  revalidatePath(`/student/course/${courseId}`);
  revalidatePath(`/student/course/${courseId}/modules`);
  if (placement.moduleId) {
    revalidatePath(`/teach/week/${placement.moduleId}`);
    revalidatePath(`/student/material/${placement.moduleId}`);
  }
  if (placement.assignmentId) {
    revalidatePath(`/teach/assignments/${placement.assignmentId}`);
    revalidatePath(`/student/assignments/${placement.assignmentId}`);
  }
}
