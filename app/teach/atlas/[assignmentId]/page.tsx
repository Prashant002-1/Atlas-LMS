import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { loadAssignmentCockpit } from "@/lib/instructor/cockpit";
import { PageHeader } from "@/components/teach/page-header";
import { BackLink } from "@/components/atlas/primitives";
import { JourneyGrid, JourneyGridSummary } from "@/components/cockpit/journey-grid";
import { ClassInsight } from "@/components/cockpit/class-insight";
import { ContractPanel, RubricEditor } from "@/components/cockpit/contract-rubric";

/**
 * One work session's cockpit: the contract and rubric on the left rail (what
 * the professor governs), the journey grid and class insight in the main
 * column (what the class did). Every number renders from stored rows.
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
        <PageHeader title="Work session" />
        <p className="max-w-lg text-[14px] leading-6 text-[var(--color-muted)]">{view.problem.detail}</p>
      </>
    );
  }

  const criterionNames = Object.fromEntries(view.rubric.criteria.map((criterion) => [criterion.key, criterion.name]));

  return (
    <>
      <BackLink href="/teach/atlas">Atlas</BackLink>

      <div className="mt-3">
        <PageHeader title={view.assignment.name} course={`${view.course.code} / Work session`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-4">
          <section aria-label="Journeys" className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-panel)]">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="atlas-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-faint)]">Journeys</p>
              <JourneyGridSummary counts={view.counts} />
            </div>
            <JourneyGrid rows={view.grid} />
          </section>

          <ClassInsight
            insight={view.insight}
            assignmentId={view.assignment.id}
            criterionNames={criterionNames}
            pendingPracticeProposals={view.pendingPracticeProposals}
          />
        </div>

        <div className="flex w-full flex-col gap-4 self-start xl:sticky xl:top-4">
          <ContractPanel assignmentId={view.assignment.id} contract={view.contract} />
          <RubricEditor
            assignmentId={view.assignment.id}
            criteria={view.rubric.criteria}
            version={view.rubric.version}
            hasReports={view.rubric.hasReports}
          />
        </div>
      </div>
    </>
  );
}
