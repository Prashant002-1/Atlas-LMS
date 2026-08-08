import { redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { isInstructorLike } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { files } from "@/lib/db/schema";
import { courseMaterialRecords, documentOriginals } from "@/lib/db/course-agent-schema";
import { classifyCourseMaterial } from "@/lib/course/materials";
import { isDocumentFilename } from "@/lib/course/documents";
import { findEditableCourse } from "@/lib/instructor/workspace";
import { PageHeader } from "@/components/teach/page-header";
import { scopeLabel } from "@/lib/workspace/term-label";
import { AddMaterialDialog } from "@/components/teach/add-material-dialog";
import {
  CourseMaterialTable,
  type CourseMaterialRow,
} from "@/components/teach/course-material-table";
import { loadCourseMaterialPlacementOptions } from "@/lib/instructor/course-material-options";

/**
 * The course material library: what exists, what is ready, and what students
 * can see. Intake opens a focused dialog; state and access live on the rows.
 */
export default async function TeachMaterialsPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  if (!isInstructorLike(session.user.role)) redirect("/student");
  if (!session.user.orgId) redirect("/teach");

  const course = await findEditableCourse({ id: session.user.id, orgId: session.user.orgId, role: session.user.role });
  if (!course) redirect("/teach");

  const [materialRows, placementOptions] = await Promise.all([
    db
      .select({
        id: files.id,
        displayName: files.displayName,
        filename: files.filename,
        contentType: files.contentType,
        sizeBytes: files.sizeBytes,
        url: files.url,
        createdAt: files.createdAt,
        materialKind: courseMaterialRecords.materialKind,
        ingestionSource: courseMaterialRecords.ingestionSource,
        processingStatus: courseMaterialRecords.processingStatus,
        processingError: courseMaterialRecords.processingError,
        visibility: courseMaterialRecords.visibility,
        pageCount: courseMaterialRecords.pageCount,
        updatedAt: courseMaterialRecords.updatedAt,
        storedOriginalFileId: documentOriginals.fileId,
      })
      .from(files)
      .leftJoin(
        courseMaterialRecords,
        and(
          eq(courseMaterialRecords.fileId, files.id),
          eq(courseMaterialRecords.orgId, session.user.orgId),
          eq(courseMaterialRecords.courseId, course.id)
        )
      )
      .leftJoin(
        documentOriginals,
        and(
          eq(documentOriginals.fileId, files.id),
          eq(documentOriginals.orgId, session.user.orgId)
        )
      )
      .where(and(eq(files.orgId, session.user.orgId), eq(files.courseId, course.id)))
      .orderBy(asc(files.displayName)),
    loadCourseMaterialPlacementOptions({ orgId: session.user.orgId, courseId: course.id }),
  ]);

  const materials: CourseMaterialRow[] = materialRows.map((row) => {
    const legacy = classifyCourseMaterial(row.filename ?? row.displayName, row.contentType);
    return {
      id: row.id,
      displayName: row.displayName,
      filename: row.filename,
      contentType: row.contentType,
      sizeBytes: row.sizeBytes,
      url: safeMaterialUrl(row.url),
      materialKind: row.materialKind ?? legacy.kind,
      ingestionSource: row.ingestionSource ?? "lms_import",
      processingStatus: row.processingStatus ?? "ready",
      processingError: row.processingError,
      visibility: row.visibility ?? "course",
      pageCount: row.pageCount,
      updatedAt: (row.updatedAt ?? row.createdAt).toISOString(),
      document: isDocumentFilename(row.filename ?? row.displayName),
      storedOriginal: Boolean(row.storedOriginalFileId),
    };
  });
  const readyMaterials = materials.filter((material) => material.processingStatus === "ready").length;
  const courseVisibleMaterials = materials.filter((material) => material.visibility === "course").length;

  return (
    <>
      {/*
        The header says where you are, not how many of what. Three counts in the
        eyebrow turned a location marker into a dashboard, and the table below
        already carries state per row. The counts stay, as facts under the title.
      */}
      <PageHeader
        title="Materials"
        course={scopeLabel({ code: course.code, termName: course.term })}
        action={<AddMaterialDialog options={placementOptions} returnTo="/teach/materials" />}
      />

      {materials.length > 0 ? (
        <dl className="-mt-4 mb-7 flex flex-wrap gap-x-6 gap-y-1 text-[0.78125rem] text-[var(--color-muted)]">
          <div className="flex gap-1.5">
            <dt>Files</dt>
            <dd className="font-medium tabular-nums text-[var(--color-ink)]">{materials.length}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt>Ready</dt>
            <dd className="font-medium tabular-nums text-[var(--color-ink)]">{readyMaterials}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt>Visible to students</dt>
            <dd className="font-medium tabular-nums text-[var(--color-ink)]">{courseVisibleMaterials}</dd>
          </div>
        </dl>
      ) : null}

      {materials.length > 0 ? (
        <CourseMaterialTable rows={materials} />
      ) : (
        <p className="px-3 py-10 text-center text-[0.8125rem] text-[var(--color-muted)]">
          No course materials have been added.
        </p>
      )}
    </>
  );
}

function safeMaterialUrl(value: string | null) {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    const local = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    return !parsed.username && !parsed.password && (parsed.protocol === "https:" || (local && parsed.protocol === "http:")) ? parsed.toString() : null;
  } catch {
    return null;
  }
}
