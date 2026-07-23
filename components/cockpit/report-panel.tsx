import { BadgeCheck, Quote, RotateCcw } from "lucide-react";
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

export function ProfessorReportPanel({ report, submissionId }: { report: DrillInReport; submissionId: string }) {
  return (
    <section aria-labelledby="grade-heading">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="grade-heading" className="text-[1.125rem] font-semibold text-[var(--color-ink)]">Grade</h2>
          <p className="mt-2 text-[2rem] font-semibold leading-none tabular-nums text-[var(--color-ink)]">
            {Math.round(report.overallScore)}
            <span className="text-[0.875rem] font-normal text-[var(--color-muted)]"> / {Math.round(report.maxScore)}</span>
          </p>
        </div>
        <div className="text-right text-[0.75rem] leading-5 text-[var(--color-muted)]">
          <p>{report.status === "final" ? "Posted to the gradebook" : "Draft grade"}</p>
          {report.reviewRequestedAt && report.status === "draft" ? <p className="text-[var(--color-warn)]">Student requested review</p> : null}
        </div>
      </div>

      <div className="mt-5 divide-y divide-[var(--color-border)]">
        {report.criteria.map((criterion) => (
          <article key={criterion.key} className="grid gap-3 py-4 lg:grid-cols-[minmax(11rem,0.36fr)_minmax(0,1fr)]">
            <div>
              <div className="flex flex-wrap items-baseline justify-between gap-2 lg:block">
                <h3 className="text-[0.84375rem] font-semibold text-[var(--color-ink)]">{criterion.name}</h3>
                <p className="mt-1 text-[0.75rem] tabular-nums text-[var(--color-muted)]">{criterion.score} / {criterion.maxScore} points</p>
              </div>
              <p className={cn("mt-1 text-[0.78125rem] font-medium", levelColor[criterion.level])}>{criterion.level}</p>
            </div>
            <div>
              <p className="text-[0.8125rem] leading-6 text-[var(--color-muted)]">{criterion.rationale}</p>
              {criterion.evidence.length > 0 ? (
                <ul className="mt-2.5 space-y-2">
                  {criterion.evidence.map((evidence) => (
                    <li key={evidence.id}>
                      <a
                        href={`#turn-${evidence.turnId}`}
                        className="group flex items-start gap-2 rounded-row text-[0.78125rem] leading-5 text-[var(--color-ink)] transition hover:text-[var(--color-accent-strong)]"
                      >
                        <Quote size={12} className="mt-1 shrink-0 text-[var(--color-accent-strong)]" aria-hidden />
                        <span className="italic">&ldquo;{evidence.quote}&rdquo;</span>
                        <span className="ml-auto shrink-0 text-[0.6875rem] not-italic text-[var(--color-faint)] group-hover:text-[var(--color-accent-strong)]">View in transcript</span>
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-[0.75rem] text-[var(--color-faint)]">No verified evidence for this criterion.</p>
              )}
            </div>
          </article>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[0.71875rem] text-[var(--color-muted)]">
          {report.status === "final"
            ? `Posted ${report.finalizedAt ? new Date(report.finalizedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : ""}${report.finalizedByName ? ` by ${report.finalizedByName}` : ""}`
            : "Not yet in the gradebook"}
        </p>

        {report.status === "draft" ? (
          <div className="flex items-center gap-2">
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
            <form action={finalizeJourneyReport}>
              <input type="hidden" name="reportId" value={report.id} />
              <PendingActionButton
                pendingLabel="Posting"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-control border border-[var(--color-ink)] bg-[var(--color-ink)] px-3 text-[0.78125rem] font-medium text-[var(--color-bg)] transition hover:border-[var(--color-accent-strong)] hover:bg-[var(--color-accent-strong)]"
              >
                <BadgeCheck size={13} aria-hidden />
                Post grade
              </PendingActionButton>
            </form>
          </div>
        ) : null}
      </div>
    </section>
  );
}
