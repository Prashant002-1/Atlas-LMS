import { FileText, Target } from "lucide-react";
import { signInWithWorkspaceRole } from "@/lib/auth/actions";
import { ActionButton, BrandMark, ButtonLink, IconLabel, PageFrame, Panel, ProgressBar, StatusBadge } from "@/components/atlas/primitives";
import { RecordFact } from "@/components/atlas/record";
import { atlasDemo } from "@/lib/demo/atlas";

export default function SignUpPage() {
  const objectives = atlasDemo.objectives.slice(0, 3);
  const liveModules = atlasDemo.modules.filter((module) => module.status === "approved").length;
  const draftModules = atlasDemo.modules.length - liveModules;

  return (
    <PageFrame>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 md:px-8">
        <BrandMark />
        <ButtonLink href="/sign-in" variant="secondary" icon={false}>
          Sign in
        </ButtonLink>
      </header>

      <main className="mx-auto grid max-w-6xl gap-8 px-5 py-10 md:px-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
        <section>
          <h1 className="atlas-serif max-w-xl text-[46px] font-semibold leading-[1.04] text-[var(--color-ink)] md:text-[58px]">
            Start with one course.
          </h1>
          <p className="mt-5 max-w-xl text-[17px] leading-8 text-[var(--color-muted)]">
            Applied Statistics is ready to open.
          </p>
          <CourseStartActions />
        </section>

        <Panel title={atlasDemo.course.name} eyebrow={atlasDemo.course.code} action={<StatusBadge tone="neutral">{atlasDemo.course.term}</StatusBadge>}>
          <div className="grid gap-5 border-b border-[var(--color-border)] pb-5 md:grid-cols-[minmax(0,1fr)_220px]">
            <div>
              <IconLabel icon={FileText}>Brief</IconLabel>
              <p className="mt-3 text-[15px] leading-6 text-[var(--color-ink)]">{atlasDemo.course.prompt}</p>
            </div>
            <div className="grid content-start gap-3 text-[13px]">
              <RecordFact label="Live" value={liveModules} />
              <RecordFact label="Draft" value={draftModules} />
              <RecordFact label="Objectives" value={atlasDemo.objectives.length} />
            </div>
          </div>

          <div className="pt-5">
            <div>
              <IconLabel icon={Target}>Objectives</IconLabel>
              <div className="mt-2 divide-y divide-[var(--color-border)]">
                {objectives.map((objective) => (
                  <div key={objective.code} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[13px] font-medium text-[var(--color-ink)]">
                          {objective.code}: {objective.title}
                        </p>
                        <p className="mt-1 text-[12px] leading-5 text-[var(--color-muted)]">{objective.description}</p>
                      </div>
                      <StatusBadge tone={objective.coverage >= 70 ? "good" : "warn"}>{objective.coverage}%</StatusBadge>
                    </div>
                    <div className="mt-3">
                      <ProgressBar value={objective.coverage} label="Coverage" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Panel>
      </main>
    </PageFrame>
  );
}

function CourseStartActions() {
  return (
    <div className="mt-8 grid max-w-xl gap-3 sm:grid-cols-2">
      <form action={signInWithWorkspaceRole}>
        <input type="hidden" name="role" value="instructor" />
        <ActionButton className="w-full">Teach this course</ActionButton>
      </form>
      <form action={signInWithWorkspaceRole}>
        <input type="hidden" name="role" value="student" />
        <ActionButton variant="secondary" className="w-full">
          Study this course
        </ActionButton>
      </form>
    </div>
  );
}
