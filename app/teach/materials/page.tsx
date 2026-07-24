import { redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { isInstructorLike } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { files } from "@/lib/db/schema";
import { courseMaterialRecords } from "@/lib/db/course-agent-schema";
import { classifyCourseMaterial } from "@/lib/course/materials";
import { isDocumentFilename } from "@/lib/course/documents";
import { findEditableCourse } from "@/lib/instructor/workspace";
import {
  addLinkedCourseMaterial,
  uploadCourseMaterial,
} from "@/lib/instructor/course-material-actions";
import { PageHeader } from "@/components/teach/page-header";
import { scopeLabel } from "@/lib/workspace/term-label";
import { ActionButton } from "@/components/atlas/primitives";
import { RecordDialog } from "@/components/teach/record-dialog";
import {
  CourseMaterialTable,
  type CourseMaterialRow,
} from "@/components/teach/course-material-table";

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

  const materialRows = await db
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
    .where(and(eq(files.orgId, session.user.orgId), eq(files.courseId, course.id)))
    .orderBy(asc(files.displayName));

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
        action={<AddMaterialDialog />}
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

function AddMaterialDialog() {
  return (
    <RecordDialog
      mode="create"
      triggerLabel="Add material"
      title="Add course material"
      triggerVariant="primary"
    >
      <div className="space-y-7">
        <form action={uploadCourseMaterial} className="grid gap-4">
          <div>
            <h3 className="text-[0.875rem] font-semibold text-[var(--color-ink)]">Upload</h3>
            <p className="mt-1 text-[0.71875rem] leading-5 text-[var(--color-muted)]">PDF, Office, text, code, media, .imscc, QTI/XML, or ZIP. Maximum 25 MB.</p>
          </div>
          <label className="grid gap-1.5 text-[0.75rem] font-medium">
            File
            <input name="file" type="file" required accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.md,.rtf,.xml,.json,.jsonl,.yaml,.yml,.html,.css,.js,.jsx,.ts,.tsx,.mjs,.cjs,.py,.java,.c,.cc,.cpp,.h,.hpp,.go,.rs,.rb,.php,.swift,.kt,.kts,.sql,.sh,.zsh,.bash,.mp3,.m4a,.wav,.mp4,.mov,.webm,.imscc,.qti,.zip" className={`${fieldClass} file:mr-3 file:border-0 file:bg-transparent file:text-[0.75rem] file:font-medium file:text-[var(--color-ink)]`} />
          </label>
          <label className="grid gap-1.5 text-[0.75rem] font-medium">
            Display name <span className="font-normal text-[var(--color-faint)]">Optional</span>
            <input name="displayName" type="text" maxLength={240} className={fieldClass} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-[0.75rem] font-medium">
              Type
              <select name="materialKind" defaultValue="" className={fieldClass}>
                <option value="">Detect from file</option>
                <option value="document">Document</option>
                <option value="slides">Slides</option>
                <option value="assessment">Assessment or test</option>
                <option value="media">Media</option>
                <option value="package">Course package</option>
                <option value="other">Other</option>
              </select>
            </label>
            <VisibilityField />
          </div>
          <div className="flex justify-end">
            <ActionButton>Upload material</ActionButton>
          </div>
        </form>

        <form action={addLinkedCourseMaterial} className="grid gap-4 pt-6">
          <div>
            <h3 className="text-[0.875rem] font-semibold text-[var(--color-ink)]">Link</h3>
          </div>
          <label className="grid gap-1.5 text-[0.75rem] font-medium">
            Name
            <input name="displayName" type="text" required maxLength={240} className={fieldClass} />
          </label>
          <label className="grid gap-1.5 text-[0.75rem] font-medium">
            URL
            <input name="sourceUrl" type="url" required maxLength={2000} placeholder="https://" className={fieldClass} />
          </label>
          <VisibilityField />
          <div className="flex justify-end">
            <ActionButton variant="secondary">Add link</ActionButton>
          </div>
        </form>
      </div>
    </RecordDialog>
  );
}

function VisibilityField() {
  return (
    <label className="grid gap-1.5 text-[0.75rem] font-medium">
      Access
      <select name="visibility" defaultValue="course" className={fieldClass}>
        <option value="course">Course</option>
        <option value="instructors">Instructors only</option>
      </select>
    </label>
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

const fieldClass = "min-h-10 rounded-control border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 text-[0.8125rem] text-[var(--color-ink)] outline-none transition placeholder:text-[var(--color-faint)] focus:border-[var(--color-accent-strong)] focus:bg-[var(--color-surface)]";
