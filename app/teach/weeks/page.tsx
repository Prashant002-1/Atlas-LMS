import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { auth } from "@/lib/auth";
import { loadInstructorWorkspace, type InstructorWorkspace } from "@/lib/instructor/workspace";
import { createModuleRecord, publishModule } from "@/lib/instructor/actions";
import { PageHeader } from "@/components/teach/page-header";
import { ActionButton } from "@/components/atlas/primitives";
import { EmptyState } from "@/components/atlas/record";
import { RecordDialog } from "@/components/teach/record-dialog";

export default async function TeachModulesPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const session = await auth();
  const [workspace, params] = await Promise.all([loadInstructorWorkspace(session?.user), searchParams]);

  if (workspace.problem) {
    return (
      <>
        <PageHeader title="Modules" />
        <p className="max-w-lg text-[0.875rem] leading-6 text-[var(--color-muted)]">{workspace.problem.detail}</p>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Modules"
        course={`${workspace.course.code} / ${workspace.course.term}`}
        action={<NewModuleDialog defaultOpen={params.new === "1"} />}
      />

      {workspace.modules.length > 0 ? (
        <section aria-labelledby="module-list-heading">
          <div className="mb-3">
            <h2 id="module-list-heading" className="text-[1rem] font-semibold text-[var(--color-ink)]">Course modules</h2>
            <p className="mt-1 text-[0.75rem] text-[var(--color-muted)]">{workspace.modules.length} modules</p>
          </div>
          <div className="divide-y divide-[var(--color-border)]">
            {workspace.modules.map((module) => <ModuleRow key={module.id ?? module.title} module={module} />)}
          </div>
        </section>
      ) : (
        <div>
          <EmptyState art="atlas" title="No modules" />
        </div>
      )}
    </>
  );
}

function ModuleRow({ module }: { module: InstructorWorkspace["modules"][number] }) {
  const published = module.status === "approved";
  return (
    <div className="group/module grid gap-3 px-3 py-3.5 transition hover:bg-[var(--color-surface-muted)] sm:grid-cols-[3rem_minmax(0,1fr)_auto_1rem] sm:items-center">
      <span className="atlas-mono text-[0.75rem] tabular-nums text-[var(--color-faint)]">{module.week}</span>
      <div className="min-w-0">
        {module.id ? (
          <Link href={`/teach/week/${module.id}`} className="rounded-row text-[0.84375rem] font-semibold text-[var(--color-ink)] underline decoration-[color-mix(in_oklch,var(--color-ink)_25%,transparent)] underline-offset-[3px] hover:text-[var(--color-accent-strong)]">{module.title}</Link>
        ) : <span className="text-[0.84375rem] font-semibold text-[var(--color-ink)]">{module.title}</span>}
        {module.summary ? <p className="mt-0.5 truncate text-[0.75rem] text-[var(--color-muted)]">{module.summary}</p> : null}
      </div>
      <div className="flex items-center justify-end gap-3">
        {module.status !== "approved" ? <span className="text-[0.71875rem] text-[var(--color-muted)]">{module.status === "needs-review" ? "Review" : "Draft"}</span> : null}
        {!published && module.id ? (
          <form action={publishModule}>
            <input type="hidden" name="moduleId" value={module.id} />
            <input type="hidden" name="returnTo" value="/teach/weeks" />
            <ActionButton size="sm" variant="secondary" ariaLabel={`Publish ${module.title}`}>Publish</ActionButton>
          </form>
        ) : null}
      </div>
      {module.id ? <Link href={`/teach/week/${module.id}`} aria-label={`Open ${module.title}`} className="hidden text-[var(--color-faint)] transition group-hover/module:translate-x-0.5 group-hover/module:text-[var(--color-ink)] sm:block"><ChevronRight size={15} aria-hidden /></Link> : null}
    </div>
  );
}

function NewModuleDialog({ defaultOpen }: { defaultOpen: boolean }) {
  return (
    <RecordDialog
      mode="create"
      triggerLabel="New module"
      title="New module"
      triggerVariant="primary"
      defaultOpen={defaultOpen}
    >
      <form action={createModuleRecord} className="grid gap-4">
        <label className="grid gap-1.5 text-[0.75rem] font-medium">
          Title
          <input name="title" type="text" required autoFocus placeholder="Week 8: Confidence intervals in practice" className={fieldClass} />
        </label>
        <label className="grid gap-1.5 text-[0.75rem] font-medium">
          Summary
          <textarea name="summary" rows={8} className={`${fieldClass} min-h-48 resize-y py-3 leading-6`} />
        </label>
        <div className="flex justify-end pt-4">
          <ActionButton>Create module</ActionButton>
        </div>
      </form>
    </RecordDialog>
  );
}

const fieldClass = "min-h-10 rounded-control border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 text-[0.8125rem] text-[var(--color-ink)] outline-none transition placeholder:text-[var(--color-faint)] focus:border-[var(--color-accent-strong)] focus:bg-[var(--color-surface)]";
