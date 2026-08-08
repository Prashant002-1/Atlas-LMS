import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { redirect } from "next/navigation";
import { ActionButton, BackLink, StatusBadge } from "@/components/atlas/primitives";
import { AddMaterialDialog } from "@/components/teach/add-material-dialog";
import { EmptyRecord } from "@/components/atlas/record";
import { PageHeader } from "@/components/teach/page-header";
import { ModuleSwitcher } from "@/components/teach/module-switcher";
import { NewAssignmentDialog } from "@/components/teach/new-assignment-dialog";
import { RecordDialog } from "@/components/teach/record-dialog";
import { RichTextEditor } from "@/components/teach/rich-text-editor";
import { auth } from "@/lib/auth";
import { isInstructorLike } from "@/lib/auth/session";
import { publishModule, updateModuleRecord } from "@/lib/instructor/actions";
import { loadModuleNavigation } from "@/lib/instructor/module-navigation";
import { loadModuleContents, type ModuleContentItem } from "@/lib/instructor/module-contents";
import { loadCourseMaterialPlacementOptions, type CourseMaterialPlacementOptions } from "@/lib/instructor/course-material-options";
import { loadInstructorModuleWorkspace, type InstructorAssignment, type InstructorModuleWorkspace } from "@/lib/instructor/workspace";
import { markdownPreview } from "@/lib/markdown-presentation";
import { withModuleContext } from "@/lib/module-navigation-context";
import { Markdown } from "@/components/agent/markdown";

/**
 * One module, which is one week of the course.
 *
 * A week is not a title and a paragraph. It is the readings, the handouts, the
 * slides, and the work due, and a professor opening week three expects to find
 * all of it here. The page previously listed only assignments, so everything
 * else a week contains had to be hunted for in the materials library.
 */
