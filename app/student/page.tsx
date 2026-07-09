import Link from "next/link";
import { ArrowUpRight, ChevronRight } from "lucide-react";
import { auth } from "@/lib/auth";
import { loadStudentOverview, type StudentCourseCard } from "@/lib/student/workspace";
import { dueLabel } from "@/lib/student/format";
import { PageHeader } from "@/components/teach/page-header";
import { StatusBadge, TextLink } from "@/components/atlas/primitives";
import { EmptyState } from "@/components/atlas/record";
import { StaggerGrid, MotionItem } from "@/components/atlas/motion";

/**
 * The student home: every course at a glance. What is due (overdue first,
 * stated as the fact it is), then each course as its own card. The work
 * itself lives on the course pages.
 */
export default async function StudentOverviewPage() {
  const session = await auth();
  const overview = await loadStudentOverview(session?.user);

  return (
    <>
      <PageHeader title="Home" />

      <section className="mb-7">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--color-faint)]">Due</h2>
        {overview.dueSoon.length > 0 ? (
          <StaggerGrid className="mt-2.5 space-y-2" stagger={0.05}>
            {overview.dueSoon.map((item) => (
              <MotionItem key={`${item.assignmentId}-${item.overdue ? "overdue" : "ahead"}`}>
                <Link
                  href={`/student/work/${item.assignmentId}`}
                  className="atlas-card-hover group flex items-center justify-between gap-3 rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 shadow-[var(--shadow-panel)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-accent-strong)]"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-medium">{item.name}</span>
                    <span className="atlas-mono mt-0.5 block text-[11.5px] uppercase tracking-[0.06em] text-[var(--color-faint)]">
                      {item.courseCode}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span
                      className={`text-[12.5px] ${
                        item.overdue ? "font-medium text-[var(--color-danger)]" : "text-[var(--color-muted)]"
                      }`}
                    >
                      {dueLabel(item.dueAt)}
                    </span>
                    <ChevronRight
                      size={14}
                      strokeWidth={2}
                      aria-hidden
                      className="text-[var(--color-faint)] transition group-hover:translate-x-0.5 group-hover:text-[var(--color-muted)]"
                    />
                  </span>
                </Link>
              </MotionItem>
            ))}
          </StaggerGrid>
        ) : (
          <div className="mt-2.5 rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-panel)]">
            <EmptyState
              art="horizon"
              title="Nothing due"
              detail="No open work has a deadline ahead of you."
              action={<TextLink href="/student/calendar" className="text-[13px]">Open the calendar</TextLink>}
            />
          </div>
        )}
      </section>

      <section>
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--color-faint)]">Courses</h2>
        {overview.cards.length > 0 ? (
          <StaggerGrid className="mt-2.5 grid gap-3 md:grid-cols-2" stagger={0.06}>
            {overview.cards.map((card) => (
              <MotionItem key={card.courseId}>
                <CourseCard card={card} />
              </MotionItem>
            ))}
          </StaggerGrid>
        ) : (
          <div className="mt-2.5 rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-panel)]">
            <EmptyState art="atlas" title="No courses" detail="You are not enrolled in anything yet." />
          </div>
        )}
      </section>
    </>
  );
}

function CourseCard({ card }: { card: StudentCourseCard }) {
  const counts: string[] = [`${card.openCount} open`];
  if (card.waitingCount > 0) counts.push(`${card.waitingCount} waiting`);
  if (card.missingCount > 0) counts.push(`${card.missingCount} missing`);

  return (
    <Link
      href={`/student/course/${card.courseId}`}
      className="atlas-card-hover group block rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-panel)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="atlas-mono text-[11.5px] uppercase tracking-[0.06em] text-[var(--color-faint)]">{card.code}</p>
          <p className="mt-0.5 truncate text-[15px] font-semibold leading-6">{card.name}</p>
        </div>
        <span className="flex shrink-0 items-center gap-2">
          {card.standing ? <StatusBadge tone="neutral">{card.standing}</StatusBadge> : null}
          <ArrowUpRight
            size={14}
            strokeWidth={2}
            aria-hidden
            className="text-[var(--color-faint)] transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[var(--color-accent-strong)]"
          />
        </span>
      </div>
      {/* The nearest date fact. An overdue record always outranks "Nothing due". */}
      {card.overdue ? (
        <p className="mt-3 truncate text-[12.5px] font-medium leading-5 text-[var(--color-danger)]">
          {card.overdue.name}, {dueLabel(card.overdue.dueAt).toLowerCase()}
        </p>
      ) : (
        <p className="mt-3 truncate text-[12.5px] leading-5 text-[var(--color-muted)]">
          {card.nextDue ? `${card.nextDue.name}, ${dueLabel(card.nextDue.dueAt).toLowerCase()}` : "Nothing due"}
        </p>
      )}
      <p className="mt-1 text-[12.5px] text-[var(--color-muted)]">{counts.join(" / ")}</p>
    </Link>
  );
}
