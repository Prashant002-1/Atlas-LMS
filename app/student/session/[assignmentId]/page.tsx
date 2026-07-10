import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { loadStudentSessionView } from "@/lib/student/session-view";
import { PageHeader } from "@/components/teach/page-header";
import { BackLink, StatusBadge } from "@/components/atlas/primitives";
import { SessionRoom } from "@/components/session/session-room";
import { JourneyReportPanel } from "@/components/session/journey-report-panel";

/**
 * The work session surface. The assignment IS this session: a governed
 * conversation with the course agent, an evolving artifact, side notes from
 * the student's own record, and Submit freezing it all into the gradebook.
 */
export default async function StudentSessionPage({ params }: { params: Promise<{ assignmentId: string }> }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in?role=student");
  }
  const { assignmentId } = await params;
  const view = await loadStudentSessionView(session.user, assignmentId);

  if (view.problem) {
    return (
      <>
        <PageHeader title={view.problem.title} />
        <p className="max-w-lg text-[0.875rem] leading-6 text-[var(--color-muted)]">{view.problem.detail}</p>
      </>
    );
  }

  return (
    <>
      <BackLink href={`/student/work/${view.assignment.id}`}>{view.assignment.name}</BackLink>

      <div className="mt-3">
        <PageHeader
          title={view.assignment.name}
          course={`${view.course.code} / Work session`}
          action={
            view.submitted ? (
              <StatusBadge tone="good">Submitted</StatusBadge>
            ) : (
              <StatusBadge tone="accent">Live</StatusBadge>
            )
          }
        />
      </div>

      {view.report ? (
        <div className="mb-4">
          <JourneyReportPanel report={view.report} assignmentId={view.assignment.id} />
        </div>
      ) : view.gradingPending ? (
        <div className="mb-4 rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-panel)]">
          <p className="atlas-mono text-[0.6875rem] uppercase tracking-[0.08em] text-[var(--color-faint)]">Journey report</p>
          <p className="mt-1.5 text-[0.8125rem] leading-6 text-[var(--color-muted)]">
            Grading is pending for this session. The rubric reads your transcript once a model key is configured; your
            submission is safely frozen either way.
          </p>
        </div>
      ) : null}

      <SessionRoom
        assignmentId={view.assignment.id}
        assignmentName={view.assignment.name}
        brief={view.contract.instructions}
        durationMinutes={view.contract.durationMinutes}
        groundingScope={view.contract.groundingScope}
        transcriptPolicy={view.contract.transcriptPolicy}
        personalRecordSideNotes={view.contract.personalRecordSideNotes}
        criteria={view.criteria}
        initialMessages={view.messages}
        initialArtifacts={view.artifacts}
        initialSideNotes={view.sideNotes}
        sessionStartedAt={view.sessionStartedAt}
        submitted={view.submitted}
        submittedAt={view.submittedAt}
      />
    </>
  );
}
