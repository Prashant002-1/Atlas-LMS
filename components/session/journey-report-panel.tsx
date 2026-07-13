import { Quote } from "lucide-react";
import { requestJourneyReview } from "@/lib/student/actions";
import { cn } from "@/lib/utils";
import type { StudentJourneyReportView } from "@/lib/student/session-view";

const levelColor = {
  Exceeds: "text-[var(--color-good)]",
  Meets: "text-[var(--color-accent-strong)]",
  Developing: "text-[var(--color-warn)]",
  Missing: "text-[var(--color-danger)]",
} as const;

export function JourneyReportPanel({ report, assignmentId }: { report: StudentJourneyReportView; assignmentId: string }) {
  return (
    <section aria-labelledby="student-grade-heading" className="border-y border-[var(--color-border)] py-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="student-grade-heading" className="text-[1.125rem] font-semibold text-[var(--color-ink)]">Grade</h2>
          <p className="mt-2 text-[1.75rem] font-semibold leading-none tabular-nums text-[var(--color-ink)]">
            {Math.round(report.overallScore)}
            <span className="text-[0.875rem] font-normal text-[var(--color-muted)]"> / {Math.round(report.maxScore)}</span>
          </p>
        </div>
        <p className="text-[0.75rem] text-[var(--color-muted)]">{report.status === "final" ? "Posted by your professor" : "Draft grade"}</p>
      </div>

      <div className="mt-5 divide-y divide-[var(--color-border)] border-t border-[var(--color-border)]">
        {report.criteria.map((criterion) => (
          <article key={criterion.key} className="grid gap-3 py-4 md:grid-cols-[minmax(11rem,0.36fr)_minmax(0,1fr)]">
            <div>
              <h3 className="text-[0.84375rem] font-semibold text-[var(--color-ink)]">{criterion.name}</h3>
              <p className="mt-1 text-[0.75rem] tabular-nums text-[var(--color-muted)]">{criterion.score} / {criterion.maxScore} points</p>
              <p className={cn("mt-1 text-[0.78125rem] font-medium", levelColor[criterion.level])}>{criterion.level}</p>
            </div>
            <div>
              <p className="text-[0.8125rem] leading-6 text-[var(--color-muted)]">{criterion.rationale}</p>
              {criterion.evidence.length > 0 ? (
                <div className="mt-2.5 space-y-2">
                  {criterion.evidence.map((evidence) => (
                    <details key={evidence.id} className="group">
                      <summary className="flex cursor-pointer list-none items-start gap-2 text-[0.78125rem] leading-5 text-[var(--color-ink)]">
                        <Quote size={12} className="mt-1 shrink-0 text-[var(--color-accent-strong)]" aria-hidden />
                        <span className="italic">&ldquo;{evidence.quote}&rdquo;</span>
                      </summary>
                      <div className="mt-2 space-y-1 pl-5 text-[0.71875rem] leading-5 text-[var(--color-faint)]">
                        {evidence.before ? <p><span className="font-medium">Before: </span>{evidence.before.text}</p> : null}
                        {evidence.after ? <p><span className="font-medium">After: </span>{evidence.after.text}</p> : null}
                      </div>
                    </details>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-[0.75rem] text-[var(--color-faint)]">No verified evidence for this criterion.</p>
              )}
            </div>
          </article>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
        {report.reviewRequestedAt ? (
          <p className="text-[0.75rem] text-[var(--color-muted)]">
            Professor review requested {new Date(report.reviewRequestedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </p>
        ) : (
          <form action={requestJourneyReview}>
            <input type="hidden" name="reportId" value={report.id} />
            <input type="hidden" name="assignmentId" value={assignmentId} />
            <button
              type="submit"
              className="inline-flex min-h-9 items-center rounded-control border border-[var(--color-border-strong)] px-3 text-[0.78125rem] font-medium text-[var(--color-muted)] transition hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]"
            >
              Request professor review
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
