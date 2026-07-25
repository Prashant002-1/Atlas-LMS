import { auth } from "@/lib/auth";
import { loadStudentCalendar, type StudentCalendarEntry } from "@/lib/student/workspace";
import { PageHeader } from "@/components/teach/page-header";
import {
  MonthNav,
  monthWindow,
  monthKey,
  parseMonth,
  type MonthEntry,
} from "@/components/atlas/month-calendar";
import { InteractiveMonthCalendar } from "@/components/atlas/interactive-month-calendar";

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

  return (
    <>
      <PageHeader
        title="Calendar"
        course={monthLabel}
        action={<MonthNav basePath="/student/calendar" year={year} month={month} isCurrentMonth={isCurrentMonth} />}
      />

      <InteractiveMonthCalendar
        key={monthKey(year, month)}
        year={year}
        month={month}
        today={now}
        entries={entries}
      />
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
