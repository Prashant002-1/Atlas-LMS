import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { loadStudentSessionView } from "@/lib/student/session-view";
import { loadActiveCourseAgentConfig } from "@/lib/agent/course-agent-config";
import { PageHeader } from "@/components/teach/page-header";
import { BackLink, StatusBadge } from "@/components/atlas/primitives";
import { SessionRoom } from "@/components/session/session-room";
import { JourneyReportPanel } from "@/components/session/journey-report-panel";

/** The assignment session, including the submitted session's grade when available. */
export default async function StudentSessionPage({ params }: { params: Promise<{ assignmentId: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in?role=student");
  if (!session.user.orgId) redirect("/student");

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

  const courseAgent = await loadActiveCourseAgentConfig(session.user.orgId, view.course.id);

  return (
    <>
      <BackLink href={`/student/work/${view.assignment.id}`}>{view.assignment.name}</BackLink>

      <div className="mt-3">
        <PageHeader
          title={view.assignment.name}
          course={`${view.course.code} / AI assignment`}
          action={view.submitted ? <StatusBadge tone="good">Submitted</StatusBadge> : undefined}
        />
      </div>

      <section aria-labelledby="course-agent-heading" className="mb-6 grid gap-3 border-y border-[var(--color-border)] py-4 sm:grid-cols-[minmax(10rem,0.3fr)_minmax(0,1fr)]">
        <div>
          <p className="text-[0.6875rem] uppercase tracking-[0.08em] text-[var(--color-faint)]">Course agent</p>
          <h2 id="course-agent-heading" className="mt-1 text-[0.875rem] font-semibold text-[var(--color-ink)]">{courseAgent.configuration.identity.name}</h2>
          <p className="mt-0.5 text-[0.6875rem] text-[var(--color-faint)]">{courseAgent.source === "versioned" ? `Professor configured / v${courseAgent.version}` : "Course default"}</p>
        </div>
        <p className="text-[0.8125rem] leading-6 text-[var(--color-muted)]">{courseAgent.studentDisclosure}</p>
      </section>

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
