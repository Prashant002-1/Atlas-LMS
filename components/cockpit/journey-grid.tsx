import Link from "next/link";
import { Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/atlas/primitives";
import { JOURNEY_STATE_LABEL, type JourneyGridCounts, type JourneyGridRow } from "@/lib/instructor/cockpit";

/**
 * Journey grid: one card per enrolled student, ordered by what needs the
 * professor first (review requests, then drafts, then the rest). A card with
 * a submission opens the drill-in; the levels strip makes the class scannable
 * without opening anything.
 */

const stateTone = {
  review_requested: "warn",
  draft: "accent",
  pending_grading: "neutral",
  in_session: "accent",
  not_started: "neutral",
  final: "good",
} as const;

const levelTone: Record<string, string> = {
  Exceeds: "bg-[color-mix(in_oklch,var(--color-good)_18%,transparent)] text-[var(--color-good)]",
  Meets: "bg-[color-mix(in_oklch,var(--color-accent)_16%,transparent)] text-[var(--color-accent-strong)]",
  Developing: "bg-[color-mix(in_oklch,var(--color-warn)_16%,transparent)] text-[var(--color-warn)]",
  Missing: "bg-[color-mix(in_oklch,var(--color-danger)_16%,transparent)] text-[var(--color-danger)]",
};

export function JourneyGridSummary({ counts }: { counts: JourneyGridCounts }) {
  const chips: Array<{ label: string; value: number }> = [
    { label: "students", value: counts.students },
    { label: "submitted", value: counts.submitted },
    { label: "final", value: counts.final },
    { label: "draft grades", value: counts.draft },
    { label: "review requests", value: counts.reviewRequested },
    { label: "in session", value: counts.inSession },
    { label: "not started", value: counts.notStarted },
  ];
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
      {chips.map((chip) => (
        <p key={chip.label} className="text-[0.78125rem] text-[var(--color-muted)]">
          <span className="font-semibold tabular-nums text-[var(--color-ink)]">{chip.value}</span> {chip.label}
        </p>
      ))}
    </div>
  );
}

export function JourneyGrid({ rows }: { rows: JourneyGridRow[] }) {
  if (rows.length === 0) {
    return <p className="text-[0.84375rem] text-[var(--color-muted)]">No students are enrolled yet.</p>;
  }

  return (
    <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map((row) => {
        const card = (
          <article
            className={cn(
              "flex h-full flex-col gap-2 rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5 shadow-[var(--shadow-panel)]",
              row.submissionId && "atlas-card-hover"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 truncate text-[0.84375rem] font-semibold text-[var(--color-ink)]">{row.studentName}</p>
              <StatusBadge tone={stateTone[row.state]}>{JOURNEY_STATE_LABEL[row.state]}</StatusBadge>
            </div>

            <div className="mt-auto flex items-end justify-between gap-2">
              {row.levels ? (
                <div className="flex gap-1" aria-label="Criterion levels">
                  {row.levels.map((entry) => (
                    <span
                      key={entry.key}
                      title={`${entry.name}: ${entry.level}`}
                      className={cn(
                        "atlas-mono inline-flex size-5 items-center justify-center rounded-row text-[0.625rem] font-semibold",
                        levelTone[entry.level]
                      )}
                    >
                      {entry.level[0]}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-[0.71875rem] text-[var(--color-faint)]">
                  {row.submittedAt ? `Submitted ${shortDate(row.submittedAt)}` : "No record yet"}
                </span>
              )}
              <div className="flex items-center gap-1.5">
                {row.reviewRequestedAt ? <Flag size={11} className="text-[var(--color-warn)]" aria-label="Review requested" /> : null}
                {row.overallScore !== null ? (
                  <span className="text-[0.9375rem] font-semibold tabular-nums text-[var(--color-ink)]">
                    {Math.round(row.overallScore)}
                  </span>
                ) : null}
              </div>
            </div>
          </article>
        );

        return row.submissionId ? (
          <Link
            key={row.userId}
            href={`/teach/atlas/journey/${row.submissionId}`}
            className="rounded-panel focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)]"
          >
            {card}
          </Link>
        ) : (
          <div key={row.userId}>{card}</div>
        );
      })}
    </div>
  );
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
