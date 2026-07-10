import { auth } from "@/lib/auth";
import { loadPlanningRoom } from "@/lib/instructor/cockpit";
import { PageHeader } from "@/components/teach/page-header";
import { TextLink } from "@/components/atlas/primitives";
import { PlanningRoom } from "@/components/planning/planning-room";

/**
 * Atlas is the conversation. Opening this page opens the professor's agent:
 * a persistent, course-scoped thread that works from the record and prepares
 * changes as drafts behind Review. Threads switch in place (?thread=), and
 * the rail carries the record context the conversation stands on. AI
 * assignments themselves live with the rest of the graded course under Work;
 * this surface is for talking to the agent, not for showcasing records.
 */
export default async function TeachAtlasPage({
  searchParams,
}: {
  searchParams: Promise<{ thread?: string }>;
}) {
  const session = await auth();
  const { thread } = await searchParams;
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
  // A fresh room gets a per-render key so "New thread" always mounts empty,
  // even from a room that already learned its stored id via the stream.
  const roomKey = activeId === "new" ? `new-${crypto.randomUUID()}` : activeId;

  return (
    <>
      <PageHeader
        title="Atlas"
        course={`${view.course.code} / ${view.course.name}`}
        action={
          view.pendingProposals > 0 ? (
            <TextLink href="/teach/review" className="text-[0.8125rem]">
              {view.pendingProposals} draft{view.pendingProposals === 1 ? "" : "s"} in Review
            </TextLink>
          ) : undefined
        }
      />

      <PlanningRoom
        key={roomKey}
        threadId={activeId}
        initialMessages={thread === "new" ? [] : view.active?.messages ?? []}
        threads={view.threads}
        drafts={thread === "new" ? [] : view.drafts}
        work={view.work}
        pendingProposals={view.pendingProposals}
      />
    </>
  );
}
