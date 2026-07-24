import { auth } from "@/lib/auth";
import { loadStudentAtlasRoom } from "@/lib/student/atlas";
import { StudentAtlasRoom } from "@/components/student/atlas-room";
import { PageHeader } from "@/components/teach/page-header";

/** Atlas occupies the working viewport. Chats stay in its optional rail. */
export default async function StudentAtlasPage({
  searchParams,
}: {
  searchParams: Promise<{ thread?: string }>;
}) {
  const session = await auth();
  const { thread } = await searchParams;
  const view = await loadStudentAtlasRoom(session?.user, thread);

  if (view.problem) {
    return (
      <>
        <PageHeader title="Atlas" />
        <p className="max-w-lg text-[0.875rem] leading-6 text-[var(--color-muted)]">{view.problem.detail}</p>
      </>
    );
  }

  if (!view.enabled) {
    return (
      <>
        <PageHeader title="Atlas" />
        <p className="max-w-lg text-[0.875rem] leading-6 text-[var(--color-muted)]">{view.disabledDetail}</p>
      </>
    );
  }

  const activeId = thread === "new" ? "new" : (view.active?.id ?? "new");
  const roomKey = activeId === "new" ? `new-${crypto.randomUUID()}` : activeId;

  return (
    <StudentAtlasRoom
      key={roomKey}
      threadId={activeId}
      threadTitle={thread === "new" ? "New chat" : (view.active?.title ?? "New chat")}
      studentName={view.studentName}
      initialMessages={thread === "new" ? [] : (view.active?.messages ?? [])}
      activeRunId={thread === "new" ? null : (view.active?.activeRunId ?? null)}
      threads={view.threads}
      firstCourse={view.firstCourse}
    />
  );
}
