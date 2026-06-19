import { auth } from "@/lib/auth";
import { loadInstructorWorkspace } from "@/lib/instructor/workspace";
import { resumeOrCreateSession, loadActiveTurns, turnsToUIMessages, loadSessionDrafts } from "@/lib/agent/session";
import { CommandConsole } from "@/components/agent/command-console";
import { PageHeader } from "@/components/teach/page-header";

/**
 * Atlas Command. The session is per course and persistent: it
 * resumes where you left off, compacts quietly as it grows, and every draft
 * it produces waits in Review. The console is the page: session rail, working
 * stream, artifacts, and activity.
 */
export default async function TeachAtlasPage() {
  const session = await auth();
  const workspace = await loadInstructorWorkspace(session?.user);

  if (workspace.problem || !workspace.course.id || !session?.user?.orgId) {
    return (
      <>
        <PageHeader title="Atlas" />
        <p className="max-w-lg text-[14px] leading-6 text-[var(--color-muted)]">
          {workspace.problem?.detail ?? "No course is in view."}
        </p>
      </>
    );
  }

  const agentSession = await resumeOrCreateSession({
    orgId: session.user.orgId,
    userId: session.user.id,
    courseId: workspace.course.id,
    surface: "command",
    anchor: { type: "course", id: null },
  });
  const turns = await loadActiveTurns(agentSession);
  const initialMessages = turnsToUIMessages(turns);
  const initialDrafts = await loadSessionDrafts(session.user.orgId, agentSession.id);

  return (
    <CommandConsole
      courseId={workspace.course.id}
      courseLabel={`${workspace.course.code} / ${workspace.course.name}`}
      initialMessages={initialMessages}
      initialDrafts={initialDrafts}
    />
  );
}
