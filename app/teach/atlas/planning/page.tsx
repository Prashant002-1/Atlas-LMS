import { auth } from "@/lib/auth";
import { loadPlanningRoom } from "@/lib/instructor/cockpit";
import { PageHeader } from "@/components/teach/page-header";
import { BackLink, TextLink } from "@/components/atlas/primitives";
import { PlanningRoom } from "@/components/planning/planning-room";

/**
 * The planning surface: a persistent, course-scoped thread with Atlas that
 * works from the record and prepares reviewable changes. The professor's
 * side of the profile boundary; students never see this surface.
 */
export default async function TeachPlanningPage({
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
        <PageHeader title="Planning" />
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
      <BackLink href="/teach/atlas">Atlas</BackLink>

      <div className="mt-3">
        <PageHeader
          title={thread === "new" ? "New planning thread" : view.active?.title ?? "Planning"}
          course={`${view.course.code} / ${view.course.name}`}
          action={
            view.pendingProposals > 0 ? (
              <TextLink href="/teach/review" className="text-[0.8125rem]">
                {view.pendingProposals} draft{view.pendingProposals === 1 ? "" : "s"} in Review
              </TextLink>
            ) : undefined
          }
        />
      </div>

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
