import Link from "next/link";
import { Plus } from "lucide-react";
import { auth } from "@/lib/auth";
import { loadAiAssignmentIndex } from "@/lib/instructor/cockpit";
import { createAiAssignment } from "@/lib/instructor/session-actions";
import { PageHeader } from "@/components/teach/page-header";
import { ActionButton, StatusBadge, TextLink } from "@/components/atlas/primitives";
import { EmptyState } from "@/components/atlas/record";
import { JourneyGridSummary } from "@/components/cockpit/journey-grid";
import { StaggerGrid, MotionItem } from "@/components/atlas/motion";

/**
 * The AI assignments tab: the operational lens over one record type. Every
 * AI assignment in the course with its facts and class status, the course AI
 * policy stated plainly, and direct creation from an existing assignment.
 * Rows open the same grade view Work leads to; one canonical page, two doors.
 */
export default async function TeachAiAssignmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const session = await auth();
  const [view, params] = await Promise.all([loadAiAssignmentIndex(session?.user), searchParams]);
  const openNew = params.new === "1";

  if (view.problem) {
    return (
      <>
        <PageHeader title="AI assignments" />
        <p className="max-w-lg text-[0.875rem] leading-6 text-[var(--color-muted)]">{view.problem.detail}</p>
      </>
    );
  }

  return (
    <>
      <PageHeader title="AI assignments" course={`${view.course.code} / ${view.course.name}`} />

      {view.rows.length > 0 ? (
        <StaggerGrid className="space-y-3" stagger={0.04}>
          {view.rows.map((row) => (
            <MotionItem key={row.assignmentId}>
              <Link
                href={`/teach/ai-assignments/${row.assignmentId}`}
                className="block rounded-panel focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)]"
              >
                <article className="atlas-card-hover rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-panel)]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[0.9375rem] font-semibold text-[var(--color-ink)]">{row.name}</p>
                    <div className="flex items-center gap-2">
                      {row.counts && row.counts.reviewRequested > 0 ? (
                        <StatusBadge tone="warn">
                          {row.counts.reviewRequested} review request{row.counts.reviewRequested === 1 ? "" : "s"}
                        </StatusBadge>
                      ) : null}
                      {row.counts && row.counts.draft > 0 ? (
                        <StatusBadge tone="accent">{row.counts.draft} draft grades</StatusBadge>
                      ) : null}
                      <StatusBadge tone={row.published ? "good" : "neutral"}>{row.published ? "Live" : "Draft"}</StatusBadge>
                    </div>
                  </div>
                  <p className="atlas-mono mt-1 text-[0.6875rem] uppercase tracking-[0.07em] text-[var(--color-faint)]">
                    {row.dueAt
                      ? `Due ${new Date(row.dueAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · `
                      : ""}
                    {row.pointsPossible ? `${Math.round(row.pointsPossible)} pts · ` : ""}
                    {row.durationMinutes} min session · rubric v{row.rubricVersion} ({row.criteriaCount} criteria)
                    {row.personalRecordSideNotes ? " · side notes on" : " · side notes off"}
                  </p>
                  {row.counts ? (
                    <div className="mt-3">
                      <JourneyGridSummary counts={row.counts} />
                    </div>
                  ) : null}
                </article>
              </Link>
            </MotionItem>
          ))}
        </StaggerGrid>
      ) : (
        <div className="rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-panel)]">
          <EmptyState
            art="atlas"
            title="No AI assignments yet"
            detail="Convert an assignment below, or shape one with Atlas first."
          />
        </div>
      )}

      <section
        aria-label="Course AI policy"
        className="mt-5 rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-panel)]"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="atlas-mono text-[0.6875rem] uppercase tracking-[0.08em] text-[var(--color-faint)]">Course AI policy</p>
          <TextLink href="/teach/settings" className="text-[0.75rem]">
            Edit in Settings
          </TextLink>
        </div>
        {view.policy ? (
          <p className="mt-2 text-[0.8125rem] leading-6 text-[var(--color-muted)]">
            Explanations {view.policy.explanationDepth} · explain {view.policy.allowExplain ? "on" : "off"} · practice{" "}
            {view.policy.allowPractice ? "on" : "off"} · questions {view.policy.allowQuestions ? "on" : "off"} · citations{" "}
            {view.policy.citationsRequired ? "required" : "optional"} · {view.policy.studentDailyLimit} asks per student per day
          </p>
        ) : (
          <p className="mt-2 text-[0.8125rem] leading-6 text-[var(--color-muted)]">
            No course policy is set yet; students get the defaults until you set one in Settings.
          </p>
        )}
      </section>

      <details
        id="new"
        open={openNew}
        className="mt-5 scroll-mt-24 rounded-panel border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface)] px-5 py-4 shadow-[var(--shadow-panel)]"
      >
        <summary className="cursor-pointer text-[0.875rem] font-semibold transition hover:text-[var(--color-accent-strong)]">
          New AI assignment
        </summary>
        {view.availableAssignments.length === 0 ? (
          <p className="mt-3 max-w-xl text-[0.8125rem] leading-6 text-[var(--color-muted)]">
            Every assignment in this course already runs as an AI assignment. Add work first under{" "}
            <TextLink href="/teach/work" className="text-[0.8125rem]">
              Work
            </TextLink>
            , then convert it here.
          </p>
        ) : (
          <form action={createAiAssignment} className="mt-4 grid max-w-xl gap-3">
            <label className="grid gap-1.5 text-[0.75rem] font-medium">
              Assignment
              <select
                name="assignmentId"
                required
                defaultValue=""
                className="min-h-10 rounded-control border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 text-[0.875rem] transition focus:border-[var(--color-accent-strong)] focus:bg-[var(--color-surface)]"
              >
                <option value="" disabled>
                  Pick an assignment
                </option>
                {view.availableAssignments.map((assignment) => (
                  <option key={assignment.id} value={assignment.id}>
                    {assignment.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-[0.75rem] font-medium">
              Brief the student sees
              <textarea
                name="instructions"
                rows={3}
                required
                minLength={10}
                maxLength={2000}
                placeholder="The problem, the deliverable, and how the session runs."
                className="resize-y rounded-control border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2.5 text-[0.875rem] leading-6 transition focus:border-[var(--color-accent-strong)] focus:bg-[var(--color-surface)]"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1.5 text-[0.75rem] font-medium">
                Duration (minutes)
                <input
                  name="durationMinutes"
                  type="number"
                  min={5}
                  max={240}
                  step={1}
                  required
                  defaultValue={30}
                  className="min-h-10 rounded-control border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 text-[0.875rem] tabular-nums transition focus:border-[var(--color-accent-strong)] focus:bg-[var(--color-surface)]"
                />
              </label>
              <label className="grid gap-1.5 text-[0.75rem] font-medium">
                Transcript policy (students see this)
                <input
                  name="transcriptPolicy"
                  type="text"
                  minLength={3}
                  maxLength={200}
                  defaultValue="shared on request / for review"
                  className="min-h-10 rounded-control border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 text-[0.875rem] transition focus:border-[var(--color-accent-strong)] focus:bg-[var(--color-surface)]"
                />
              </label>
            </div>
            <label className="flex items-start gap-2.5 rounded-panel border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2.5">
              <input type="checkbox" name="personalRecordSideNotes" className="mt-0.5 size-4 accent-[var(--color-accent-strong)]" />
              <span>
                <span className="block text-[0.8125rem] font-medium text-[var(--color-ink)]">Personal-record side notes</span>
                <span className="mt-0.5 block text-[0.71875rem] leading-4 text-[var(--color-muted)]">
                  Lets the session surface a student&apos;s own record as margin cards. Their data flows to them, never to
                  other students.
                </span>
              </span>
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <ActionButton>
                <Plus size={14} strokeWidth={2} aria-hidden="true" />
                <span className="ml-1.5">Create AI assignment</span>
              </ActionButton>
              <p className="text-[0.71875rem] leading-4 text-[var(--color-faint)]">
                Starts from the standard four-criterion rubric; reshape it on the assignment page or ask Atlas.
              </p>
            </div>
          </form>
        )}
      </details>
    </>
  );
}
