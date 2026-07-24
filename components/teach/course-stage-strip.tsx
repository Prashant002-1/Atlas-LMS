import { cn } from "@/lib/utils";

/**
 * Where the course is, on one line.
 *
 * "Week 2 of 14" is the fact a professor opens a course to see, and the overview
 * used to lead with an assignment list instead, which is why it read as a second
 * copy of the assignments page. The rule underneath carries the same information
 * spatially, so the position registers before the words are read.
 *
 * No percentage on screen. A course is not 14% done, it is in week two, and the
 * number would invite a precision the dates do not support.
 */
export function CourseStageStrip({
  label,
  stage,
  fraction,
  weeksRemaining,
}: {
  label: string;
  stage: string;
  fraction: number | null;
  weeksRemaining: number | null;
}) {
  return (
    <section aria-label="Course progress" className="mb-9 border-y border-[var(--color-border)] py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="text-[0.9375rem] font-semibold text-[var(--color-ink)]">{label}</p>
        <p className="flex flex-wrap items-baseline gap-x-4 text-[0.78125rem] text-[var(--color-muted)]">
          <span>{stage}</span>
          {typeof weeksRemaining === "number" && weeksRemaining > 0 ? (
            <span>{weeksRemaining} {weeksRemaining === 1 ? "week" : "weeks"} left</span>
          ) : null}
        </p>
      </div>

      {typeof fraction === "number" ? (
        <div
          className="mt-3 h-0.5 w-full overflow-hidden rounded-full bg-[var(--color-border)]"
          role="img"
          aria-label={`${label}, ${stage}`}
        >
          <div
            className={cn("h-full rounded-full bg-[var(--color-accent-strong)]")}
            style={{ width: `${Math.round(Math.min(1, Math.max(0.02, fraction)) * 100)}%` }}
          />
        </div>
      ) : null}
    </section>
  );
}
