import { Check, Plus } from "lucide-react";
import { auth } from "@/lib/auth";
import { loadInstructorWorkspace, type InstructorWorkspace } from "@/lib/instructor/workspace";
import { createModuleRecord, publishModule } from "@/lib/instructor/actions";
import { PageHeader } from "@/components/teach/page-header";
import { ActionButton, StatusBadge, TextLink } from "@/components/atlas/primitives";
import { EmptyState } from "@/components/atlas/record";
import { StaggerGrid, MotionItem } from "@/components/atlas/motion";

const statusTone = { approved: "good", draft: "neutral", "needs-review": "warn" } as const;
const statusLabel = { approved: "Live", draft: "Draft", "needs-review": "Review" } as const;

export default async function TeachModulesPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const session = await auth();
  const [workspace, params] = await Promise.all([loadInstructorWorkspace(session?.user), searchParams]);
  const openNew = params.new === "1";

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
      <PageHeader title="Modules" course={`${workspace.course.code} / ${workspace.course.term}`} />

      {workspace.modules.length > 0 ? (
        <StaggerGrid className="space-y-2.5" stagger={0.04}>
          {workspace.modules.map((module) => <MotionItem key={module.id ?? module.title}><WeekCard module={module} /></MotionItem>)}
        </StaggerGrid>
      ) : (
        <div className="rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-panel)]">
          <EmptyState art="atlas" title="No modules yet" detail="Draft them with Atlas or add one below." />
        </div>
      )}

      <details id="new" open={openNew} className="mt-5 scroll-mt-24 rounded-panel border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface)] px-5 py-4 shadow-[var(--shadow-panel)]">
        <summary className="cursor-pointer text-[0.875rem] font-semibold transition hover:text-[var(--color-accent-strong)]">Add a module</summary>
        <form action={createModuleRecord} className="mt-4 grid max-w-xl gap-3">
          <label className="grid gap-1.5 text-[0.75rem] font-medium">
            Title
            <input name="title" type="text" required placeholder="Week 8: Confidence intervals in practice" className="min-h-10 rounded-control border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 text-[0.875rem] transition focus:border-[var(--color-accent-strong)] focus:bg-[var(--color-surface)]" />
          </label>
          <label className="grid gap-1.5 text-[0.75rem] font-medium">
            Summary
            <textarea name="summary" rows={3} placeholder="What the week covers and why it matters." className="resize-none rounded-control border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2.5 text-[0.875rem] leading-6 transition focus:border-[var(--color-accent-strong)] focus:bg-[var(--color-surface)]" />
          </label>
          <div>
            <ActionButton><Plus size={14} strokeWidth={2} aria-hidden /><span className="ml-1.5">Add module</span></ActionButton>
          </div>
        </form>
      </details>
    </>
  );
}

function WeekCard({ module }: { module: InstructorWorkspace["modules"][number] }) {
  const approved = module.status === "approved";
  return (
    <article className="atlas-card-hover group flex gap-4 rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-panel)]">
      <span className="atlas-mono shrink-0 pt-0.5 text-[1.125rem] font-semibold leading-6 tabular-nums text-[var(--color-faint)]">{module.week}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[0.9375rem] font-semibold leading-6 text-[var(--color-ink)]">
              {module.id ? <TextLink href={`/teach/week/${module.id}`}>{module.title}</TextLink> : module.title}
            </p>
            {module.summary ? <p className="mt-1 line-clamp-2 text-[0.8125rem] leading-5 text-[var(--color-muted)]">{module.summary}</p> : null}
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            <StatusBadge tone={statusTone[module.status]}>{statusLabel[module.status]}</StatusBadge>
            {approved ? null : (
              <form action={publishModule}>
                <input type="hidden" name="moduleId" value={module.id} />
                <input type="hidden" name="returnTo" value="/teach/weeks" />
                <ActionButton variant="secondary" ariaLabel={`Publish ${module.title}`} title="Publish">
                  <Check size={13} strokeWidth={2} aria-hidden /><span className="ml-1">Publish</span>
                </ActionButton>
              </form>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
