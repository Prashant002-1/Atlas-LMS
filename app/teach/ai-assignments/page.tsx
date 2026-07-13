import Link from "next/link";
import { auth } from "@/lib/auth";
import { loadAiAssignmentIndex } from "@/lib/instructor/cockpit";
import { PageHeader } from "@/components/teach/page-header";
import { StatusBadge, TextLink } from "@/components/atlas/primitives";
import { EmptyState } from "@/components/atlas/record";
import { JourneyGridSummary } from "@/components/cockpit/journey-grid";
import { StaggerGrid, MotionItem } from "@/components/atlas/motion";

/**
 * The AI assignments tab: see, inspect, govern. Every AI assignment in the
 * course with its facts and class status, and the course AI policy stated
 * plainly. Nothing is created here; creation is a conversation with Atlas,
 * which drafts the whole AI assignment behind Review. Rows open the same
 * grade view Work leads to; one canonical page, two doors.
 */
export default async function TeachAiAssignmentsPage() {
  const session = await auth();
  const view = await loadAiAssignmentIndex(session?.user);

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
            detail="Ask Atlas to set one up from an existing assignment; the draft lands in Review."
            action={
              <TextLink href="/teach/atlas" className="text-[0.8125rem]">
                Open Atlas
              </TextLink>
            }
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
    </>
  );
}
