import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { loadJourneyDrillIn } from "@/lib/instructor/cockpit";
import { regradeJourneyReport } from "@/lib/instructor/session-actions";
import { PageHeader } from "@/components/teach/page-header";
import { BackLink } from "@/components/atlas/primitives";
import { ProfessorReportPanel } from "@/components/cockpit/report-panel";
import { TranscriptView } from "@/components/cockpit/transcript-view";
import { ArtifactPanel } from "@/components/session/artifact-panel";
import { parseSessionArtifact } from "@/lib/agent/session-parts";
import { PendingActionButton } from "@/components/atlas/pending-action-button";

/** One student's submitted session: grade, submission draft, and transcript. */
export default async function SessionSubmissionPage({ params }: { params: Promise<{ submissionId: string }> }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in");
  }
  const { submissionId } = await params;
  const view = await loadJourneyDrillIn(session.user, submissionId);

  if (view.problem) {
    return (
      <>
        <PageHeader title="Session" />
        <p className="max-w-lg text-[0.875rem] leading-6 text-[var(--color-muted)]">{view.problem.detail}</p>
      </>
    );
  }

  const criterionNames = view.report
    ? Object.fromEntries(view.report.criteria.map((criterion) => [criterion.key, criterion.name]))
    : {};
  const revisions = view.artifacts.flatMap((artifact) => {
    const parsed = parseSessionArtifact(artifact.artifactType, artifact.state);
    return parsed ? [parsed] : [];
  });

  return (
    <>
      <BackLink href={`/teach/ai-assignments/${view.assignment.id}`}>{view.assignment.name}</BackLink>

      <div className="mt-3">
        <PageHeader title={view.student.name} course={`${view.course.code}, ${view.assignment.name}`} />
      </div>

      <div className="-mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[0.78125rem] text-[var(--color-muted)]">
        <span>Submitted {new Date(view.submission.submittedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
        <span>{view.submission.turnCount} turns</span>
        <span>{view.report?.status === "final" ? "Grade posted" : view.report ? "Draft grade" : "Not graded"}</span>
      </div>

      <nav aria-label="Session sections" className="mt-5 flex gap-5 pb-3 text-[0.78125rem]">
        <a href="#grade" className="font-medium text-[var(--color-ink)] underline decoration-[color-mix(in_oklch,var(--color-ink)_25%,transparent)] underline-offset-[3px] hover:text-[var(--color-accent-strong)]">Grade</a>
        <a href="#submission-draft" className="font-medium text-[var(--color-ink)] underline decoration-[color-mix(in_oklch,var(--color-ink)_25%,transparent)] underline-offset-[3px] hover:text-[var(--color-accent-strong)]">Submission draft</a>
        <a href="#transcript" className="font-medium text-[var(--color-ink)] underline decoration-[color-mix(in_oklch,var(--color-ink)_25%,transparent)] underline-offset-[3px] hover:text-[var(--color-accent-strong)]">Transcript</a>
      </nav>

      <div className="mt-8 grid gap-10 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
        <div id="grade" className="scroll-mt-24">
          {view.report ? (
            <ProfessorReportPanel report={view.report} submissionId={view.submission.id} />
          ) : (
            <section aria-labelledby="grade-heading">
              <h2 id="grade-heading" className="text-[1.125rem] font-semibold text-[var(--color-ink)]">Grade</h2>
              <p className="mt-2 text-[0.8125rem] text-[var(--color-muted)]">This session has not been graded.</p>
              <form action={regradeJourneyReport} className="mt-4">
                <input type="hidden" name="submissionId" value={view.submission.id} />
                <PendingActionButton
                  pendingLabel="Grading session"
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-control border border-[var(--color-ink)] bg-[var(--color-ink)] px-3 text-[0.8125rem] font-medium text-[var(--color-bg)] transition hover:border-[var(--color-accent-strong)] hover:bg-[var(--color-accent-strong)]"
                >
                  Grade session
                </PendingActionButton>
              </form>
            </section>
          )}
        </div>

        <div id="submission-draft" className="scroll-mt-24 border-t border-[var(--color-border)] pt-6 xl:border-l xl:border-t-0 xl:pl-8 xl:pt-0">
          <ArtifactPanel revisions={revisions} title="Submission draft" plain />
        </div>
      </div>

      <div id="transcript" className="mt-10 scroll-mt-24">
        <TranscriptView turns={view.turns} sideNotesByTurnIndex={view.sideNotesByTurnIndex} criterionNames={criterionNames} />
      </div>
    </>
  );
}
