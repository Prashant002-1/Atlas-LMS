/**
 * Date facts, stated plainly. A due date reads as the fact it is, including
 * when it has passed: the overview never hides an overdue record behind
 * "Nothing due".
 */

const DAY = 24 * 60 * 60 * 1000;

export function shortDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** "Overdue by 2 days" / "Due today" / "Due tomorrow" / "Due in 4 days" / "Due Jul 21". */
export function dueLabel(dueAt: Date, now: Date = new Date()): string {
  const days = Math.ceil((dueAt.getTime() - now.getTime()) / DAY);
  if (days < 0) {
    const behind = Math.abs(days);
    return behind === 1 ? "Overdue by 1 day" : `Overdue by ${behind} days`;
  }
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days < 7) return `Due in ${days} days`;
  return `Due ${shortDate(dueAt)}`;
}

export function isOverdue(dueAt: Date, now: Date = new Date()): boolean {
  return dueAt.getTime() < now.getTime();
}

/** "Opens Jul 14" for a module that has not unlocked yet. */
export function opensLabel(unlockAt: Date): string {
  return `Opens ${shortDate(unlockAt)}`;
}
