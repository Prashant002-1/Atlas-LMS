import { auth } from "@/lib/auth";
import { loadInstructorWorkspace } from "@/lib/instructor/workspace";
import { PageHeader } from "@/components/teach/page-header";

/**
 * v0 shell. The old command surface was removed in Phase 0; the session
 * cockpit mounts here once the new primitives exist.
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

  return (
    <>
      <PageHeader title="Atlas" course={`${workspace.course.code} / ${workspace.course.name}`} />
      <section className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-panel)]">
        <p className="atlas-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-faint)]">v0 shell</p>
        <h2 className="mt-2 text-[18px] font-semibold">Session cockpit offline</h2>
        <p className="mt-2 max-w-2xl text-[14px] leading-6 text-[var(--color-muted)]">
          The old command console has been cleared. The next build step mounts the v0 session assignment, student session, and
          journey evidence primitives here.
        </p>
      </section>
    </>
  );
}
