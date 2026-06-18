import { Check, Plus } from "lucide-react";
import { auth } from "@/lib/auth";
import { loadInstructorWorkspace, type InstructorWorkspace } from "@/lib/instructor/workspace";
import { createModuleRecord, publishModule } from "@/lib/instructor/actions";
import { PageHeader } from "@/components/teach/page-header";
import { ActionButton, CodeList, StatusBadge, TextLink } from "@/components/atlas/primitives";
import { EmptyRecord, ObjectiveChecklist } from "@/components/atlas/record";
import { StaggerGrid, MotionItem } from "@/components/atlas/motion";

const statusTone = {
  approved: "good",
  draft: "neutral",
  "needs-review": "warn",
} as const;

const statusLabel = {
  approved: "Live",
  draft: "Draft",
  "needs-review": "Review",
} as const;

/** The week-by-week material record: distinct cards, clear separation, direct edits. */
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

      {workspace.modules.length > 0 ? (
        <StaggerGrid className="space-y-2.5" stagger={0.04}>
          {workspace.modules.map((module) => (
            <MotionItem key={module.id ?? module.title}>
              <WeekCard module={module} />
            </MotionItem>
          ))}
        </StaggerGrid>
      ) : (
        <div className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-6 shadow-[var(--shadow-panel)]">
          <EmptyRecord title="No weeks yet" detail="Draft them with Atlas or add one below." />
        </div>
      )}

      <details className="mt-5 rounded-[10px] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface)] px-5 py-4 shadow-[var(--shadow-panel)]">
        <summary className="cursor-pointer text-[14px] font-semibold transition hover:text-[var(--color-accent-strong)]">Add a week</summary>
        <form action={createModuleRecord} className="mt-4 grid max-w-xl gap-3">
          <label className="grid gap-1.5 text-[12px] font-medium">
            Title
            <input
              name="title"
              type="text"
              required
              placeholder="Week 8: Confidence intervals in practice"
              className="min-h-10 rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 text-[14px] transition focus:border-[var(--color-accent-strong)] focus:bg-[var(--color-surface)]"
            />
          </label>
          <label className="grid gap-1.5 text-[12px] font-medium">
            Summary
            <textarea
              name="summary"
              rows={3}
              placeholder="What the week covers and why it matters."
              className="resize-none rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2.5 text-[14px] leading-6 transition focus:border-[var(--color-accent-strong)] focus:bg-[var(--color-surface)]"
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

function WeekCard({ module }: { module: InstructorWorkspace["modules"][number] }) {
  const approved = module.status === "approved";
  const tone = statusTone[module.status];

  return (
    <article className="atlas-card-hover group flex gap-4 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-panel)]">
      {/* Week number: clean mono, no box. Top-aligned, faded. */}
      <span
        className={`atlas-mono shrink-0 pt-0.5 text-[18px] font-semibold leading-6 tabular-nums ${
          approved ? "text-[var(--color-faint)]" : "text-[var(--color-faint)]"
        }`}
      >
        {module.week}
      </span>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold leading-6 text-[var(--color-ink)]">
              {module.id ? <TextLink href={`/teach/week/${module.id}`}>{module.title}</TextLink> : module.title}
            </p>
            {module.summary ? (
              <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-[var(--color-muted)]">{module.summary}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            <StatusBadge tone={tone}>{statusLabel[module.status]}</StatusBadge>
            {approved ? null : (
              <form action={publishModule}>
                <input type="hidden" name="moduleId" value={module.id} />
                <input type="hidden" name="returnTo" value="/teach/weeks" />
                <ActionButton variant="secondary" ariaLabel={`Publish ${module.title}`} title="Publish">
                  <Check size={13} strokeWidth={2} aria-hidden="true" />
                  <span className="ml-1">Publish</span>
                </ActionButton>
              </form>
            )}
          </div>
        </div>
        {module.objectiveCodes.length > 0 ? (
          <div className="mt-2.5">
            <CodeList codes={module.objectiveCodes} />
          </div>
        ) : null}
      </div>
    </article>
  );
}
