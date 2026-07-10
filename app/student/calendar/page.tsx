import { auth } from "@/lib/auth";
import { loadStudentCalendar, type StudentCalendarEntry } from "@/lib/student/workspace";
import { PageHeader } from "@/components/teach/page-header";
import { EmptyState } from "@/components/atlas/record";
import {
  MonthEntryList,
  MonthGrid,
  MonthNav,
  monthWindow,
  parseMonth,
  type MonthEntry,
} from "@/components/atlas/month-calendar";

/**
 * The student calendar: assignment due dates and module openings across every
 * enrolled course. Each entry links back to the record it came from; there is
 * no separate event model to fall out of sync.
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
  const calendar = await loadStudentCalendar(session?.user, monthWindow(year, month));

  const entries = calendar.entries.map((entry, index) => toMonthEntry(entry, index, now));
  const monthLabel = new Date(year, month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
  const monthEntries = entries.filter((entry) => entry.date.getMonth() === month && entry.date.getFullYear() === year);

  return (
    <>
      <PageHeader
        title="Calendar"
        course={monthLabel}
        action={<MonthNav basePath="/student/calendar" year={year} month={month} isCurrentMonth={isCurrentMonth} />}
      />

      <MonthGrid year={year} month={month} today={now} entries={entries} />

      <section className="mt-6">
        <h2 className="text-[0.8125rem] font-semibold uppercase tracking-[0.08em] text-[var(--color-faint)]">This month</h2>
        <div className="mt-2.5">
          {monthEntries.length > 0 ? (
            <MonthEntryList entries={monthEntries} />
          ) : (
            <div className="rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-panel)]">
              <EmptyState
                art="month"
                title="A quiet month"
                detail={`No due dates or module openings fall in ${monthLabel}.`}
              />
            </div>
          )}
        </div>
      </section>
    </>
  );
}

/* Entry state, derived from the record's own rows. */

function toMonthEntry(entry: StudentCalendarEntry, index: number, now: Date): MonthEntry {
  const overdueOpen =
    entry.kind === "due" &&
    (entry.status === "open" || entry.status === "missing") &&
    entry.date.getTime() < now.getTime();

  const tone: MonthEntry["tone"] =
    entry.kind === "opens" ? "outline" : overdueOpen ? "danger" : entry.status === "graded" || entry.status === "submitted" ? "faint" : "accent";

  const fact =
    entry.kind === "opens"
      ? "Opens"
      : entry.status === "graded"
        ? "Graded"
        : entry.status === "submitted"
          ? "Submitted"
          : overdueOpen
            ? "Overdue"
            : "Due";

  return {
    id: `${entry.kind}-${entry.href}-${index}`,
    date: entry.date,
    title: entry.title,
    href: entry.href,
    code: entry.courseCode || undefined,
    tone,
    fact,
  };
}
