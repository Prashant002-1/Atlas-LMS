import { auth } from "@/lib/auth";
import { loadInstructorCalendar, type InstructorCalendarEntry } from "@/lib/instructor/workspace";
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
 * The teaching calendar: every dated fact in the course in view, drafts
 * included and marked. Each entry links back to the assignment or module
 * it comes from.
 */
export default async function TeachCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;

  const now = new Date();
  const [year, month] = parseMonth(params.m) ?? [now.getFullYear(), now.getMonth()];
  const calendar = await loadInstructorCalendar(session?.user, monthWindow(year, month));

  if (calendar.problem) {
    return (
      <>
        <PageHeader title="Calendar" />
        <p className="max-w-lg text-[0.875rem] leading-6 text-[var(--color-muted)]">{calendar.problem.detail}</p>
      </>
    );
  }

  const entries = calendar.entries.map(toMonthEntry);
  const monthLabel = new Date(year, month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  return (
    <>
      <PageHeader
        title="Calendar"
        course={`${calendar.course.code} / ${monthLabel}`}
        action={<MonthNav basePath="/teach/calendar" year={year} month={month} isCurrentMonth={isCurrentMonth} />}
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

function toMonthEntry(entry: InstructorCalendarEntry, index: number): MonthEntry {
  return {
    id: `${entry.kind}-${entry.href}-${index}`,
    date: entry.date,
    title: entry.title,
    href: entry.href,
    tone: !entry.published ? "faint" : entry.kind === "due" ? "accent" : "outline",
    fact: entry.kind === "due" ? (entry.published ? "Due" : "Draft due") : entry.published ? "Opens" : "Draft opens",
  };
}
