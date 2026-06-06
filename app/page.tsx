import { BookOpenCheck, FileText, Target } from "lucide-react";
import { atlasDemo } from "@/lib/demo/atlas";
import { BrandMark, ButtonLink, CodeList, IconLabel, PageFrame, ProgressBar, StatusBadge } from "@/components/atlas/primitives";
import { RecordFact } from "@/components/atlas/record";

export default function Landing() {
  return (
    <PageFrame>
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5 md:px-8">
        <BrandMark />
        <ButtonLink href="/sign-in" variant="secondary" icon={false}>
          Sign in
        </ButtonLink>
      </header>

      <section className="mx-auto grid max-w-6xl gap-8 px-5 pb-12 pt-8 md:px-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(440px,1.08fr)] lg:items-center lg:pt-16">
        <div>
          <h1 className="atlas-serif max-w-3xl text-[48px] font-semibold leading-[1.02] text-[var(--color-ink)] md:text-[68px]">
            Course design and study in one record.
          </h1>
          <p className="mt-6 max-w-2xl text-[18px] leading-8 text-[var(--color-muted)]">
            Objectives, modules, assignments, and evidence stay attached to the course as it changes.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/sign-up">Start with one course</ButtonLink>
            <ButtonLink href="/sign-in?role=student" variant="secondary">
              Study this course
            </ButtonLink>
          </div>
          <div className="mt-8 max-w-xl border-y border-[var(--color-border)] py-4">
            <p className="text-[13px] font-medium text-[var(--color-ink)]">{atlasDemo.course.code} · {atlasDemo.course.term}</p>
            <p className="mt-1 text-[13px] leading-5 text-[var(--color-muted)]">Applied Statistics is the working course.</p>
          </div>
        </div>

        <ProductPreview />
      </section>
    </PageFrame>
  );
}

function ProductPreview() {
  const visibleObjectives = atlasDemo.objectives.slice(1, 4);
  const visibleModules = atlasDemo.modules.slice(0, 4);
  const gap =
    [...atlasDemo.objectives].sort((a, b) => b.assessedWeight * (100 - b.coverage) - a.assessedWeight * (100 - a.coverage))[0] ??
    atlasDemo.objectives[0];
  const nextModule = atlasDemo.modules.find((module) => module.objectiveCodes.includes(gap.code)) ?? atlasDemo.modules.find((module) => module.status !== "approved");
  const nextWork = gap.code === "LO3" ? "Project milestone" : "Problem Set 2";
  const nextChange = atlasDemo.proposals.find((proposal) => proposal.status === "pending") ?? atlasDemo.proposals[0];

  return (
    <div className="rounded-[8px] border border-[var(--color-border-strong)] bg-[var(--color-surface)] shadow-[var(--shadow-panel)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
        <div>
          <p className="text-[13px] font-semibold text-[var(--color-ink)]">{atlasDemo.course.code}</p>
          <p className="text-[12px] text-[var(--color-muted)]">{atlasDemo.course.name}</p>
        </div>
        <StatusBadge tone="accent">Current</StatusBadge>
      </div>
      <div className="grid gap-0 md:grid-cols-[minmax(0,1fr)_240px]">
        <div className="p-4">
          <div className="border-b border-[var(--color-border)] pb-4">
            <IconLabel icon={FileText}>Course map</IconLabel>
            <p className="mt-3 text-[15px] leading-6 text-[var(--color-ink)]">{atlasDemo.course.prompt}</p>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_210px]">
            <div className="divide-y divide-[var(--color-border)]">
              {visibleModules.map((module) => (
                <div key={module.title} className="grid gap-3 py-3 first:pt-0 last:pb-0 sm:grid-cols-[32px_minmax(0,1fr)_74px] sm:items-center">
                  <span className="text-[12px] font-semibold text-[var(--color-faint)]">{module.week}</span>
                  <div>
                    <p className="text-[13px] font-medium leading-5 text-[var(--color-ink)]">{module.title}</p>
                    <div className="mt-2">
                      <CodeList codes={module.objectiveCodes} />
                    </div>
                  </div>
                  <StatusBadge tone={module.status === "approved" ? "good" : "neutral"}>
                    {module.status === "approved" ? "Live" : "Draft"}
                  </StatusBadge>
                </div>
              ))}
            </div>
            <div className="border-t border-[var(--color-border)] pt-4 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
              <p className="text-[12px] font-medium text-[var(--color-ink)]">Coverage</p>
              <div className="mt-2 divide-y divide-[var(--color-border)]">
                {visibleObjectives.map((objective) => (
                  <div key={objective.code} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[13px] font-medium text-[var(--color-ink)]">{objective.code}</span>
                      <StatusBadge tone={objective.coverage >= 70 ? "good" : "warn"}>{objective.coverage}%</StatusBadge>
                    </div>
                    <div className="mt-2">
                      <ProgressBar value={objective.coverage} label="Coverage" />
                    </div>
                    <p className="mt-2 text-[12px] text-[var(--color-muted)]">Weight {objective.assessedWeight}%</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <aside className="border-t border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4 md:border-l md:border-t-0">
          <div>
            <IconLabel icon={Target}>Study path</IconLabel>
            <p className="mt-3 text-[15px] font-semibold leading-6 text-[var(--color-ink)]">
              {gap.code}: {gap.title}
            </p>
            <p className="mt-2 text-[12px] leading-5 text-[var(--color-muted)]">{gap.description}</p>
            <div className="mt-3">
              <ProgressBar value={gap.coverage} label="Completed" />
            </div>
          </div>
          <div className="mt-5 border-t border-[var(--color-border)] pt-4">
            <IconLabel icon={BookOpenCheck}>Next</IconLabel>
            <div className="mt-3 space-y-3">
              <RecordFact label="Review" value={nextModule?.title ?? "Course material"} variant="stack" />
              <RecordFact label="Do" value={nextWork} variant="stack" />
              <RecordFact label="Check" value={gap.code} variant="stack" />
            </div>
          </div>
          <div className="mt-5 border-t border-[var(--color-border)] pt-4">
            <p className="text-[12px] font-medium text-[var(--color-ink)]">Review</p>
            <p className="mt-2 text-[13px] font-medium leading-5 text-[var(--color-ink)]">{nextChange.title}</p>
            <p className="mt-2 text-[12px] leading-5 text-[var(--color-muted)]">{nextChange.summary}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
