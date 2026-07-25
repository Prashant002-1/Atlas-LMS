import { BadgeCheck, ChevronRight, Quote, RotateCcw } from "lucide-react";
import { finalizeJourneyReport, regradeJourneyReport } from "@/lib/instructor/session-actions";
import { cn } from "@/lib/utils";
import type { DrillInReport } from "@/lib/instructor/cockpit";
import { PendingActionButton } from "@/components/atlas/pending-action-button";

const levelColor = {
  Exceeds: "text-[var(--color-good)]",
  Meets: "text-[var(--color-accent-strong)]",
  Developing: "text-[var(--color-warn)]",
  Missing: "text-[var(--color-danger)]",
} as const;

/**
 * The grade: the total, then one row per criterion.
 *
 * Each criterion collapses. Open, a criterion is a paragraph of reasoning plus
 * every quote it rests on, which is the right depth when you are checking one
 * judgment and far too much when five arrive at once. Collapsed, the row still
 * carries what the eye scans for, the name, the level, and the points, so a
 * whole rubric fits on screen and only the judgment being questioned expands.
 *
 * Native details and summary, so this stays a server component: no state to
 * hydrate, and the browser gives keyboard support and find-in-page for free.
 */
export function ProfessorReportPanel({ report, submissionId }: { report: DrillInReport; submissionId: string }) {
  return (
    <section aria-labelledby="grade-heading">
      <h2 id="grade-heading" className="sr-only">Grade</h2>

      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <p className="text-[2rem] font-semibold leading-none tabular-nums text-[var(--color-ink)]">
          {Math.round(report.overallScore)}
          <span className="text-[0.875rem] font-normal text-[var(--color-muted)]"> / {Math.round(report.maxScore)}</span>
        </p>
        <p className="text-[0.75rem] leading-5 text-[var(--color-muted)]">
          {report.status === "final"
            ? `Posted ${report.finalizedAt ? new Date(report.finalizedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : ""}${report.finalizedByName ? ` by ${report.finalizedByName}` : ""}`
            : "Not yet in the gradebook"}
        </p>
      </div>

      <div className="mt-6 divide-y divide-[var(--color-border)] border-t border-[var(--color-border)]">
        {report.criteria.map((criterion) => (
          <details key={criterion.key} className="group/criterion">
            <summary className="flex cursor-pointer list-none items-baseline gap-3 py-3.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)] [&::-webkit-details-marker]:hidden">
              <ChevronRight
                size={13}
                strokeWidth={2}
                aria-hidden
                className="mt-1 shrink-0 text-[var(--color-faint)] transition-transform group-open/criterion:rotate-90"
              />
              <h3 className="min-w-0 flex-1 text-[0.875rem] font-medium text-[var(--color-ink)]">{criterion.name}</h3>
              <span className={cn("shrink-0 text-[0.78125rem] font-medium", levelColor[criterion.level])}>{criterion.level}</span>
              <span className="shrink-0 text-[0.78125rem] tabular-nums text-[var(--color-muted)]">
                {criterion.score}
                <span className="text-[var(--color-faint)]"> / {criterion.maxScore}</span>
              </span>
            </summary>

            <div className="pb-5 pl-6">
              <p className="max-w-2xl text-[0.8125rem] leading-6 text-[var(--color-muted)]">{criterion.rationale}</p>
              {criterion.evidence.length > 0 ? (
                <ul className="mt-3 space-y-2">
                  {criterion.evidence.map((evidence) => (
                    <li key={evidence.id}>
                      <a
                        href={`#turn-${evidence.turnId}`}
                        className="group flex max-w-2xl items-start gap-2 rounded-row text-[0.78125rem] leading-5 text-[var(--color-ink)] transition hover:text-[var(--color-accent-strong)]"
                      >
                        <Quote size={12} className="mt-1 shrink-0 text-[var(--color-accent-strong)]" aria-hidden />
                        <span className="italic">&ldquo;{evidence.quote}&rdquo;</span>
                        <span className="ml-auto shrink-0 text-[0.6875rem] not-italic text-[var(--color-faint)] group-hover:text-[var(--color-accent-strong)]">In transcript</span>
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-[0.75rem] text-[var(--color-faint)]">No verified evidence for this criterion.</p>
              )}
            </div>
          </details>
        ))}
      </div>

      {report.status === "draft" ? (
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <form action={finalizeJourneyReport}>
            <input type="hidden" name="reportId" value={report.id} />
            <PendingActionButton
              pendingLabel="Posting"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-control border border-[var(--color-ink)] bg-[var(--color-ink)] px-3 text-[0.78125rem] font-medium text-[var(--color-bg)] transition hover:border-[var(--color-accent-strong)] hover:bg-[var(--color-accent-strong)]"
            >
              <BadgeCheck size={13} aria-hidden />
              Post final grade
            </PendingActionButton>
          </form>
          <form action={regradeJourneyReport}>
            <input type="hidden" name="submissionId" value={submissionId} />
            <PendingActionButton
              pendingLabel="Grading"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-control border border-[var(--color-border-strong)] px-3 text-[0.78125rem] font-medium text-[var(--color-muted)] transition hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]"
            >
              <RotateCcw size={12} aria-hidden />
              Grade again
            </PendingActionButton>
          </form>
        </div>
      ) : null}
    </section>
  );
}
