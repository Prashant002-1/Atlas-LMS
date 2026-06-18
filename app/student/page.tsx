import Link from "next/link";
import { auth } from "@/lib/auth";
import { loadStudentOverview } from "@/lib/student/workspace";
import { PageHeader } from "@/components/teach/page-header";
import { StatusBadge } from "@/components/atlas/primitives";
import { EmptyRecord } from "@/components/atlas/record";
import { StaggerGrid, MotionItem } from "@/components/atlas/motion";

/**
 * The student overview: every course at a glance. What is due, what is
 * waiting, what came back. Each course has its own page for the work itself.
 */
export default async function StudentOverviewPage() {
  const session = await auth();
  const overview = await loadStudentOverview(session?.user);

  return (
    <>
      <PageHeader title="Overview" />

      {overview.dueSoon.length > 0 ? (
        <section className="mb-7">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--color-faint)]">Due next</h2>
          <StaggerGrid className="mt-2.5 space-y-2" stagger={0.05}>
            {overview.dueSoon.map((item) => (
              <MotionItem key={item.assignmentId}>
                <Link
                  href={`/student/work/${item.assignmentId}`}
                  className="atlas-card-hover group flex items-center justify-between gap-3 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 shadow-[var(--shadow-panel)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-accent-strong)]"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-medium">{item.name}</span>
                    <span className="atlas-mono mt-0.5 block text-[11.5px] uppercase tracking-[0.06em] text-[var(--color-faint)]">{item.courseCode}</span>
                  </span>
                  <span className="shrink-0 text-[12.5px] text-[var(--color-muted)]">{dueLabel(item.dueAt)}</span>
                </Link>
              </MotionItem>
            ))}
          </StaggerGrid>
        </section>
      ) : null}

      <section>
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--color-faint)]">Courses</h2>
        {overview.cards.length > 0 ? (
          <StaggerGrid className="mt-2.5 grid gap-3 md:grid-cols-2" stagger={0.06}>
            {overview.cards.map((card) => (
              <MotionItem key={card.courseId}>
                <Link
                  href={`/student/course/${card.courseId}`}
                  className="atlas-card-hover group block rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-panel)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="atlas-mono text-[11.5px] uppercase tracking-[0.06em] text-[var(--color-faint)]">{card.code}</p>
                      <p className="mt-0.5 truncate text-[15px] font-semibold leading-6">{card.name}</p>
                    </div>
                    {card.standing ? <StatusBadge tone="neutral">{card.standing}</StatusBadge> : null}
                  </div>
                  <p className="mt-3 text-[12.5px] leading-5 text-[var(--color-muted)]">
                    {card.nextDue ? `${card.nextDue.name} ${dueLabel(card.nextDue.dueAt).toLowerCase()}` : "Nothing due"}
                  </p>
                  <p className="mt-1 text-[12.5px] text-[var(--color-muted)]">
                    {card.openCount} open
                    {card.waitingCount > 0 ? ` / ${card.waitingCount} waiting` : ""}
                    {card.missingCount > 0 ? ` / ${card.missingCount} missing` : ""}
                  </p>
                  {card.missingCount > 0 ? (
                    <p className="mt-2 text-[12px] font-medium text-[var(--color-warn)]">Missing work needs attention</p>
                  ) : null}
                </Link>
              </MotionItem>
            ))}
          </StaggerGrid>
        ) : (
          <div className="mt-2.5 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-4 shadow-[var(--shadow-panel)]">
            <EmptyRecord title="No courses" detail="You are not enrolled in anything yet." />
          </div>
        )}
      </section>
    </>
  );
}

function dueLabel(dueAt: Date): string {
  const days = Math.ceil((dueAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days < 7) return `Due in ${days} days`;
  return `Due ${dueAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}
