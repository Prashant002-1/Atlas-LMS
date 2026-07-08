import { Quote } from "lucide-react";
import { requestJourneyReview } from "@/lib/student/actions";
import { StatusBadge } from "@/components/atlas/primitives";
import type { StudentJourneyReportView } from "@/lib/student/session-view";

/**
 * Journey report, the student's instant payoff after Submit. Four criteria,
 * each with its level, the rubric's own points, a short rationale, and the
 * VERIFIED evidence quotes behind it (with the surrounding exchange one
 * click away). Scores without receipts are just vibes; this panel is the
 * receipts.
 */

const levelTone = {
  Exceeds: "good",
  Meets: "accent",
  Developing: "warn",
  Missing: "danger",
} as const;

export function JourneyReportPanel({ report, assignmentId }: { report: StudentJourneyReportView; assignmentId: string }) {
  return (
    <section
      aria-label="Journey report"
      className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-panel)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="atlas-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-faint)]">Journey report</p>
          <p className="mt-1.5 text-[24px] font-semibold leading-none">
            {Math.round(report.overallScore)}
            <span className="text-[14px] font-normal text-[var(--color-muted)]"> / {Math.round(report.maxScore)}</span>
          </p>
          <p className="mt-1.5 text-[12px] leading-5 text-[var(--color-muted)]">
            {report.status === "final"
              ? "Confirmed by your professor."
              : "Draft grade from the rubric reading your session; your professor reviews it before it counts."}
          </p>
        </div>
        <StatusBadge tone={report.status === "final" ? "good" : "accent"}>
          {report.status === "final" ? "Final" : "Draft"}
        </StatusBadge>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {report.criteria.map((criterion) => (
          <article
            key={criterion.key}
            className="rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3.5"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] font-semibold text-[var(--color-ink)]">
                {criterion.name}
                <span className="ml-1.5 text-[11px] font-normal text-[var(--color-faint)]">{criterion.weight}%</span>
              </p>
              <StatusBadge tone={levelTone[criterion.level]}>{criterion.level}</StatusBadge>
            </div>
            <p className="mt-1 text-[12px] tabular-nums text-[var(--color-muted)]">
              {criterion.score} / {criterion.maxScore} points
            </p>
            <p className="mt-2 text-[12.5px] leading-5 text-[var(--color-muted)]">{criterion.rationale}</p>

            {criterion.evidence.length > 0 ? (
              <div className="mt-2.5 space-y-2 border-t border-[var(--color-border)] pt-2.5">
                {criterion.evidence.map((evidence) => (
                  <details key={evidence.id} className="group">
                    <summary className="flex cursor-pointer list-none items-start gap-1.5 text-[12.5px] leading-5 text-[var(--color-ink)]">
                      <Quote size={11} className="mt-1 shrink-0 text-[var(--color-accent-strong)]" aria-hidden />
                      <span className="italic">&ldquo;{evidence.quote}&rdquo;</span>
                    </summary>
                    <div className="mt-1.5 space-y-1 pl-5 text-[11.5px] leading-4 text-[var(--color-faint)]">
                      {evidence.before ? (
                        <p>
                          <span className="atlas-mono uppercase tracking-[0.06em]">before ({evidence.before.role}) </span>
                          {evidence.before.text}
                        </p>
                      ) : null}
                      {evidence.after ? (
                        <p>
                          <span className="atlas-mono uppercase tracking-[0.06em]">after ({evidence.after.role}) </span>
                          {evidence.after.text}
                        </p>
                      ) : null}
                    </div>
                  </details>
                ))}
              </div>
            ) : (
              <p className="mt-2.5 border-t border-[var(--color-border)] pt-2.5 text-[11.5px] text-[var(--color-faint)]">
                No verifiable evidence was found for this criterion.
              </p>
            )}
          </article>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-border)] pt-3">
        <p className="atlas-mono text-[10.5px] uppercase tracking-[0.07em] text-[var(--color-faint)]">
          Every quote above is string-verified against your transcript
          {report.graderLabel && report.graderLabel !== "seed" ? ` · graded by ${report.graderLabel}` : ""}
        </p>
        {report.reviewRequestedAt ? (
          <p className="text-[12px] text-[var(--color-muted)]">
            Professor review requested {new Date(report.reviewRequestedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}.
          </p>
        ) : (
          <form action={requestJourneyReview}>
            <input type="hidden" name="reportId" value={report.id} />
            <input type="hidden" name="assignmentId" value={assignmentId} />
            <button
              type="submit"
              className="rounded-full border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3.5 py-1.5 text-[12px] font-medium text-[var(--color-muted)] transition hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]"
            >
              Request professor review
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
