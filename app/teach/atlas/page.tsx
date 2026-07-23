import { auth } from "@/lib/auth";
import { loadPlanningRoom } from "@/lib/instructor/cockpit";
import { PageHeader } from "@/components/teach/page-header";
import { PlanningRoom } from "@/components/planning/planning-room";

/** Atlas occupies the working viewport. Chats and drafts stay in its optional rail. */
export default async function TeachAtlasPage({
  searchParams,
}: {
  searchParams: Promise<{ thread?: string; prompt?: string }>;
}) {
  const session = await auth();
  const { thread, prompt } = await searchParams;
  const view = await loadPlanningRoom(session?.user, thread);

  if (view.problem) {
    return (
      <>
        <PageHeader title="Atlas" />
        <p className="max-w-lg text-[0.875rem] leading-6 text-[var(--color-muted)]">{view.problem.detail}</p>
      </>
    );
  }

  const activeId = thread === "new" ? "new" : view.active?.id ?? "new";
  const roomKey = activeId === "new" ? `new-${crypto.randomUUID()}` : activeId;

  return (
    <PlanningRoom
      key={roomKey}
      threadId={activeId}
      threadTitle={thread === "new" ? "New chat" : view.active?.title ?? "New chat"}
      course={view.course}
      initialMessages={thread === "new" ? [] : view.active?.messages ?? []}
      activeRunId={thread === "new" ? null : view.active?.activeRunId ?? null}
      threads={view.threads}
      drafts={thread === "new" ? [] : view.drafts}
      work={view.work}
      pendingProposals={view.pendingProposals}
      initialInput={typeof prompt === "string" ? prompt.slice(0, 4000) : ""}
    />
  );
}
