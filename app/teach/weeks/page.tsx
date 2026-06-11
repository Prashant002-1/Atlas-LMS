import { Check, Plus } from "lucide-react";
import { auth } from "@/lib/auth";
import { loadInstructorWorkspace, type InstructorWorkspace } from "@/lib/instructor/workspace";
import { createModuleRecord, publishModule } from "@/lib/instructor/actions";
import { PageHeader } from "@/components/teach/page-header";
import { ActionButton, CodeList, StatusBadge, TextLink } from "@/components/atlas/primitives";
import { EmptyRecord, ObjectiveChecklist } from "@/components/atlas/record";

/** The week-by-week material record: compact rows, direct edits, no theater. */
export default async function TeachWeeksPage() {
  const session = await auth();
  const workspace = await loadInstructorWorkspace(session?.user);

  if (workspace.problem) {
    return (
      <>
        <PageHeader title="Weeks" />
        <p className="max-w-lg text-[14px] leading-6 text-[var(--color-muted)]">{workspace.problem.detail}</p>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Weeks" course={`${workspace.course.code} / ${workspace.course.term}`} />

      <div className="divide-y divide-[var(--color-border)] rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-panel)]">
        {workspace.modules.length > 0 ? (
          workspace.modules.map((module) => <WeekRow key={module.id ?? module.title} module={module} />)
        ) : (
          <div className="px-4 py-4">
            <EmptyRecord title="No weeks yet" detail="Draft them with Atlas or add one below." />
          </div>
        )}
      </div>

      <details className="mt-6 rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 shadow-[var(--shadow-panel)]">
        <summary className="cursor-pointer text-[14px] font-semibold">Add a week</summary>
        <form action={createModuleRecord} className="mt-4 grid max-w-xl gap-3">
          <label className="grid gap-1.5 text-[12px] font-medium">
            Title
            <input
              name="title"
              type="text"
              required
              placeholder="Week 8: Confidence intervals in practice"
              className="min-h-10 rounded-[8px] border border-[var(--color-border)] bg-white px-3 text-[14px] transition focus:border-[var(--color-accent-strong)]"
            />
          </label>
          <label className="grid gap-1.5 text-[12px] font-medium">
            Summary
            <textarea
              name="summary"
              rows={3}
              placeholder="What the week covers and why it matters."
              className="resize-none rounded-[8px] border border-[var(--color-border)] bg-white px-3 py-2.5 text-[14px] leading-6 transition focus:border-[var(--color-accent-strong)]"
            />
          </label>
          <ObjectiveChecklist objectives={workspace.objectives} selectedCodes={[]} />
          <div>
            <ActionButton>
              <Plus size={14} strokeWidth={2} aria-hidden="true" />
              <span className="ml-1.5">Add week</span>
            </ActionButton>
          </div>
        </form>
      </details>
    </>
  );
}

function WeekRow({ module }: { module: InstructorWorkspace["modules"][number] }) {
  return (
    <article className="flex items-center gap-4 px-4 py-3">
      <span className="atlas-mono w-7 shrink-0 text-[13px] text-[var(--color-faint)]">{module.week}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium leading-6">
          {module.id ? <TextLink href={`/teach/week/${module.id}`}>{module.title}</TextLink> : module.title}
        </p>
        {module.summary ? <p className="line-clamp-1 text-[12.5px] text-[var(--color-muted)]">{module.summary}</p> : null}
      </div>
      <div className="hidden shrink-0 sm:block">
        <CodeList codes={module.objectiveCodes} />
      </div>
      {module.status === "approved" ? (
        <StatusBadge tone="good">Live</StatusBadge>
      ) : (
        <form action={publishModule}>
          <input type="hidden" name="moduleId" value={module.id} />
          <input type="hidden" name="returnTo" value="/teach/weeks" />
          <ActionButton variant="secondary" ariaLabel={`Publish ${module.title}`} title="Publish">
            <Check size={13} strokeWidth={2} aria-hidden="true" />
            <span className="ml-1">Publish</span>
          </ActionButton>
        </form>
      )}
    </article>
  );
}
