import { auth } from "@/lib/auth";
import { loadInstructorCalendar, type InstructorCalendarEntry } from "@/lib/instructor/workspace";
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
  const monthEntries = entries.filter((entry) => entry.date.getMonth() === month && entry.date.getFullYear() === year);

  return (
    <>
      <PageHeader
        title="Calendar"
        course={`${calendar.course.code} / ${monthLabel}`}
        action={<MonthNav basePath="/teach/calendar" year={year} month={month} isCurrentMonth={isCurrentMonth} />}
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
                title="No events"
              />
            </div>
          )}
        </div>
      </section>
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
