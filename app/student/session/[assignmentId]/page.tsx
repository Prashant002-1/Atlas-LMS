import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { loadStudentSessionView } from "@/lib/student/session-view";
import { loadActiveCourseAgentConfig } from "@/lib/agent/course-agent-config";
import { PageHeader } from "@/components/teach/page-header";
import { SessionRoom } from "@/components/session/session-room";

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
    <SessionRoom
      assignmentId={view.assignment.id}
      assignmentName={view.assignment.name}
      courseCode={view.course.code}
      agentName={courseAgent.configuration.identity.name}
      agentDisclosure={courseAgent.studentDisclosure}
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
      report={view.report}
      gradingPending={view.gradingPending}
    />
  );
}
