import Link from "next/link";
import { auth } from "@/lib/auth";
import { loadInstructorWorkspace } from "@/lib/instructor/workspace";
import { PageHeader } from "@/components/teach/page-header";
import { EmptyRecord } from "@/components/atlas/record";

/**
 * The teaching overview: a glance, not a control room. Four numbers, the next
 * three things worth doing, the latest note. Every detail lives on its page.
 */
export default async function TeachOverviewPage() {
  const session = await auth();
  const workspace = await loadInstructorWorkspace(session?.user);

  if (workspace.problem) {
    return (
      <>
        <PageHeader title={workspace.problem.title} />
        <p className="max-w-lg text-[14px] leading-6 text-[var(--color-muted)]">{workspace.problem.detail}</p>
      </>
    );
  }

  const toGrade = workspace.workProgress.reduce((sum, item) => sum + Math.max(0, item.submitted - item.graded), 0);
  const inReview = workspace.proposals.filter((p) => p.status === "pending").length;
  const drafts =
    workspace.modules.filter((m) => m.status !== "approved").length +
    workspace.assignments.filter((a) => a.status !== "approved").length;
  const missing = workspace.workProgress.reduce((sum, item) => sum + item.missing, 0);

  const gradeNext = workspace.workProgress
    .filter((item) => item.submitted - item.graded > 0)
    .sort((a, b) => b.submitted - b.graded - (a.submitted - a.graded))[0];
  const reviewNext = workspace.proposals.find((p) => p.status === "pending");
  const publishNext = workspace.modules.find((m) => m.status !== "approved") ?? null;
  const latestNote = workspace.notices[0];

  const actions = [
    gradeNext
      ? {
          href: gradeNext.assignmentId ? `/teach/work/${gradeNext.assignmentId}` : "/teach/work",
          label: `Grade ${gradeNext.title}`,
          detail: `${gradeNext.submitted - gradeNext.graded} waiting`,
        }
      : null,
    reviewNext
      ? { href: "/teach/review", label: `Review: ${reviewNext.title}`, detail: "Drafted by Atlas, waiting on you" }
      : null,
    publishNext
      ? {
          href: publishNext.id ? `/teach/week/${publishNext.id}` : "/teach/weeks",
          label: `Publish week ${publishNext.week}`,
          detail: publishNext.title,
        }
      : null,
    missing > 0 ? { href: "/teach/students", label: "Check missing work", detail: `${missing} items missing` } : null,
  ].filter((a): a is { href: string; label: string; detail: string } => a !== null);

  return (
    <>
      <PageHeader title="Overview" course={`${workspace.course.code} / ${workspace.course.term}`} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="To grade" value={toGrade} href="/teach/work" />
        <Stat label="In review" value={inReview} href="/teach/review" />
        <Stat label="Drafts" value={drafts} href="/teach/weeks" />
        <Stat label="Students" value={workspace.students.length} href="/teach/students" />
      </div>

      <section className="mt-7">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[var(--color-faint)]">Next</h2>
        <div className="mt-2 divide-y divide-[var(--color-border)] rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-panel)]">
          {actions.length > 0 ? (
            actions.slice(0, 3).map((action) => (
              <Link
                key={action.href + action.label}
                href={action.href}
                className="flex items-center justify-between gap-3 px-4 py-3.5 transition hover:bg-[var(--color-surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-accent-strong)]"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-medium">{action.label}</span>
                  <span className="mt-0.5 block text-[12.5px] text-[var(--color-muted)]">{action.detail}</span>
                </span>
                <span aria-hidden className="text-[var(--color-faint)]">&rarr;</span>
              </Link>
            ))
          ) : (
            <div className="px-4 py-4">
              <EmptyRecord title="Clear" detail="Nothing needs you right now." />
            </div>
          )}
        </div>
      </section>

      {latestNote ? (
        <section className="mt-7">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[var(--color-faint)]">Latest note</h2>
          <div className="mt-2 rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3.5 shadow-[var(--shadow-panel)]">
            <p className="text-[14px] font-medium">{latestNote.title}</p>
            {latestNote.message ? (
              <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-[var(--color-muted)]">{latestNote.message}</p>
            ) : null}
          </div>
        </section>
      ) : null}
    </>
  );
}

function Stat({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link
      href={href}
      className="rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 shadow-[var(--shadow-panel)] transition hover:border-[var(--color-border-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)]"
    >
      <p className="atlas-mono text-[24px] font-medium leading-8">{value}</p>
      <p className="mt-0.5 text-[12.5px] text-[var(--color-muted)]">{label}</p>
    </Link>
  );
}
