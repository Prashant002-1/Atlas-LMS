import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { loadStudentSessionView } from "@/lib/student/session-view";
import { PageHeader } from "@/components/teach/page-header";
import { BackLink, StatusBadge } from "@/components/atlas/primitives";
import { SessionRoom } from "@/components/session/session-room";
import { JourneyReportPanel } from "@/components/session/journey-report-panel";

/** The assignment session, including the submitted session's grade when available. */
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
          course={`${view.course.code} / AI assignment`}
          action={<StatusBadge tone={view.submitted ? "good" : "accent"}>{view.submitted ? "Submitted" : "Live"}</StatusBadge>}
        />
      </div>

      {view.report ? (
        <div className="mb-6">
          <JourneyReportPanel report={view.report} assignmentId={view.assignment.id} />
        </div>
      ) : view.gradingPending ? (
        <section aria-labelledby="pending-grade-heading" className="mb-6 border-y border-[var(--color-border)] py-4">
          <h2 id="pending-grade-heading" className="text-[0.875rem] font-semibold text-[var(--color-ink)]">Grade pending</h2>
          <p className="mt-1 text-[0.8125rem] text-[var(--color-muted)]">Your submitted session is saved and waiting to be graded.</p>
        </section>
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
