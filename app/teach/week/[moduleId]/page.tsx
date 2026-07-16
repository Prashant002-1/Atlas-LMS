import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { redirect } from "next/navigation";
import { ActionButton, BackLink } from "@/components/atlas/primitives";
import { EmptyRecord } from "@/components/atlas/record";
import { PageHeader } from "@/components/teach/page-header";
import { ModuleSwitcher } from "@/components/teach/module-switcher";
import { RecordDialog } from "@/components/teach/record-dialog";
import { auth } from "@/lib/auth";
import { isInstructorLike } from "@/lib/auth/session";
import { publishModule, updateModuleRecord } from "@/lib/instructor/actions";
import { loadModuleNavigation } from "@/lib/instructor/module-navigation";
import { loadInstructorModuleWorkspace, type InstructorAssignment, type InstructorModuleWorkspace } from "@/lib/instructor/workspace";

export default async function InstructorWeekPage({ params }: { params: Promise<{ moduleId: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  if (!isInstructorLike(session.user.role)) redirect("/student");

  const { moduleId } = await params;
  const [workspace, modules] = await Promise.all([
    loadInstructorModuleWorkspace(session.user, moduleId),
    loadModuleNavigation(session.user),
  ]);

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <BackLink href="/teach/weeks">Modules</BackLink>
        <ModuleSwitcher modules={modules} currentId={moduleId} />
      </div>

      {workspace.problem || !workspace.module ? (
        <div className="border-y border-[var(--color-border)] py-5">
          <h1 className="text-[1.125rem] font-semibold text-[var(--color-ink)]">{workspace.problem?.title ?? "Module unavailable"}</h1>
          <p className="mt-1 text-[0.8125rem] leading-6 text-[var(--color-muted)]">{workspace.problem?.detail ?? "This module is not in a course you teach."}</p>
        </div>
      ) : (
        <ModuleRecord workspace={workspace} />
      )}
    </>
  );
}

function ModuleRecord({ workspace }: { workspace: InstructorModuleWorkspace }) {
  const module = workspace.module;
  if (!module || !module.id) return null;
  const published = module.status === "approved";

  return (
    <>
      <PageHeader
        title={module.title}
        course={`${workspace.course.code} / Module ${module.week}`}
        action={
          <div className="flex items-center gap-2">
            {!published ? (
              <form action={publishModule}>
                <input type="hidden" name="moduleId" value={module.id} />
                <input type="hidden" name="returnTo" value={`/teach/week/${module.id}`} />
                <ActionButton size="sm">Publish</ActionButton>
              </form>
            ) : null}
            <EditModuleDialog module={module} />
          </div>
        }
      />

      <section aria-labelledby="module-summary-heading" className="max-w-4xl">
        <h2 id="module-summary-heading" className="sr-only">Module summary</h2>
        {module.summary ? (
          <p className="text-[0.9375rem] leading-7 text-[var(--color-ink)]">{module.summary}</p>
        ) : (
          <p className="text-[0.8125rem] text-[var(--color-muted)]">No summary.</p>
        )}
        <dl className="mt-5 flex flex-wrap gap-x-6 gap-y-2 border-y border-[var(--color-border)] py-3 text-[0.75rem] text-[var(--color-muted)]">
          <div className="flex gap-1.5"><dt>Module</dt><dd className="font-medium text-[var(--color-ink)]">{module.week}</dd></div>
          <div className="flex gap-1.5"><dt>Assignments</dt><dd className="font-medium text-[var(--color-ink)]">{workspace.assignments.length}</dd></div>
          {!published ? <div className="flex gap-1.5"><dt>Status</dt><dd className="font-medium text-[var(--color-ink)]">Draft</dd></div> : null}
        </dl>
      </section>

      <RelatedAssignments assignments={workspace.assignments} />
    </>
  );
}

function EditModuleDialog({ module }: { module: NonNullable<InstructorModuleWorkspace["module"]> }) {
  if (!module.id) return null;
  return (
    <RecordDialog mode="edit" triggerLabel="Edit module" title="Edit module" description="Update the title and summary without leaving the module." triggerVariant="secondary">
      <form action={updateModuleRecord} className="grid gap-4">
        <input type="hidden" name="moduleId" value={module.id} />
        <input type="hidden" name="returnTo" value={`/teach/week/${module.id}`} />
        {module.objectiveCodes.map((code) => <input key={code} type="hidden" name="objectiveCode" value={code} />)}
        <label className="grid gap-1.5 text-[0.75rem] font-medium text-[var(--color-ink)]">
          Title
          <input name="title" type="text" defaultValue={module.title} required autoFocus className={fieldClass} />
        </label>
        <label className="grid gap-1.5 text-[0.75rem] font-medium text-[var(--color-ink)]">
          Summary
          <textarea name="summary" rows={10} defaultValue={module.summary ?? ""} className={`${fieldClass} min-h-56 resize-y py-3 leading-6`} />
        </label>
        <div className="flex justify-end border-t border-[var(--color-border)] pt-4"><ActionButton>Save module</ActionButton></div>
      </form>
    </RecordDialog>
  );
}

function RelatedAssignments({ assignments }: { assignments: InstructorAssignment[] }) {
  return (
    <section aria-labelledby="module-assignments-heading" className="mt-8">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2 id="module-assignments-heading" className="text-[1rem] font-semibold text-[var(--color-ink)]">Assignments</h2>
        <p className="text-[0.75rem] text-[var(--color-muted)]">{assignments.length} {assignments.length === 1 ? "assignment" : "assignments"}</p>
      </div>
      {assignments.length > 0 ? (
        <div className="divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
          {assignments.map((assignment) => <AssignmentRow key={assignment.id ?? assignment.title} assignment={assignment} />)}
        </div>
      ) : (
        <div className="border-y border-[var(--color-border)]"><EmptyRecord title="No assignments" detail="No assignments are attached to this module." /></div>
      )}
    </section>
  );
}

function AssignmentRow({ assignment }: { assignment: InstructorAssignment }) {
  return (
    <div className="group/assignment grid gap-2 px-3 py-3.5 transition hover:bg-[var(--color-surface-muted)] sm:grid-cols-[minmax(0,1fr)_8rem_5rem_1rem] sm:items-center">
      <div className="min-w-0">
        {assignment.id ? <Link href={`/teach/work/${assignment.id}`} className="rounded-row text-[0.8125rem] font-semibold text-[var(--color-ink)] underline decoration-[color-mix(in_oklch,var(--color-ink)_25%,transparent)] underline-offset-[3px] hover:text-[var(--color-accent-strong)]">{assignment.title}</Link> : <span className="text-[0.8125rem] font-semibold">{assignment.title}</span>}
        {assignment.detail ? <p className="mt-0.5 truncate text-[0.75rem] text-[var(--color-muted)]">{assignment.detail}</p> : null}
      </div>
      <span className="text-[0.75rem] tabular-nums text-[var(--color-muted)]">{assignment.dueAt ? assignment.dueAt.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "No due date"}</span>
      <span className="text-right text-[0.75rem] tabular-nums text-[var(--color-muted)]">{typeof assignment.points === "number" ? `${Math.round(assignment.points)} pts` : "-"}</span>
      {assignment.id ? <Link href={`/teach/work/${assignment.id}`} aria-label={`Open ${assignment.title}`} className="hidden text-[var(--color-faint)] transition group-hover/assignment:translate-x-0.5 group-hover/assignment:text-[var(--color-ink)] sm:block"><ChevronRight size={15} aria-hidden /></Link> : null}
    </div>
  );
}

const fieldClass = "min-h-10 rounded-control border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 text-[0.8125rem] text-[var(--color-ink)] outline-none transition focus:border-[var(--color-accent-strong)] focus:bg-[var(--color-surface)]";
