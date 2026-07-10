import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { loadJourneyDrillIn } from "@/lib/instructor/cockpit";
import { regradeJourneyReport } from "@/lib/instructor/session-actions";
import { PageHeader } from "@/components/teach/page-header";
import { BackLink, StatusBadge } from "@/components/atlas/primitives";
import { ProfessorReportPanel } from "@/components/cockpit/report-panel";
import { TranscriptView } from "@/components/cockpit/transcript-view";
import { ArtifactPanel } from "@/components/session/artifact-panel";
import { pricingArtifactSchema } from "@/lib/agent/session-parts";

/**
 * The journey drill-in: one student's frozen session, the report that read
 * it, and the receipts joined together; every evidence quote jumps to its
 * highlighted place in the transcript. Spot-check, then publish.
 */
export default async function JourneyDrillInPage({ params }: { params: Promise<{ submissionId: string }> }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in");
  }
  const { submissionId } = await params;
  const view = await loadJourneyDrillIn(session.user, submissionId);

  if (view.problem) {
    return (
      <>
        <PageHeader title="Journey" />
        <p className="max-w-lg text-[0.875rem] leading-6 text-[var(--color-muted)]">{view.problem.detail}</p>
      </>
    );
  }

  const criterionNames = view.report
    ? Object.fromEntries(view.report.criteria.map((criterion) => [criterion.key, criterion.name]))
    : {};

  const revisions = view.artifacts
    .map((artifact) => pricingArtifactSchema.safeParse(artifact.state))
    .filter((parsed) => parsed.success)
    .map((parsed) => ({ state: parsed.data! }));

  return (
    <>
      <BackLink href={`/teach/ai-assignments/${view.assignment.id}`}>{view.assignment.name}</BackLink>

      <div className="mt-3">
        <PageHeader
          title={view.student.name}
          course={`${view.course.code} / ${view.assignment.name}`}
          action={
            <StatusBadge tone={view.submission.status === "graded" ? "good" : "accent"}>
              {view.submission.status === "graded" ? "Graded" : "Submitted"}
            </StatusBadge>
          }
        />
      </div>

      <p className="atlas-mono -mt-4 mb-5 text-[0.6875rem] uppercase tracking-[0.07em] text-[var(--color-faint)]">
        Submitted {new Date(view.submission.submittedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
        {" · "}
        {view.submission.turnCount} turns
      </p>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 space-y-4">
          {view.report ? (
            <ProfessorReportPanel report={view.report} submissionId={view.submission.id} />
          ) : (
            <section className="rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-panel)]">
              <p className="atlas-mono text-[0.6875rem] uppercase tracking-[0.08em] text-[var(--color-faint)]">Journey report</p>
              <p className="mt-2 text-[0.84375rem] leading-6 text-[var(--color-muted)]">
                This submission has not been graded yet. Run the rubric to draft a report; nothing is published until
                you finalize it.
              </p>
              <form action={regradeJourneyReport} className="mt-3">
                <input type="hidden" name="submissionId" value={view.submission.id} />
                <button
                  type="submit"
                  className="rounded-control border border-[var(--color-ink)] bg-[var(--color-ink)] px-3 py-1.5 text-[0.78125rem] font-medium text-[var(--color-bg)] transition hover:border-[var(--color-accent-strong)] hover:bg-[var(--color-accent-strong)]"
                >
                  Run the rubric
                </button>
              </form>
            </section>
          )}

          <TranscriptView turns={view.turns} sideNotesByTurnIndex={view.sideNotesByTurnIndex} criterionNames={criterionNames} />
        </div>

        <div className="flex w-full flex-col gap-4 self-start xl:sticky xl:top-4">
          <ArtifactPanel revisions={revisions} />
        </div>
      </div>
    </>
  );
}
