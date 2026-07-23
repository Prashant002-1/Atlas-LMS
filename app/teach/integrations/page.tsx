import { auth } from "@/lib/auth";
import { loadInstructorWorkspace } from "@/lib/instructor/workspace";
import { PageHeader } from "@/components/teach/page-header";
import { EmptyRecord } from "@/components/atlas/record";

export default async function TeachIntegrationsPage() {
  const session = await auth();
  const workspace = await loadInstructorWorkspace(session?.user);

  if (workspace.problem) {
    return <><PageHeader title="Integrations" /><p className="max-w-lg text-[0.875rem] leading-6 text-[var(--color-muted)]">{workspace.problem.detail}</p></>;
  }

  return (
    <>
      <PageHeader title="Integrations" course={`${workspace.course.code}, ${workspace.course.name}`} />
      <p className="max-w-2xl text-[0.9375rem] leading-7 text-[var(--color-ink)]">Add AI and other tools available through your university. Connected tools are available in Atlas chat.</p>

      <section className="mt-8" aria-labelledby="connected-tools-heading">
        <h2 id="connected-tools-heading" className="text-[1rem] font-semibold text-[var(--color-ink)]">Connected tools</h2>
        <div className="mt-2">
          <EmptyRecord title="No tools connected" detail="Tools you connect will appear here." />
        </div>
      </section>
    </>
  );
}
