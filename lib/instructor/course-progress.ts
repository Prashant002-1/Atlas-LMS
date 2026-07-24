/**
 * Where the course is right now.
 *
 * The overview answered "what assignments exist" and never "what week is it",
 * which is the first thing a professor actually wants on opening a course. Week
 * number, how far through the term, and what is happening this week are all
 * derivable from dates the course already has, so none of this is new data.
 *
 * Pure and date-injected so it can be tested without a clock or a database.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

export type CourseStage = "before" | "opening" | "midterm" | "closing" | "after";

export type CourseProgress = {
  stage: CourseStage;
  /** 1-based week of the term. Clamped into the term, null when there are no dates. */
  week: number | null;
  totalWeeks: number | null;
  /** Whole weeks left, floor, never negative. */
  weeksRemaining: number | null;
  /** 0..1 through the term, for a rule rather than a percentage on screen. */
  fraction: number | null;
  label: string;
};

export function courseProgress(args: {
  startDate: Date | null;
  endDate: Date | null;
  now?: Date;
}): CourseProgress {
  const now = args.now ?? new Date();
  const { startDate, endDate } = args;

  if (!startDate || !endDate || endDate.getTime() <= startDate.getTime()) {
    return { stage: "before", week: null, totalWeeks: null, weeksRemaining: null, fraction: null, label: "Term dates not set" };
  }

  const span = endDate.getTime() - startDate.getTime();
  const totalWeeks = Math.max(1, Math.round(span / WEEK_MS));

  if (now.getTime() < startDate.getTime()) {
    const daysUntil = Math.ceil((startDate.getTime() - now.getTime()) / DAY_MS);
    return {
      stage: "before",
      week: null,
      totalWeeks,
      weeksRemaining: totalWeeks,
      fraction: 0,
      label: daysUntil === 1 ? "Starts tomorrow" : `Starts in ${daysUntil} days`,
    };
  }

  if (now.getTime() > endDate.getTime()) {
    return { stage: "after", week: totalWeeks, totalWeeks, weeksRemaining: 0, fraction: 1, label: "Term complete" };
  }

  const elapsed = now.getTime() - startDate.getTime();
  const week = Math.min(totalWeeks, Math.floor(elapsed / WEEK_MS) + 1);
  const weeksRemaining = Math.max(0, totalWeeks - week);
  const fraction = Math.min(1, Math.max(0, elapsed / span));

  /*
   * Three named stretches rather than a percentage. "Week 2 of 14" is the fact;
   * the stage is what it means for how the professor spends the week.
   */
  const stage: CourseStage = fraction < 0.3 ? "opening" : fraction < 0.75 ? "midterm" : "closing";

  return {
    stage,
    week,
    totalWeeks,
    weeksRemaining,
    fraction,
    label: `Week ${week} of ${totalWeeks}`,
  };
}

export function stageLabel(stage: CourseStage): string {
  return {
    before: "Not started",
    opening: "Opening weeks",
    midterm: "Mid term",
    closing: "Final weeks",
    after: "Complete",
  }[stage];
}
