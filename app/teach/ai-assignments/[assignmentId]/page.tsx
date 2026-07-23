import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { loadAssignmentCockpit } from "@/lib/instructor/cockpit";
import { PageHeader } from "@/components/teach/page-header";
import { BackLink, ButtonLink } from "@/components/atlas/primitives";
import { SessionTable } from "@/components/cockpit/session-table";
import { ClassInsight } from "@/components/cockpit/class-insight";
import { AssignmentSettings, RubricSummary } from "@/components/cockpit/contract-rubric";

/**
 * One AI assignment: class sessions first, analysis second, setup on demand.
 * JourneyGrid was replaced by the filterable SessionTable.
 */
export default async function AssignmentCockpitPage({ params }: { params: Promise<{ assignmentId: string }> }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in");
  }
  const { assignmentId } = await params;
  const view = await loadAssignmentCockpit(session.user, assignmentId);

  if (view.problem) {
    return (
      <>
        <PageHeader title="AI assignment" />
        <p className="max-w-lg text-[0.875rem] leading-6 text-[var(--color-muted)]">{view.problem.detail}</p>
      </>
    );
  }

  const criterionNames = Object.fromEntries(view.rubric.criteria.map((criterion) => [criterion.key, criterion.name]));
  const maxScore = view.rubric.criteria.reduce(
    (sum, criterion) => sum + criterion.levels.reduce((max, level) => Math.max(max, level.score), 0),
    0
  );
  const draftGrades = view.counts.draft + view.counts.reviewRequested;

  return (
    <>
      <BackLink href="/teach/ai-assignments">AI assignments</BackLink>

      <div className="mt-3">
        <PageHeader
          title={view.assignment.name}
          course={`${view.course.code}, AI assignment`}
          action={<ButtonLink href={`/teach/assignments/${view.assignment.id}`} variant="secondary" size="sm">Open assignment</ButtonLink>}
        />
      </div>

      <div className="-mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[0.78125rem] text-[var(--color-muted)]">
        {view.assignment.dueAt ? <span>Due {shortDate(view.assignment.dueAt)}</span> : null}
        {view.assignment.pointsPossible ? <span>{Math.round(view.assignment.pointsPossible)} points</span> : null}
        <span>{view.contract.durationMinutes} minute session</span>
      </div>

      <section aria-label="Assignment setup" className="mt-8 grid gap-7 py-6 lg:grid-cols-2 lg:gap-0">
        <div className="lg:pr-8">
          <AssignmentSettings assignmentId={view.assignment.id} contract={view.contract} />
        </div>
        <div className="border-t border-[var(--color-border)] pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
          <RubricSummary criteria={view.rubric.criteria} version={view.rubric.version} />
        </div>
      </section>

      <dl className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4">
        <SummaryFact label="Submitted" value={`${view.counts.submitted} / ${view.counts.students}`} />
        <SummaryFact label="Draft grades" value={String(draftGrades)} />
        <SummaryFact label="Graded" value={String(view.counts.final)} />
        <SummaryFact label="Class average" value={view.insight ? String(Math.round(view.insight.stats.overallAverage)) : "-"} />
      </dl>

      <div className="mt-8">
        <SessionTable rows={view.grid} maxScore={maxScore} />
      </div>

      <div className="mt-10">
        <ClassInsight
          insight={view.insight}
          assignmentId={view.assignment.id}
          criterionNames={criterionNames}
          pendingPracticeProposals={view.pendingPracticeProposals}
        />
      </div>
    </>
  );
}

function SummaryFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-[var(--color-border)] px-4 py-4 first:pl-0 last:border-b-0 lg:border-b-0 lg:border-r lg:last:border-r-0">
      <dt className="text-[0.75rem] text-[var(--color-muted)]">{label}</dt>
      <dd className="mt-1 text-[1.25rem] font-semibold tabular-nums text-[var(--color-ink)]">{value}</dd>
    </div>
  );
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
