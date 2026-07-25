import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { loadJourneyDrillIn } from "@/lib/instructor/cockpit";
import { regradeJourneyReport } from "@/lib/instructor/session-actions";
import { PageHeader } from "@/components/teach/page-header";
import { BackLink } from "@/components/atlas/primitives";
import { SectionTabs } from "@/components/teach/section-tabs";
import { ProfessorReportPanel } from "@/components/cockpit/report-panel";
import { TranscriptView } from "@/components/cockpit/transcript-view";
import { ArtifactPanel } from "@/components/session/artifact-panel";
import { parseSessionArtifact } from "@/lib/agent/session-parts";
import { PendingActionButton } from "@/components/atlas/pending-action-button";

/**
 * One student's submitted session.
 *
 * Grade, final work, and transcript are three readings of the same session, so
 * they are tabs rather than three stacked sections: each gets the viewport, and
 * switching costs one click instead of a scroll past everything in between.
 *
 * The header names the student once. The assignment is already above it in the
 * back link, so repeating it as an eyebrow said the same words twice in the
 * same corner of the screen.
 */
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

  const gradeState = view.report?.status === "final" ? "Grade posted" : view.report ? "Draft grade" : "Not graded";

  return (
    <>
      <BackLink href={`/teach/ai-assignments/${view.assignment.id}`}>{view.assignment.name}</BackLink>

      <div className="mt-3">
        <PageHeader title={view.student.name} course={view.course.code} />
      </div>

      <div className="-mt-4 mb-7 flex flex-wrap gap-x-4 gap-y-1 text-[0.78125rem] text-[var(--color-muted)]">
        <span>
          Submitted{" "}
          {new Date(view.submission.submittedAt).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </span>
        <span>{view.submission.turnCount} turns</span>
        <span>{gradeState}</span>
      </div>

      <SectionTabs
        ariaLabel="Session"
        tabs={[
          {
            id: "grade",
            label: "Grade",
            hint: view.report ? `${Math.round(view.report.overallScore)} / ${Math.round(view.report.maxScore)}` : undefined,
            panel: view.report ? (
              <ProfessorReportPanel report={view.report} submissionId={view.submission.id} />
            ) : (
              <div>
                <p className="text-[0.8125rem] text-[var(--color-muted)]">This session has not been graded.</p>
                <form action={regradeJourneyReport} className="mt-4">
                  <input type="hidden" name="submissionId" value={view.submission.id} />
                  <PendingActionButton
                    pendingLabel="Grading session"
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-control border border-[var(--color-ink)] bg-[var(--color-ink)] px-3 text-[0.8125rem] font-medium text-[var(--color-bg)] transition hover:border-[var(--color-accent-strong)] hover:bg-[var(--color-accent-strong)]"
                  >
                    Grade session
                  </PendingActionButton>
                </form>
              </div>
            ),
          },
          {
            id: "final-work",
            label: "Final work",
            hint: revisions.length > 1 ? `${revisions.length} revisions` : undefined,
            panel: <ArtifactPanel revisions={revisions} title="Final work" plain headingHidden />,
          },
          {
            id: "transcript",
            label: "Transcript",
            hint: `${view.submission.turnCount} turns`,
            panel: (
              <TranscriptView
                turns={view.turns}
                sideNotesByTurnIndex={view.sideNotesByTurnIndex}
                criterionNames={criterionNames}
              />
            ),
          },
        ]}
      />
    </>
  );
}
