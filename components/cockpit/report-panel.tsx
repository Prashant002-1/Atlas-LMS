import { BadgeCheck, Quote, RotateCcw } from "lucide-react";
import { finalizeJourneyReport, regradeJourneyReport } from "@/lib/instructor/session-actions";
import { StatusBadge } from "@/components/atlas/primitives";
import type { DrillInReport } from "@/lib/instructor/cockpit";

/**
 * The professor's read of a journey report: levels with the rubric's own
 * points, rationales, and evidence quotes that JUMP to their exact place in
 * the transcript below. Finalize is the publish moment (draft -> final ->
 * gradebook, stamped with who and when); Regrade reruns the rubric on a
 * draft and never touches a published grade.
 */

const levelTone = {
  Exceeds: "good",
  Meets: "accent",
  Developing: "warn",
  Missing: "danger",
} as const;

export function ProfessorReportPanel({ report, submissionId }: { report: DrillInReport; submissionId: string }) {
  return (
    <section
      aria-label="Journey report"
      className="rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-panel)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="atlas-mono text-[0.6875rem] uppercase tracking-[0.08em] text-[var(--color-faint)]">Journey report</p>
          <p className="mt-1 text-[1.375rem] font-semibold leading-none">
            {Math.round(report.overallScore)}
            <span className="text-[0.8125rem] font-normal text-[var(--color-muted)]"> / {Math.round(report.maxScore)}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {report.reviewRequestedAt && report.status === "draft" ? (
            <StatusBadge tone="warn">Review requested</StatusBadge>
          ) : null}
          <StatusBadge tone={report.status === "final" ? "good" : "accent"}>
            {report.status === "final" ? "Final" : "Draft"}
          </StatusBadge>
        </div>
      </div>

      <div className="mt-3 space-y-2.5">
        {report.criteria.map((criterion) => (
          <article key={criterion.key} className="rounded-panel border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[0.8125rem] font-semibold text-[var(--color-ink)]">
                {criterion.name}
                <span className="ml-1.5 text-[0.6875rem] font-normal text-[var(--color-faint)]">{criterion.weight}%</span>
              </p>
              <div className="flex items-center gap-2">
                <span className="text-[0.75rem] tabular-nums text-[var(--color-muted)]">
                  {criterion.score}/{criterion.maxScore}
                </span>
                <StatusBadge tone={levelTone[criterion.level]}>{criterion.level}</StatusBadge>
              </div>
            </div>
            <p className="mt-1.5 text-[0.78125rem] leading-5 text-[var(--color-muted)]">{criterion.rationale}</p>
            {criterion.evidence.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {criterion.evidence.map((evidence) => (
                  <li key={evidence.id}>
                    <a
                      href={`#turn-${evidence.turnId}`}
                      className="group flex items-start gap-1.5 rounded-row text-[0.78125rem] leading-5 text-[var(--color-ink)] transition hover:text-[var(--color-accent-strong)]"
                    >
                      <Quote size={11} className="mt-1 shrink-0 text-[var(--color-accent-strong)]" aria-hidden />
                      <span className="italic">&ldquo;{evidence.quote}&rdquo;</span>
                      <span className="atlas-mono ml-auto shrink-0 text-[0.625rem] uppercase tracking-[0.06em] text-[var(--color-faint)] group-hover:text-[var(--color-accent-strong)]">
                        jump
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[0.71875rem] text-[var(--color-faint)]">No verifiable evidence; graded Missing pending your review.</p>
            )}
          </article>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] pt-3">
        <p className="atlas-mono text-[0.65625rem] uppercase tracking-[0.07em] text-[var(--color-faint)]">
          {report.status === "final"
            ? `Published ${report.finalizedAt ? new Date(report.finalizedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : ""}${report.finalizedByName ? ` by ${report.finalizedByName}` : ""}`
            : report.graderLabel && report.graderLabel !== "seed"
              ? `Drafted by ${report.graderLabel}`
              : "Drafted from the seeded record"}
        </p>

        {report.status === "draft" ? (
          <div className="flex items-center gap-2">
            <form action={regradeJourneyReport}>
              <input type="hidden" name="submissionId" value={submissionId} />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-control border border-[var(--color-border-strong)] px-3 py-1.5 text-[0.78125rem] font-medium text-[var(--color-muted)] transition hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]"
              >
                <RotateCcw size={12} aria-hidden />
                Regrade
              </button>
            </form>
            <form action={finalizeJourneyReport}>
              <input type="hidden" name="reportId" value={report.id} />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-control border border-[var(--color-ink)] bg-[var(--color-ink)] px-3 py-1.5 text-[0.78125rem] font-medium text-[var(--color-bg)] transition hover:border-[var(--color-accent-strong)] hover:bg-[var(--color-accent-strong)]"
              >
                <BadgeCheck size={13} aria-hidden />
                Finalize and write gradebook
              </button>
            </form>
          </div>
        ) : null}
      </div>
    </section>
  );
}
