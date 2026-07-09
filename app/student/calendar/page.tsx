import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { auth } from "@/lib/auth";
import { loadStudentCalendar, type StudentCalendarEntry } from "@/lib/student/workspace";
import { PageHeader } from "@/components/teach/page-header";
import { EmptyState } from "@/components/atlas/record";

/**
 * The calendar is a projection of the course record: assignment due dates
 * and module openings, nothing else. Every entry links back to the record
 * it came from. There is no separate event model to fall out of sync.
 */
export default async function StudentCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;

  const now = new Date();
  const [year, month] = parseMonth(params.m) ?? [now.getFullYear(), now.getMonth()];
  const monthStart = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weeks = Math.ceil((monthStart.getDay() + daysInMonth) / 7);
  const gridStart = addDays(monthStart, -monthStart.getDay());
  const gridEnd = addDays(gridStart, weeks * 7 - 1);

  const calendar = await loadStudentCalendar(session?.user, {
    from: gridStart,
    to: new Date(gridEnd.getFullYear(), gridEnd.getMonth(), gridEnd.getDate(), 23, 59, 59),
  });

  const byDay = new Map<string, StudentCalendarEntry[]>();
  for (const entry of calendar.entries) {
    const key = dayKey(entry.date);
    const bucket = byDay.get(key);
    if (bucket) bucket.push(entry);
    else byDay.set(key, [entry]);
  }

  const days = Array.from({ length: weeks * 7 }, (_, index) => addDays(gridStart, index));
  const monthLabel = monthStart.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
  const monthEntries = calendar.entries.filter((entry) => entry.date.getMonth() === month && entry.date.getFullYear() === year);

  const navLink =
    "inline-flex size-8 items-center justify-center rounded-control border border-[var(--color-border)] text-[var(--color-muted)] transition hover:border-[var(--color-border-strong)] hover:text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)]";

  return (
    <>
      <PageHeader
        title="Calendar"
        course={monthLabel}
        action={
          <div className="flex items-center gap-2">
            {!isCurrentMonth ? (
              <Link
                href="/student/calendar"
                className="inline-flex min-h-8 items-center rounded-control border border-[var(--color-border)] px-2.5 text-[12.5px] font-medium text-[var(--color-muted)] transition hover:border-[var(--color-border-strong)] hover:text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)]"
              >
                Today
              </Link>
            ) : null}
            <Link href={`/student/calendar?m=${monthKey(year, month - 1)}`} aria-label="Previous month" className={navLink}>
              <ChevronLeft size={15} strokeWidth={2} aria-hidden />
            </Link>
            <Link href={`/student/calendar?m=${monthKey(year, month + 1)}`} aria-label="Next month" className={navLink}>
              <ChevronRight size={15} strokeWidth={2} aria-hidden />
            </Link>
          </div>
        }
      />

      <div className="overflow-hidden rounded-panel border border-[var(--color-border)] bg-[var(--color-border)] shadow-[var(--shadow-panel)]">
        <div className="grid grid-cols-7 gap-px">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((weekday) => (
            <div key={weekday} className="bg-[var(--color-surface)] px-2 py-1.5">
              <span className="atlas-mono text-[10.5px] uppercase tracking-[0.08em] text-[var(--color-faint)]">{weekday}</span>
            </div>
          ))}
          {days.map((day) => {
            const inMonth = day.getMonth() === month;
            const today = sameDay(day, now);
            const entries = byDay.get(dayKey(day)) ?? [];
            return (
              <div
                key={dayKey(day)}
                className={`min-h-[92px] px-1.5 py-1.5 ${inMonth ? "bg-[var(--color-surface)]" : "bg-[var(--color-bg)]"}`}
              >
                <span
                  className={`atlas-mono inline-flex size-5 items-center justify-center rounded-row text-[11px] tabular-nums ${
                    today
                      ? "bg-[var(--color-accent)] font-semibold text-[var(--color-bg)]"
                      : inMonth
                        ? "text-[var(--color-muted)]"
                        : "text-[var(--color-faint)]"
                  }`}
                >
                  {day.getDate()}
                </span>
                {entries.length > 0 ? (
                  <div className="mt-1 space-y-0.5">
                    {entries.slice(0, 3).map((entry) => (
                      <CalendarChip key={`${entry.href}-${entry.kind}`} entry={entry} now={now} />
                    ))}
                    {entries.length > 3 ? (
                      <p className="px-1 text-[10.5px] text-[var(--color-faint)]">+{entries.length - 3} more</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <section className="mt-6">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--color-faint)]">This month</h2>
        {monthEntries.length > 0 ? (
          <div className="mt-2.5 divide-y divide-[var(--color-border)] rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-panel)]">
            {monthEntries.map((entry) => (
              <Link
                key={`${entry.href}-${entry.kind}-list`}
                href={entry.href}
                className="group/row flex items-center gap-4 px-4 py-2.5 transition hover:bg-[var(--color-surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-accent-strong)]"
              >
                <span className="atlas-mono w-14 shrink-0 text-[11.5px] uppercase tracking-[0.04em] text-[var(--color-faint)]">
                  {entry.date.toLocaleDateString("en-US", { weekday: "short", day: "numeric" })}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium">{entry.title}</span>
                  <span className="atlas-mono mt-0.5 block text-[10.5px] uppercase tracking-[0.06em] text-[var(--color-faint)]">
                    {entry.courseCode}
                  </span>
                </span>
                <span className={`shrink-0 text-[12px] ${entryToneClass(entry, now)}`}>{entryFact(entry, now)}</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-2.5 rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-panel)]">
            <EmptyState
              art="month"
              title="A quiet month"
              detail={`No due dates or module openings fall in ${monthLabel}.`}
            />
          </div>
        )}
      </section>
    </>
  );
}

function CalendarChip({ entry, now }: { entry: StudentCalendarEntry; now: Date }) {
  return (
    <Link
      href={entry.href}
      title={`${entry.courseCode} ${entry.title}`}
      className="group/chip flex items-center gap-1.5 rounded-row px-1 py-0.5 transition hover:bg-[var(--color-surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-accent-strong)]"
    >
      <span aria-hidden className={`size-1.5 shrink-0 rounded-full ${dotClass(entry, now)}`} />
      <span className="truncate text-[11px] font-medium text-[var(--color-muted)] transition group-hover/chip:text-[var(--color-ink)]">
        {entry.title}
      </span>
    </Link>
  );
}

/* Entry facts and tones, derived from the record's own state. */

function overdueOpen(entry: StudentCalendarEntry, now: Date): boolean {
  return entry.kind === "due" && (entry.status === "open" || entry.status === "missing") && entry.date.getTime() < now.getTime();
}

function dotClass(entry: StudentCalendarEntry, now: Date): string {
  if (entry.kind === "opens") return "border border-[var(--color-faint)] bg-transparent";
  if (overdueOpen(entry, now)) return "bg-[var(--color-danger)]";
  if (entry.status === "graded" || entry.status === "submitted") return "bg-[var(--color-faint)]";
  return "bg-[var(--color-accent)]";
}

function entryToneClass(entry: StudentCalendarEntry, now: Date): string {
  return overdueOpen(entry, now) ? "font-medium text-[var(--color-danger)]" : "text-[var(--color-muted)]";
}

function entryFact(entry: StudentCalendarEntry, now: Date): string {
  if (entry.kind === "opens") return "Opens";
  if (entry.status === "graded") return "Graded";
  if (entry.status === "submitted") return "Submitted";
  if (overdueOpen(entry, now)) return "Overdue";
  return "Due";
}

/* Month math, local time. */

function parseMonth(value?: string): [number, number] | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  if (month < 0 || month > 11) return null;
  return [year, month];
}

function monthKey(year: number, month: number): string {
  const date = new Date(year, month, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
