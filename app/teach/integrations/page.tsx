import { auth } from "@/lib/auth";
import { loadInstructorWorkspace } from "@/lib/instructor/workspace";
import { PageHeader } from "@/components/teach/page-header";
import { EmptyRecord } from "@/components/atlas/record";
import { TextLink } from "@/components/atlas/primitives";

const capabilities = [
  { name: "Interactive video", detail: "Attach a compatible video tool to an assignment so students use it inside the assigned session." },
  { name: "Practice and quizzes", detail: "Select a tool resource for examples, formative checks, or generated practice without exposing setup to students." },
  { name: "Simulations and media", detail: "Bring discipline-specific interactive tools into a course at the point the instructor chooses." },
];

export default async function TeachIntegrationsPage() {
  const session = await auth();
  const workspace = await loadInstructorWorkspace(session?.user);

  if (workspace.problem) {
    return <><PageHeader title="Integrations" /><p className="max-w-lg text-[0.875rem] leading-6 text-[var(--color-muted)]">{workspace.problem.detail}</p></>;
  }

  return (
    <>
      <PageHeader title="Integrations" course={`${workspace.course.code}, ${workspace.course.name}`} />
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.42fr)]">
        <div>
          <p className="max-w-3xl text-[0.9375rem] leading-7 text-[var(--color-ink)]">Connect education tools to the university environment once, then place them inside assignments and Atlas sessions. Students use the tool selected by their instructor without seeing a marketplace or configuration screen.</p>

          <section className="mt-8" aria-labelledby="connected-tools-heading">
            <h2 id="connected-tools-heading" className="text-[1rem] font-semibold text-[var(--color-ink)]">Connected tools</h2>
            <div className="mt-2 border-y border-[var(--color-border)]">
              <EmptyRecord title="No tools connected" detail="Institutionally installed LTI 1.3 tools will appear here for instructors to select and attach." />
            </div>
          </section>

          <section className="mt-8" aria-labelledby="capability-heading">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="capability-heading" className="text-[1rem] font-semibold text-[var(--color-ink)]">What a tool can add</h2>
              <TextLink href="/teach/ai-assignments" className="text-[0.75rem]">AI assignments</TextLink>
            </div>
            <div className="mt-2 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
              {capabilities.map((capability) => (
                <div key={capability.name} className="py-4">
                  <h3 className="text-[0.875rem] font-semibold text-[var(--color-ink)]">{capability.name}</h3>
                  <p className="mt-1 max-w-2xl text-[0.8125rem] leading-5 text-[var(--color-muted)]">{capability.detail}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside>
          <h2 className="text-[1rem] font-semibold text-[var(--color-ink)]">Connection model</h2>
          <ol className="mt-3 space-y-4 text-[0.8125rem] leading-5 text-[var(--color-muted)]">
            <li><span className="font-semibold text-[var(--color-ink)]">1. Institution installs</span><br />A trusted LTI 1.3 deployment establishes identity, permissions, and launch security.</li>
            <li><span className="font-semibold text-[var(--color-ink)]">2. Instructor selects</span><br />Deep Linking returns a specific tool resource that can be attached to an assignment.</li>
            <li><span className="font-semibold text-[var(--color-ink)]">3. Student uses</span><br />The resource appears contextually in the assignment or session. Assignment and Grade Services can return results when the tool supports it.</li>
          </ol>
          <p className="mt-5 text-[0.71875rem] leading-5 text-[var(--color-faint)]">This page is instructor-only. Atlas does not expose tool installation or marketplace choices in the student navigation.</p>
        </aside>
      </div>
    </>
  );
}
