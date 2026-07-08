import { BarChart3, RefreshCw, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { proposePracticeSet, refreshClassRollup } from "@/lib/instructor/session-actions";
import { TextLink } from "@/components/atlas/primitives";
import type { ClassInsightView } from "@/lib/instructor/cockpit";

/**
 * Class insight: the stored rollup rendered, never recomputed at render time.
 * Every number on this panel is deterministic aggregation over stored
 * reports; the narrative only repeats those numbers. "Propose practice set"
 * closes the loop back into teaching through the Review gate.
 */

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
    <section
      aria-label="Class insight"
      className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-panel)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="atlas-mono flex items-center gap-1.5 text-[11px] uppercase tracking-[0.08em] text-[var(--color-faint)]">
          <BarChart3 size={12} aria-hidden />
          Class insight
        </p>
        <div className="flex items-center gap-2">
          {insight ? (
            <span className="text-[11px] text-[var(--color-faint)]">
              computed {new Date(insight.computedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              {insight.stale ? " (stale)" : ""}
            </span>
          ) : null}
          <form action={refreshClassRollup}>
            <input type="hidden" name="assignmentId" value={assignmentId} />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-[8px] border border-[var(--color-border)] px-2.5 py-1 text-[12px] font-medium text-[var(--color-muted)] transition hover:border-[var(--color-border-strong)] hover:text-[var(--color-ink)]"
            >
              <RefreshCw size={11.5} aria-hidden />
              Refresh
            </button>
          </form>
        </div>
      </div>

      {!insight ? (
        <p className="mt-3 text-[13px] leading-6 text-[var(--color-muted)]">
          No insight is computed yet. Refresh to aggregate the stored journey reports; nothing is invented, so an
          ungraded class produces an honest zero.
        </p>
      ) : (
        <>
          <p className="mt-3 text-[13.5px] leading-6 text-[var(--color-ink)]">{insight.narrative}</p>

          <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[12.5px] text-[var(--color-muted)]">
            <div>
              <dt className="sr-only">Graded</dt>
              <dd>
                <span className="font-semibold tabular-nums text-[var(--color-ink)]">{insight.stats.gradedSessions}</span> of{" "}
                <span className="tabular-nums">{insight.stats.submittedSessions}</span> graded
              </dd>
            </div>
            <div>
              <dt className="sr-only">Average</dt>
              <dd>
                average <span className="font-semibold tabular-nums text-[var(--color-ink)]">{insight.stats.overallAverage}</span>
              </dd>
            </div>
            <div>
              <dt className="sr-only">Median</dt>
              <dd>
                median <span className="font-semibold tabular-nums text-[var(--color-ink)]">{insight.stats.overallMedian}</span>
              </dd>
            </div>
            {insight.stats.reviewRequestedCount > 0 ? (
              <div>
                <dt className="sr-only">Review requests</dt>
                <dd className="text-[var(--color-warn)]">
                  <span className="font-semibold tabular-nums">{insight.stats.reviewRequestedCount}</span> review request
                  {insight.stats.reviewRequestedCount === 1 ? "" : "s"}
                </dd>
              </div>
            ) : null}
          </dl>

          <div className="mt-4 space-y-2">
            {Object.entries(insight.stats.criterionCounts).map(([key, counts]) => {
              const total = LEVEL_ORDER.reduce((sum, level) => sum + (counts[level] ?? 0), 0);
              if (total === 0) return null;
              return (
                <div key={key}>
                  <div className="flex items-center justify-between text-[11.5px]">
                    <span className="font-medium text-[var(--color-muted)]">{criterionNames[key] ?? key}</span>
                    <span className="atlas-mono text-[10.5px] text-[var(--color-faint)]">
                      {LEVEL_ORDER.map((level) => `${level[0]}${counts[level] ?? 0}`).join(" ")}
                    </span>
                  </div>
                  <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-muted)]" aria-hidden>
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
                </div>
              );
            })}
          </div>

          {Object.keys(insight.stats.sideNoteTopicCounts).length > 0 ? (
            <p className="mt-3 text-[12px] text-[var(--color-muted)]">
              Side notes fired:{" "}
              {Object.entries(insight.stats.sideNoteTopicCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([topic, count]) => `${topic} in ${count} session${count === 1 ? "" : "s"}`)
                .join(", ")}
              .
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[var(--color-border)] pt-3">
            {pendingPracticeProposals > 0 ? (
              <p className="text-[12.5px] text-[var(--color-muted)]">
                A practice-set draft is waiting in <TextLink href="/teach/review">Review</TextLink>.
              </p>
            ) : (
              <>
                <form action={proposePracticeSet}>
                  <input type="hidden" name="assignmentId" value={assignmentId} />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 rounded-[8px] border border-[var(--color-ink)] bg-[var(--color-ink)] px-3 py-1.5 text-[12.5px] font-medium text-[var(--color-bg)] transition hover:border-[var(--color-accent-strong)] hover:bg-[var(--color-accent-strong)]"
                  >
                    <Sparkles size={12} aria-hidden />
                    Propose practice set
                  </button>
                </form>
                <p className="text-[11.5px] leading-4 text-[var(--color-faint)]">
                  Drafts from the class record; nothing reaches students until you apply it in Review.
                </p>
              </>
            )}
          </div>
        </>
      )}
    </section>
  );
}
