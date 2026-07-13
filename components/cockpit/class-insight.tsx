import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { proposePracticeSet, refreshClassRollup } from "@/lib/instructor/session-actions";
import { TextLink } from "@/components/atlas/primitives";
import type { ClassInsightView } from "@/lib/instructor/cockpit";

const levelBar = {
  Exceeds: "bg-[var(--color-good)]",
  Meets: "bg-[var(--color-accent)]",
  Developing: "bg-[var(--color-warn)]",
  Missing: "bg-[var(--color-danger)]",
} as const;

const LEVEL_ORDER = ["Exceeds", "Meets", "Developing", "Missing"] as const;

export function ClassInsight({
  insight,
  assignmentId,
  criterionNames,
  pendingPracticeProposals,
}: {
  insight: ClassInsightView;
  assignmentId: string;
  criterionNames: Record<string, string>;
  pendingPracticeProposals: number;
}) {
  return (
    <section aria-labelledby="class-results-heading" className="border-t border-[var(--color-border)] pt-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="class-results-heading" className="text-[1.125rem] font-semibold text-[var(--color-ink)]">Class results</h2>
          {insight ? (
            <p className="mt-1 text-[0.75rem] text-[var(--color-muted)]">
              Updated {new Date(insight.computedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              {insight.stale ? " · new grades available" : ""}
            </p>
          ) : null}
        </div>
        <form action={refreshClassRollup}>
          <input type="hidden" name="assignmentId" value={assignmentId} />
          <button
            type="submit"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-control border border-[var(--color-border)] px-3 text-[0.78125rem] font-medium text-[var(--color-muted)] transition hover:border-[var(--color-border-strong)] hover:text-[var(--color-ink)]"
          >
            <RefreshCw size={12} aria-hidden />
            Refresh
          </button>
        </form>
      </div>

      {!insight ? (
        <p className="mt-4 text-[0.8125rem] text-[var(--color-muted)]">No class results have been calculated.</p>
      ) : (
        <>
          <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-3">
            <ResultFact label="Graded sessions" value={`${insight.stats.gradedSessions} / ${insight.stats.submittedSessions}`} />
            <ResultFact label="Average" value={String(insight.stats.overallAverage)} />
            <ResultFact label="Median" value={String(insight.stats.overallMedian)} />
            {insight.stats.reviewRequestedCount > 0 ? (
              <ResultFact label="Review requests" value={String(insight.stats.reviewRequestedCount)} attention />
            ) : null}
          </dl>

          {insight.narrative ? <p className="mt-5 max-w-4xl text-[0.84375rem] leading-6 text-[var(--color-ink)]">{insight.narrative}</p> : null}

          <div className="mt-6 grid gap-x-10 gap-y-5 lg:grid-cols-2">
            {Object.entries(insight.stats.criterionCounts).map(([key, counts]) => {
              const total = LEVEL_ORDER.reduce((sum, level) => sum + (counts[level] ?? 0), 0);
              if (total === 0) return null;
              return (
                <div key={key}>
                  <p className="text-[0.8125rem] font-medium text-[var(--color-ink)]">{criterionNames[key] ?? key}</p>
                  <div className="mt-2 flex h-2 overflow-hidden rounded-row bg-[var(--color-surface-muted)]" aria-hidden>
                    {LEVEL_ORDER.map((level) =>
                      (counts[level] ?? 0) > 0 ? (
                        <span
                          key={level}
                          className={cn(levelBar[level])}
                          style={{ width: `${((counts[level] ?? 0) / total) * 100}%` }}
                        />
                      ) : null
                    )}
                  </div>
                  <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[0.71875rem] text-[var(--color-muted)]">
                    {LEVEL_ORDER.map((level) => <span key={level}>{level} {counts[level] ?? 0}</span>)}
                  </p>
                </div>
              );
            })}
          </div>

          {Object.keys(insight.stats.sideNoteTopicCounts).length > 0 ? (
            <p className="mt-5 text-[0.75rem] text-[var(--color-muted)]">
              Personal record notes: {Object.entries(insight.stats.sideNoteTopicCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([topic, count]) => `${topic} in ${count} session${count === 1 ? "" : "s"}`)
                .join(", ")}.
            </p>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-[var(--color-border)] pt-4">
            {pendingPracticeProposals > 0 ? (
              <p className="text-[0.8125rem] text-[var(--color-muted)]">
                Practice set waiting in <TextLink href="/teach/review">Review</TextLink>
              </p>
            ) : (
              <form action={proposePracticeSet}>
                <input type="hidden" name="assignmentId" value={assignmentId} />
                <button
                  type="submit"
                  className="inline-flex min-h-9 items-center rounded-control border border-[var(--color-ink)] bg-[var(--color-ink)] px-3 text-[0.8125rem] font-medium text-[var(--color-bg)] transition hover:border-[var(--color-accent-strong)] hover:bg-[var(--color-accent-strong)]"
                >
                  Propose practice set
                </button>
              </form>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function ResultFact({ label, value, attention = false }: { label: string; value: string; attention?: boolean }) {
  return (
    <div>
      <dt className="text-[0.75rem] text-[var(--color-muted)]">{label}</dt>
      <dd className={cn("mt-0.5 text-[1.125rem] font-semibold tabular-nums text-[var(--color-ink)]", attention && "text-[var(--color-warn)]")}>{value}</dd>
    </div>
  );
}
