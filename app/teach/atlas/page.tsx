import Link from "next/link";
import { auth } from "@/lib/auth";
import { loadCockpitIndex } from "@/lib/instructor/cockpit";
import { PageHeader } from "@/components/teach/page-header";
import { PlanningHistory } from "@/components/cockpit/planning-history";
import { JourneyGridSummary } from "@/components/cockpit/journey-grid";
import { StatusBadge, TextLink } from "@/components/atlas/primitives";

/**
 * The session cockpit index: every work session in the course, its class at
 * a glance, and the professor's planning history (the provenance the student
 * side-notes trace back to). Replaced the Phase 0 shell in Phase 4.
 */
export default async function TeachAtlasPage() {
  const session = await auth();
  const view = await loadCockpitIndex(session?.user);

  if (view.problem) {
    return (
      <>
        <PageHeader title="Atlas" />
        <p className="max-w-lg text-[0.875rem] leading-6 text-[var(--color-muted)]">{view.problem.detail}</p>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Atlas"
        course={`${view.course.code} / ${view.course.name}`}
        action={
          view.pendingProposals > 0 ? (
            <TextLink href="/teach/review" className="text-[0.8125rem]">
              {view.pendingProposals} draft{view.pendingProposals === 1 ? "" : "s"} in Review
            </TextLink>
          ) : undefined
        }
      />

      <section aria-label="Work sessions">
        <h2 className="text-[0.8125rem] font-semibold uppercase tracking-[0.08em] text-[var(--color-faint)]">Work sessions</h2>
        {view.assignments.length === 0 ? (
          <div className="mt-2.5 rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-panel)]">
            <p className="text-[0.875rem] font-semibold">No work sessions yet</p>
            <p className="mt-1.5 max-w-2xl text-[0.84375rem] leading-6 text-[var(--color-muted)]">
              A work session is an assignment taken as a governed conversation with Atlas and graded on the reasoning
              journey. Creating one from scratch lands with planning sessions; the seeded course ships one configured.
            </p>
          </div>
        ) : (
          <div className="mt-2.5 space-y-3">
            {view.assignments.map((assignment) => (
              <Link
                key={assignment.id}
                href={`/teach/atlas/${assignment.id}`}
                className="block rounded-panel focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)]"
              >
                <article className="atlas-card-hover rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-panel)]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[0.9375rem] font-semibold text-[var(--color-ink)]">{assignment.name}</p>
                    <div className="flex items-center gap-2">
                      {assignment.counts.reviewRequested > 0 ? (
                        <StatusBadge tone="warn">
                          {assignment.counts.reviewRequested} review request{assignment.counts.reviewRequested === 1 ? "" : "s"}
                        </StatusBadge>
                      ) : null}
                      {assignment.counts.draft > 0 ? (
                        <StatusBadge tone="accent">{assignment.counts.draft} drafts to review</StatusBadge>
                      ) : null}
                    </div>
                  </div>
                  <p className="atlas-mono mt-1 text-[0.6875rem] uppercase tracking-[0.07em] text-[var(--color-faint)]">
                    {assignment.durationMinutes} min session
                    {assignment.dueAt
                      ? ` · due ${new Date(assignment.dueAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                      : ""}
                    {" · rubric v"}
                    {assignment.rubricVersion}
                    {assignment.personalRecordSideNotes ? " · side notes on" : " · side notes off"}
                  </p>
                  <div className="mt-3">
                    <JourneyGridSummary counts={assignment.counts} />
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <PlanningHistory sessions={view.planningSessions} />
      </section>
    </>
  );
}
