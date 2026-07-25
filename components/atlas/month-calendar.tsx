import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * The month calendar, shared by both workspaces. It renders dated facts that
 * link back to the records they come from; the page decides what an entry is
 * and what state it carries. Nothing here reads the database.
 */

export type MonthEntry = {
  id: string;
  date: Date;
  title: string;
  href: string;
  /** Course code, shown in cross-course lists. */
  code?: string;
  /** The dot: accent = ahead, outline = opens, danger = overdue, faint = settled. */
  tone: "accent" | "outline" | "danger" | "faint";
  /** The stated fact: "Due", "Opens", "Overdue", "Submitted", "Graded", "Draft". */
  fact: string;
};

/** Previous / today / next month controls. Pages pass their own base path. */
export function MonthNav({
  basePath,
  year,
  month,
  isCurrentMonth,
}: {
  basePath: string;
  year: number;
  month: number;
  isCurrentMonth: boolean;
}) {
  const navLink =
    "inline-flex size-8 items-center justify-center rounded-control border border-[var(--color-border)] text-[var(--color-muted)] transition hover:border-[var(--color-border-strong)] hover:text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)]";

  return (
    <div className="flex items-center gap-2">
      {!isCurrentMonth ? (
        <Link
          href={basePath}
          className="inline-flex min-h-8 items-center rounded-control border border-[var(--color-border)] px-2.5 text-[0.78125rem] font-medium text-[var(--color-muted)] transition hover:border-[var(--color-border-strong)] hover:text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)]"
        >
          Today
        </Link>
      ) : null}
      <Link href={`${basePath}?m=${monthKey(year, month - 1)}`} aria-label="Previous month" className={navLink}>
        <ChevronLeft size={15} strokeWidth={2} aria-hidden />
      </Link>
      <Link href={`${basePath}?m=${monthKey(year, month + 1)}`} aria-label="Next month" className={navLink}>
        <ChevronRight size={15} strokeWidth={2} aria-hidden />
      </Link>
    </div>
  );
}

/* Month math, local time. Shared by every calendar page. */

export function parseMonth(value?: string): [number, number] | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  if (month < 0 || month > 11) return null;
  return [year, month];
}

export function monthKey(year: number, month: number): string {
  const date = new Date(year, month, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function monthWindow(year: number, month: number): { from: Date; to: Date } {
  const monthStart = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weeks = Math.ceil((monthStart.getDay() + daysInMonth) / 7);
  const gridStart = addDays(monthStart, -monthStart.getDay());
  const gridEnd = addDays(gridStart, weeks * 7 - 1);
  return { from: gridStart, to: new Date(gridEnd.getFullYear(), gridEnd.getMonth(), gridEnd.getDate(), 23, 59, 59) };
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
