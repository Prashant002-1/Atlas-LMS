import { requestJourneyReview } from "@/lib/student/actions";
import { cn } from "@/lib/utils";
import type { StudentJourneyReportView } from "@/lib/student/session-view";

const levelColor = {
  Exceeds: "text-[var(--color-good)]",
  Meets: "text-[var(--color-accent-strong)]",
  Developing: "text-[var(--color-warn)]",
  Missing: "text-[var(--color-danger)]",
} as const;

export function JourneyReportPanel({
  report,
  assignmentId,
  compact = false,
}: {
  report: StudentJourneyReportView;
  assignmentId: string;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <section aria-labelledby="student-grade-heading">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="student-grade-heading" className="text-[0.8125rem] font-semibold text-[var(--color-ink)]">Grade</h2>
            <p className="mt-1 text-[1.5rem] font-semibold leading-none tabular-nums text-[var(--color-ink)]">
              {Math.round(report.overallScore)}
              <span className="text-[0.75rem] font-normal text-[var(--color-muted)]"> / {Math.round(report.maxScore)}</span>
            </p>
          </div>
          <p className="text-right text-[0.6875rem] leading-4 text-[var(--color-faint)]">
            {report.status === "final" ? "Posted by your professor" : "Draft grade"}
          </p>
        </div>
        <div className="mt-3 space-y-1">
          {report.criteria.map((criterion) => (
            <details key={criterion.key} className="group py-2.5">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
                <span className="text-[0.75rem] font-medium leading-5 text-[var(--color-ink)]">{criterion.name}</span>
                <span className="shrink-0 text-right">
                  <span className={cn("block text-[0.71875rem] font-medium", levelColor[criterion.level])}>{criterion.level}</span>
                  <span className="block text-[0.65625rem] tabular-nums text-[var(--color-faint)]">{criterion.score}/{criterion.maxScore}</span>
                </span>
              </summary>
              <p className="mt-2 text-[0.75rem] leading-5 text-[var(--color-muted)]">{criterion.rationale}</p>
              {criterion.evidence.length > 0 ? (
                <div className="mt-2 space-y-2">
                  {criterion.evidence.map((evidence) => (
                    <blockquote key={evidence.id} className="border-l border-[var(--color-accent-strong)] pl-2.5 text-[0.71875rem] italic leading-5 text-[var(--color-muted)]">
                      &ldquo;{evidence.quote}&rdquo;
                    </blockquote>
                  ))}
                </div>
              ) : null}
            </details>
          ))}
        </div>
        <ReviewControl report={report} assignmentId={assignmentId} compact />
      </section>
    );
  }

  return (
    <section aria-labelledby="student-grade-heading" className="py-5">
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

      <div className="mt-5 space-y-1">
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
                      <summary className="cursor-pointer list-none text-[0.78125rem] italic leading-5 text-[var(--color-ink)]">
                        &ldquo;{evidence.quote}&rdquo;
                      </summary>
                      <div className="mt-2 space-y-1 pl-3 text-[0.71875rem] leading-5 text-[var(--color-faint)]">
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
      <ReviewControl report={report} assignmentId={assignmentId} />
    </section>
  );
}

function ReviewControl({
  report,
  assignmentId,
  compact = false,
}: {
  report: StudentJourneyReportView;
  assignmentId: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-3", compact ? "mt-3 justify-start" : "mt-4 justify-end")}>
      {report.reviewRequestedAt ? (
        <p className="text-[0.71875rem] text-[var(--color-muted)]">
          Professor review requested {new Date(report.reviewRequestedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </p>
      ) : (
        <form action={requestJourneyReview}>
          <input type="hidden" name="reportId" value={report.id} />
          <input type="hidden" name="assignmentId" value={assignmentId} />
          <button
            type="submit"
            className="inline-flex min-h-8 items-center rounded-control border border-[var(--color-border-strong)] px-2.5 text-[0.75rem] font-medium text-[var(--color-muted)] transition hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]"
          >
            Request professor review
          </button>
        </form>
      )}
    </div>
  );
}
