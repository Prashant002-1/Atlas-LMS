import { auth } from "@/lib/auth";
import { loadInstructorWorkspace } from "@/lib/instructor/workspace";
import {
  createCommandSession,
  listCommandSessions,
  loadCommandSession,
  loadActiveTurns,
  turnsToUIMessages,
  loadSessionDrafts,
} from "@/lib/agent/session";
import { CommandConsole } from "@/components/agent/command-console";
import { PageHeader } from "@/components/teach/page-header";
import { resolveScope } from "@/lib/workspace/scope";
import { redirect } from "next/navigation";

/**
 * Atlas Command. The session is per course and persistent: it
 * resumes where you left off, compacts quietly as it grows, and every draft
 * it produces waits in Review. The console is the page: session rail, working
 * stream, artifacts, and activity.
 */
type AtlasSearchParams = {
  session?: string | string[];
  new?: string | string[];
  runtime?: string | string[];
};

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function TeachAtlasPage({ searchParams }: { searchParams?: Promise<AtlasSearchParams> }) {
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

  const params = (await searchParams) ?? {};
  const requestedSessionId = firstParam(params.session);
  const runtime = firstParam(params.runtime) === "eve" || process.env.ATLAS_COMMAND_RUNTIME === "eve" ? "eve" : "atlas";
  const runtimeQuery = runtime === "eve" ? "&runtime=eve" : "";
  const commandScope = {
    orgId: session.user.orgId,
    userId: session.user.id,
    courseId: workspace.course.id,
  };

  if (firstParam(params.new)) {
    const created = await createCommandSession(commandScope);
    redirect(`/teach/atlas?session=${created.id}${runtimeQuery}`);
  }

  let sessions = await listCommandSessions(commandScope);
  let agentSession = requestedSessionId ? await loadCommandSession(commandScope, requestedSessionId) : null;
  if (!agentSession) {
    const fallbackSession = sessions[0] ? await loadCommandSession(commandScope, sessions[0].id) : null;
    agentSession = fallbackSession ?? (await createCommandSession(commandScope));
    redirect(`/teach/atlas?session=${agentSession.id}${runtimeQuery}`);
  }

  if (!sessions.some((item) => item.id === agentSession.id)) {
    sessions = await listCommandSessions(commandScope);
  }

  const turns = await loadActiveTurns(agentSession);
  const initialMessages = turnsToUIMessages(turns);
  const initialDrafts = await loadSessionDrafts(session.user.orgId, agentSession.id);

  // The professor's teaching courses, for the in-console course switcher. Each
  // course is its own context; switching reloads Atlas scoped to that course.
  const scope = await resolveScope({
    orgId: session.user.orgId,
    userId: session.user.id,
    role: session.user.role,
    teachingOnly: true,
  });
  const courses = scope.courses.map((c) => ({ id: c.id, code: c.code, name: c.name }));

  return (
    <CommandConsole
      courseId={workspace.course.id}
      courseLabel={`${workspace.course.code} / ${workspace.course.name}`}
      courses={courses}
      sessionId={agentSession.id}
      sessions={sessions}
      initialMessages={initialMessages}
      initialDrafts={initialDrafts}
      runtime={runtime}
    />
  );
}