export default async function InstructorWeekPage({ params }: { params: Promise<{ moduleId: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  if (!isInstructorLike(session.user.role)) redirect("/student");

  const { moduleId } = await params;
  const [workspace, modules] = await Promise.all([
    loadInstructorModuleWorkspace(session.user, moduleId),
    loadModuleNavigation(session.user),
  ]);

  const contents =
    session.user.orgId && workspace.course.id && workspace.module
      ? await loadModuleContents({
          orgId: session.user.orgId,
          courseId: workspace.course.id,
          moduleId,
        })
      : { items: [], documents: [], pages: [] };
  const placementOptions =
    session.user.orgId && workspace.course.id
      ? await loadCourseMaterialPlacementOptions({ orgId: session.user.orgId, courseId: workspace.course.id })
      : { modules: [], assignments: [] };

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <BackLink href="/teach/weeks">Modules</BackLink>
        <ModuleSwitcher modules={modules} currentId={moduleId} />
      </div>

      {workspace.problem || !workspace.module ? (
        <div className="py-5">
          <h1 className="text-[1.125rem] font-semibold text-[var(--color-ink)]">{workspace.problem?.title ?? "Module unavailable"}</h1>
          <p className="mt-1 text-[0.8125rem] leading-6 text-[var(--color-muted)]">{workspace.problem?.detail ?? "This module is not in a course you teach."}</p>
        </div>
      ) : (
        <ModuleRecord workspace={workspace} contents={contents} placementOptions={placementOptions} />
      )}
    </>
  );
}

function ModuleRecord({
  workspace,
  contents,
  placementOptions,
}: {
  workspace: InstructorModuleWorkspace;
  contents: Awaited<ReturnType<typeof loadModuleContents>>;
  placementOptions: CourseMaterialPlacementOptions;
}) {
  const courseModule = workspace.module;
  if (!courseModule || !courseModule.id) return null;
  const published = courseModule.status === "approved";
  const materials = [...contents.items.filter((item) => item.kind !== "assignment"), ...contents.pages, ...contents.documents];

  return (
    <>
      <PageHeader
        title={courseModule.title}
        course={`${workspace.course.code} / Week ${courseModule.week}`}
        action={
          <div className="flex items-center gap-2">
            {!published ? (
              <form action={publishModule}>
                <input type="hidden" name="moduleId" value={courseModule.id} />
                <input type="hidden" name="returnTo" value={`/teach/week/${courseModule.id}`} />
                <ActionButton size="sm">Publish</ActionButton>
              </form>
            ) : null}
            <EditModuleDialog module={courseModule} />
          </div>
        }
      />

      <section aria-labelledby="module-summary-heading" className="max-w-4xl">
        <h2 id="module-summary-heading" className="sr-only">Module summary</h2>
        {courseModule.summary ? (
          <Markdown className="text-[0.9375rem] leading-7 text-[var(--color-ink)]">{courseModule.summary}</Markdown>
        ) : (
          <p className="text-[0.8125rem] text-[var(--color-muted)]">No summary.</p>
        )}
        <dl className="mt-5 flex flex-wrap gap-x-6 gap-y-2 py-3 text-[0.75rem] text-[var(--color-muted)]">
          <div className="flex gap-1.5"><dt>Week</dt><dd className="font-medium text-[var(--color-ink)]">{courseModule.week}</dd></div>
          <div className="flex gap-1.5"><dt>Materials</dt><dd className="font-medium tabular-nums text-[var(--color-ink)]">{materials.length}</dd></div>
          <div className="flex gap-1.5"><dt>Assignments</dt><dd className="font-medium tabular-nums text-[var(--color-ink)]">{workspace.assignments.length}</dd></div>
          {!published ? <div className="flex gap-1.5"><dt>Status</dt><dd className="font-medium text-[var(--color-ink)]">Draft</dd></div> : null}
        </dl>
      </section>

      <ModuleMaterials items={materials} moduleId={courseModule.id} placementOptions={placementOptions} />
      <RelatedAssignments assignments={workspace.assignments} moduleId={courseModule.id} modules={placementOptions.modules} />
    </>
  );
}

/** The readings, handouts, and slides for this week, each openable. */
function ModuleMaterials({
  items,
  moduleId,
  placementOptions,
}: {
  items: ModuleContentItem[];
  moduleId: string;
  placementOptions: CourseMaterialPlacementOptions;
}) {
  return (
    <section aria-labelledby="module-materials-heading" className="mt-8">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2 id="module-materials-heading" className="text-[1rem] font-semibold text-[var(--color-ink)]">Materials</h2>
        <div className="flex items-center gap-3">
          <p className="text-[0.75rem] text-[var(--color-muted)]">{items.length} {items.length === 1 ? "item" : "items"}</p>
          <AddMaterialDialog
            options={placementOptions}
            defaultModuleId={moduleId}
            returnTo={`/teach/week/${moduleId}`}
            triggerVariant="secondary"
          />
        </div>
      </div>
      {items.length > 0 ? (
        <div className="divide-y divide-[var(--color-border)]">
          {items.map((item) => <MaterialRow key={`${item.kind}-${item.id}`} item={item} moduleId={moduleId} />)}
        </div>
      ) : (
        <p className="py-4 text-[0.8125rem] text-[var(--color-muted)]">
          No readings, documents, or slides are attached to this week yet.
        </p>
      )}
    </section>
  );
}

function MaterialRow({ item, moduleId }: { item: ModuleContentItem; moduleId: string }) {
  const external = item.href?.startsWith("https://") ?? false;
  const materialHref = item.href ? (external ? item.href : withModuleContext(item.href, moduleId)) : null;
  const linkClass = "rounded-row text-[0.8125rem] font-medium text-[var(--color-ink)] underline decoration-[color-mix(in_oklch,var(--color-ink)_25%,transparent)] underline-offset-[3px] transition hover:text-[var(--color-accent-strong)]";
  return (
    <div className="group/material grid gap-2 px-3 py-3.5 transition hover:bg-[var(--color-surface-muted)] sm:grid-cols-[minmax(0,1fr)_7rem_1rem] sm:items-center">
      <div className="min-w-0">
        {materialHref ? (
          external ? (
            <a href={materialHref} target="_blank" rel="noopener noreferrer" className={linkClass}>{item.title}</a>
          ) : (
            <Link href={materialHref} className={linkClass}>{item.title}</Link>
          )
        ) : (
          <span className="text-[0.8125rem] font-medium text-[var(--color-ink)]">{item.title}</span>
        )}
        <p className="mt-0.5 text-[0.71875rem] text-[var(--color-muted)]">
          {[kindLabel(item.kind), item.detail].filter(Boolean).join(" / ")}
        </p>
      </div>
      <span className="text-[0.71875rem] text-[var(--color-muted)]">
        {item.published ? null : <StatusBadge tone="neutral">Not visible</StatusBadge>}
      </span>
      {materialHref ? (
        external ? (
          <a href={materialHref} target="_blank" rel="noopener noreferrer" aria-label={`Open ${item.title}`} className="hidden text-[var(--color-faint)] transition group-hover/material:translate-x-0.5 group-hover/material:text-[var(--color-ink)] sm:block">
            <ChevronRight size={15} aria-hidden />
          </a>
        ) : (
          <Link href={materialHref} aria-label={`Open ${item.title}`} className="hidden text-[var(--color-faint)] transition group-hover/material:translate-x-0.5 group-hover/material:text-[var(--color-ink)] sm:block">
            <ChevronRight size={15} aria-hidden />
          </Link>
        )
      ) : null}
    </div>
  );
}

function EditModuleDialog({ module }: { module: NonNullable<InstructorModuleWorkspace["module"]> }) {
  if (!module.id) return null;
  return (
    <RecordDialog mode="edit" triggerLabel="Edit module" title="Edit module" triggerVariant="secondary" wide>
      <form action={updateModuleRecord} className="grid gap-4">
        <input type="hidden" name="moduleId" value={module.id} />
        <input type="hidden" name="returnTo" value={`/teach/week/${module.id}`} />
        {module.objectiveCodes.map((code) => <input key={code} type="hidden" name="objectiveCode" value={code} />)}
        <label className="grid gap-1.5 text-[0.75rem] font-medium text-[var(--color-ink)]">
          Title
          <input name="title" type="text" defaultValue={module.title} required autoFocus className={fieldClass} />
        </label>
        {/* The week's brief is prose students read, so it gets the formatted box. */}
        <RichTextEditor name="summary" label="Summary" defaultValue={module.summary ?? ""} rows={10} maxLength={2400} />
        <div className="flex justify-end pt-4"><ActionButton>Save module</ActionButton></div>
      </form>
    </RecordDialog>
  );
}

function RelatedAssignments({
  assignments,
  moduleId,
  modules,
}: {
  assignments: InstructorAssignment[];
  moduleId: string;
  modules: CourseMaterialPlacementOptions["modules"];
}) {
  return (
    <section aria-labelledby="module-assignments-heading" className="mt-8">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2 id="module-assignments-heading" className="text-[1rem] font-semibold text-[var(--color-ink)]">Assignments</h2>
        <div className="flex items-center gap-3">
          <p className="text-[0.75rem] text-[var(--color-muted)]">{assignments.length} {assignments.length === 1 ? "assignment" : "assignments"}</p>
          <NewAssignmentDialog modules={modules} defaultModuleId={moduleId} triggerVariant="secondary" />
        </div>
      </div>
      {assignments.length > 0 ? (
        <div className="divide-y divide-[var(--color-border)]">
          {assignments.map((assignment) => <AssignmentRow key={assignment.id ?? assignment.title} assignment={assignment} moduleId={moduleId} />)}
        </div>
      ) : (
        <div><EmptyRecord title="No assignments" /></div>
      )}
    </section>
  );
}

function AssignmentRow({ assignment, moduleId }: { assignment: InstructorAssignment; moduleId: string }) {
  const assignmentHref = assignment.id
    ? withModuleContext(`/teach/assignments/${assignment.id}`, moduleId)
    : null;

  return (
    <div className="group/assignment grid gap-2 px-3 py-3.5 transition hover:bg-[var(--color-surface-muted)] sm:grid-cols-[minmax(0,1fr)_8rem_5rem_1rem] sm:items-center">
      <div className="min-w-0">
        {assignmentHref ? <Link href={assignmentHref} className="rounded-row text-[0.8125rem] font-semibold text-[var(--color-ink)] underline decoration-[color-mix(in_oklch,var(--color-ink)_25%,transparent)] underline-offset-[3px] hover:text-[var(--color-accent-strong)]">{assignment.title}</Link> : <span className="text-[0.8125rem] font-semibold">{assignment.title}</span>}
        {assignment.detail ? <p className="mt-0.5 truncate text-[0.75rem] text-[var(--color-muted)]">{markdownPreview(assignment.detail, assignment.title)}</p> : null}
      </div>
      <span className="text-[0.75rem] tabular-nums text-[var(--color-muted)]">{assignment.dueAt ? assignment.dueAt.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "No due date"}</span>
      <span className="text-right text-[0.75rem] tabular-nums text-[var(--color-muted)]">{typeof assignment.points === "number" ? `${Math.round(assignment.points)} pts` : "-"}</span>
      {assignmentHref ? <Link href={assignmentHref} aria-label={`Open ${assignment.title}`} className="hidden text-[var(--color-faint)] transition group-hover/assignment:translate-x-0.5 group-hover/assignment:text-[var(--color-ink)] sm:block"><ChevronRight size={15} aria-hidden /></Link> : null}
    </div>
  );
}

function kindLabel(kind: ModuleContentItem["kind"]) {
  return { page: "Reading", document: "Document", slides: "Slides", assignment: "Assignment", quiz: "Practice", link: "Link" }[kind];
}

const fieldClass = "min-h-10 rounded-control border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 text-[0.8125rem] text-[var(--color-ink)] outline-none transition focus:border-[var(--color-accent-strong)] focus:bg-[var(--color-surface)]";
