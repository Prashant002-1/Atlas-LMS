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

const DOT_TONE: Record<MonthEntry["tone"], string> = {
  accent: "bg-[var(--color-accent)]",
  outline: "border border-[var(--color-faint)] bg-transparent",
  danger: "bg-[var(--color-danger)]",
  faint: "bg-[var(--color-faint)]",
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

/** The month grid: weekday header, one cell per day, entries as linked chips. */
export function MonthGrid({
  year,
  month,
  today,
  entries,
}: {
  year: number;
  month: number;
  today: Date;
  entries: MonthEntry[];
}) {
  const monthStart = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weeks = Math.ceil((monthStart.getDay() + daysInMonth) / 7);
  const gridStart = addDays(monthStart, -monthStart.getDay());
  const days = Array.from({ length: weeks * 7 }, (_, index) => addDays(gridStart, index));

  const byDay = new Map<string, MonthEntry[]>();
  for (const entry of entries) {
    const key = dayKey(entry.date);
    const bucket = byDay.get(key);
    if (bucket) bucket.push(entry);
    else byDay.set(key, [entry]);
  }

  return (
    <div className="overflow-hidden rounded-panel border border-[var(--color-border)] bg-[var(--color-border)] shadow-[var(--shadow-panel)]">
      <div className="grid grid-cols-7 gap-px">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((weekday) => (
          <div key={weekday} className="bg-[var(--color-surface)] px-2 py-1.5">
            <span className="atlas-mono text-[0.65625rem] uppercase tracking-[0.08em] text-[var(--color-faint)]">{weekday}</span>
          </div>
        ))}
        {days.map((day) => {
          const inMonth = day.getMonth() === month;
          const isToday = sameDay(day, today);
          const dayEntries = byDay.get(dayKey(day)) ?? [];
          return (
            <div
              key={dayKey(day)}
              className={`min-h-[5.75rem] px-1.5 py-1.5 ${inMonth ? "bg-[var(--color-surface)]" : "bg-[var(--color-bg)]"}`}
            >
              <span
                className={`atlas-mono inline-flex size-5 items-center justify-center rounded-row text-[0.6875rem] tabular-nums ${
                  isToday
                    ? "bg-[var(--color-accent)] font-semibold text-[var(--color-bg)]"
                    : inMonth
                      ? "text-[var(--color-muted)]"
                      : "text-[var(--color-faint)]"
                }`}
              >
                {day.getDate()}
              </span>
              {dayEntries.length > 0 ? (
                <div className="mt-1 space-y-0.5">
                  {dayEntries.slice(0, 3).map((entry) => (
                    <Link
                      key={entry.id}
                      href={entry.href}
                      title={`${entry.code ? `${entry.code} ` : ""}${entry.title}`}
                      className="group/chip flex items-center gap-1.5 rounded-row px-1 py-0.5 transition hover:bg-[var(--color-surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-accent-strong)]"
                    >
                      <span aria-hidden className={`size-1.5 shrink-0 rounded-full ${DOT_TONE[entry.tone]}`} />
                      <span className="truncate text-[0.6875rem] font-medium text-[var(--color-muted)] transition group-hover/chip:text-[var(--color-ink)]">
                        {entry.title}
                      </span>
                    </Link>
                  ))}
                  {dayEntries.length > 3 ? (
                    <p className="px-1 text-[0.65625rem] text-[var(--color-faint)]">+{dayEntries.length - 3} more</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** The month as rows: date, entry, fact. */
export function MonthEntryList({ entries }: { entries: MonthEntry[] }) {
  return (
    <div className="divide-y divide-[var(--color-border)] rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-panel)]">
      {entries.map((entry) => (
        <Link
          key={`${entry.id}-list`}
          href={entry.href}
          className="group/row flex items-center gap-4 px-4 py-2.5 transition hover:bg-[var(--color-surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-accent-strong)]"
        >
          <span className="atlas-mono w-14 shrink-0 text-[0.71875rem] uppercase tracking-[0.04em] text-[var(--color-faint)]">
            {entry.date.toLocaleDateString("en-US", { weekday: "short", day: "numeric" })}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[0.84375rem] font-medium">{entry.title}</span>
            {entry.code ? (
              <span className="atlas-mono mt-0.5 block text-[0.65625rem] uppercase tracking-[0.06em] text-[var(--color-faint)]">
                {entry.code}
              </span>
            ) : null}
          </span>
          <span
            className={`shrink-0 text-[0.75rem] ${
              entry.tone === "danger" ? "font-medium text-[var(--color-danger)]" : "text-[var(--color-muted)]"
            }`}
          >
            {entry.fact}
          </span>
        </Link>
      ))}
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
