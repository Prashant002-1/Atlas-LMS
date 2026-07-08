import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { loadStudentSessionView } from "@/lib/student/session-view";
import { PageHeader } from "@/components/teach/page-header";
import { BackLink, StatusBadge } from "@/components/atlas/primitives";
import { SessionRoom } from "@/components/session/session-room";

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
        <p className="max-w-lg text-[14px] leading-6 text-[var(--color-muted)]">{view.problem.detail}</p>
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
