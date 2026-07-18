import { redirect } from "next/navigation";
import { and, asc, count, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { isInstructorLike } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { assignments, courses, enrollments, files, modules, pages, quizzes } from "@/lib/db/schema";
import { courseMaterialRecords } from "@/lib/db/course-agent-schema";
import { classifyCourseMaterial } from "@/lib/course/materials";
import { findEditableCourse } from "@/lib/instructor/workspace";
import { updateCourseDetails } from "@/lib/instructor/actions";
import {
  addLinkedCourseMaterial,
  uploadCourseMaterial,
} from "@/lib/instructor/course-material-actions";
import { PageHeader } from "@/components/teach/page-header";
import { ActionButton, TextLink } from "@/components/atlas/primitives";
import { RecordDialog } from "@/components/teach/record-dialog";
import {
  CourseMaterialTable,
  type CourseMaterialRow,
} from "@/components/teach/course-material-table";

/**
 * Course setup is a read-first operational view of the course identity,
 * offering, syllabus, structure, and knowledge sources. Editing and material
 * intake open focused dialogs instead of leaving permanent forms on the page.
 */
export default async function TeachCourseSetupPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  if (!isInstructorLike(session.user.role)) redirect("/student");
  if (!session.user.orgId) redirect("/teach");

  const scoped = await findEditableCourse({ id: session.user.id, orgId: session.user.orgId, role: session.user.role });
  if (!scoped) redirect("/teach");

  const [course] = await db
    .select({
      id: courses.id,
      code: courses.code,
      name: courses.name,
      term: courses.term,
      description: courses.description,
      syllabusMd: courses.syllabusMd,
      status: courses.status,
      startDate: courses.startDate,
      endDate: courses.endDate,
      timeZone: courses.timeZone,
      importSource: courses.importSource,
      updatedAt: courses.updatedAt,
    })
    .from(courses)
    .where(and(eq(courses.orgId, session.user.orgId), eq(courses.id, scoped.id)))
    .limit(1);
  if (!course) redirect("/teach");

  const [rosterRows, assignmentRows, moduleRows, pageRows, quizRows, materialRows] = await Promise.all([
    db
      .select({ value: count() })
      .from(enrollments)
      .where(and(eq(enrollments.orgId, session.user.orgId), eq(enrollments.courseId, course.id), eq(enrollments.role, "student"), eq(enrollments.state, "active"))),
    db.select({ value: count() }).from(assignments).where(and(eq(assignments.orgId, session.user.orgId), eq(assignments.courseId, course.id))),
    db.select({ value: count() }).from(modules).where(and(eq(modules.orgId, session.user.orgId), eq(modules.courseId, course.id))),
    db.select({ value: count() }).from(pages).where(and(eq(pages.orgId, session.user.orgId), eq(pages.courseId, course.id))),
    db.select({ value: count() }).from(quizzes).where(and(eq(quizzes.orgId, session.user.orgId), eq(quizzes.courseId, course.id))),
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
      .orderBy(asc(files.displayName)),
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
    };
  });
  const readyMaterials = materials.filter((material) => material.processingStatus === "ready").length;
  const courseVisibleMaterials = materials.filter((material) => material.visibility === "course").length;

  return (
    <>
      <PageHeader
        title="Course setup"
        course={`${course.code} / ${course.term ?? ""}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <EditCourseDialog course={course} />
            <AddMaterialDialog />
          </div>
        }
      />

      <section aria-labelledby="course-overview-heading" className="border-b border-[var(--color-border)] pb-7">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,0.34fr)]">
          <div className="min-w-0">
            <h2 id="course-overview-heading" className="text-[1.125rem] font-semibold text-[var(--color-ink)]">{course.name}</h2>
            <p className="mt-2 max-w-3xl text-[0.84375rem] leading-6 text-[var(--color-muted)]">
              {course.description?.trim() || "No course description has been added."}
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-x-5 gap-y-4 text-[0.78125rem]">
            <CourseFact label="Code" value={course.code} mono />
            <CourseFact label="Status" value={course.status === "published" ? "Published" : titleCase(course.status)} />
            <CourseFact label="Term" value={course.term ?? "Not set"} />
            <CourseFact label="Time zone" value={course.timeZone ?? "Not set"} />
            <CourseFact label="Starts" value={course.startDate ? longDate(course.startDate) : "Not set"} />
            <CourseFact label="Ends" value={course.endDate ? longDate(course.endDate) : "Not set"} />
            <CourseFact label="Source" value={course.importSource ? titleCase(course.importSource.replaceAll("_", " ")) : "Created in Atlas"} />
          </dl>
        </div>

        <dl className="mt-7 grid border-y border-[var(--color-border)] sm:grid-cols-3 lg:grid-cols-6">
          <CountFact label="Students" value={Number(rosterRows[0]?.value ?? 0)} href="/teach/students" />
          <CountFact label="Modules" value={Number(moduleRows[0]?.value ?? 0)} href="/teach/weeks" />
          <CountFact label="Assignments" value={Number(assignmentRows[0]?.value ?? 0)} href="/teach/work" />
          <CountFact label="Pages" value={Number(pageRows[0]?.value ?? 0)} />
          <CountFact label="Assessments" value={Number(quizRows[0]?.value ?? 0)} />
          <CountFact label="Materials" value={materials.length} href="#materials" />
        </dl>
      </section>

      <section id="materials" aria-labelledby="materials-heading" className="scroll-mt-6 border-b border-[var(--color-border)] py-8">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="materials-heading" className="text-[1rem] font-semibold text-[var(--color-ink)]">Course materials</h2>
            <p className="mt-1 text-[0.75rem] text-[var(--color-muted)]">
              {readyMaterials} ready / {courseVisibleMaterials} available to students / {materials.length} total
            </p>
          </div>
          <p className="max-w-xl text-right text-[0.71875rem] leading-5 text-[var(--color-faint)]">
            Ready extracted material is available to Atlas. Access controls what students can receive in course context.
          </p>
        </div>
        {materials.length > 0 ? (
          <CourseMaterialTable rows={materials} />
        ) : (
          <p className="border-y border-[var(--color-border)] px-3 py-8 text-center text-[0.8125rem] text-[var(--color-muted)]">
            No course materials have been added.
          </p>
        )}
      </section>

      <section aria-labelledby="syllabus-heading" className="py-8">
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2 id="syllabus-heading" className="text-[1rem] font-semibold text-[var(--color-ink)]">Syllabus</h2>
          <span className="text-[0.6875rem] text-[var(--color-faint)]">Updated {longDate(course.updatedAt)}</span>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5 border-y border-[var(--color-border)] px-3 py-3.5">
          <p className="text-[0.8125rem] text-[var(--color-muted)]">{syllabusFact(course.syllabusMd)}</p>
          <TextLink href="/teach/syllabus" className="text-[0.78125rem]">Open the syllabus</TextLink>
        </div>
      </section>
    </>
  );
}

function EditCourseDialog({ course }: { course: { name: string; description: string | null } }) {
  return (
    <RecordDialog
      mode="edit"
      triggerLabel="Edit course"
      title="Edit course"
      description="Update the student-facing course name and description. Offering dates and course codes are managed by the institution."
      triggerVariant="secondary"
    >
      <form action={updateCourseDetails} className="grid gap-4">
        <label className="grid gap-1.5 text-[0.75rem] font-medium">
          Name
          <input name="name" type="text" required autoFocus maxLength={200} defaultValue={course.name} className={fieldClass} />
        </label>
        <label className="grid gap-1.5 text-[0.75rem] font-medium">
          Description
          <textarea name="description" rows={4} maxLength={2000} defaultValue={course.description ?? ""} className={`${fieldClass} min-h-24 resize-y py-2.5 leading-6`} />
        </label>
        <div className="flex justify-end border-t border-[var(--color-border)] pt-4">
          <ActionButton>Save course</ActionButton>
        </div>
      </form>
    </RecordDialog>
  );
}

function AddMaterialDialog() {
  return (
    <RecordDialog
      mode="create"
      triggerLabel="Add material"
      title="Add course material"
      description="Upload source material or add an HTTPS link. Atlas processes documents, slides, assessments, media, Common Cartridge, and QTI packages for course grounding."
      triggerVariant="primary"
    >
      <div className="space-y-7">
        <form action={uploadCourseMaterial} className="grid gap-4">
          <div>
            <h3 className="text-[0.875rem] font-semibold text-[var(--color-ink)]">Upload</h3>
            <p className="mt-1 text-[0.71875rem] leading-5 text-[var(--color-muted)]">PDF, Office, text, media, .imscc, QTI/XML, or ZIP. Maximum 25 MB.</p>
          </div>
          <label className="grid gap-1.5 text-[0.75rem] font-medium">
            File
            <input name="file" type="file" required accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.md,.rtf,.mp3,.m4a,.wav,.mp4,.mov,.webm,.imscc,.xml,.qti,.zip" className={`${fieldClass} file:mr-3 file:border-0 file:bg-transparent file:text-[0.75rem] file:font-medium file:text-[var(--color-ink)]`} />
          </label>
          <label className="grid gap-1.5 text-[0.75rem] font-medium">
            Display name <span className="font-normal text-[var(--color-faint)]">Optional</span>
            <input name="displayName" type="text" maxLength={240} placeholder="Uses the file name when empty" className={fieldClass} />
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

        <form action={addLinkedCourseMaterial} className="grid gap-4 border-t border-[var(--color-border)] pt-6">
          <div>
            <h3 className="text-[0.875rem] font-semibold text-[var(--color-ink)]">Link</h3>
            <p className="mt-1 text-[0.71875rem] leading-5 text-[var(--color-muted)]">Add a stable HTTPS source for Atlas to process and cite.</p>
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

function CourseFact({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[0.6875rem] text-[var(--color-faint)]">{label}</dt>
      <dd className={`mt-1 font-medium text-[var(--color-ink)] ${mono ? "atlas-mono" : ""}`}>{value}</dd>
    </div>
  );
}

function CountFact({ label, value, href }: { label: string; value: number; href?: string }) {
  return (
    <div className="border-b border-[var(--color-border)] px-4 py-3.5 first:pl-0 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <dt className="text-[0.6875rem] text-[var(--color-faint)]">
        {href ? <TextLink href={href} className="text-[0.6875rem]">{label}</TextLink> : label}
      </dt>
      <dd className="mt-1 text-[1rem] font-semibold tabular-nums text-[var(--color-ink)]">{value}</dd>
    </div>
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

function syllabusFact(syllabusMd: string | null): string {
  const text = syllabusMd?.trim();
  if (!text) return "No syllabus text yet.";
  const words = text.split(/\s+/).length;
  return `${words.toLocaleString("en-US")} ${words === 1 ? "word" : "words"}`;
}

function longDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const fieldClass = "min-h-10 rounded-control border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 text-[0.8125rem] text-[var(--color-ink)] outline-none transition placeholder:text-[var(--color-faint)] focus:border-[var(--color-accent-strong)] focus:bg-[var(--color-surface)]";
