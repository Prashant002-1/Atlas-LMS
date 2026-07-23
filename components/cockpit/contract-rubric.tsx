import { ChevronDown } from "lucide-react";
import { TextLink } from "@/components/atlas/primitives";
import type { RubricCriterion } from "@/lib/agent/session-parts";

export function AssignmentSettings({
  contract,
  changeHref,
}: {
  contract: {
    instructions: string;
    durationMinutes: number;
    groundingScope: string[];
    transcriptPolicy: string;
  };
  changeHref: string;
}) {
  return (
    <section aria-labelledby="session-settings-heading" className="relative">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="session-settings-heading" className="text-[1rem] font-semibold text-[var(--color-ink)]">Session contract</h2>
        <TextLink href={changeHref} className="text-[0.75rem]">Change with Atlas</TextLink>
      </div>

      <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
        <SettingFact label="Length" value={`${contract.durationMinutes} minutes`} />
        <SettingFact label="Transcript" value={contract.transcriptPolicy} wide />
        <SettingFact label="Course material" value={contract.groundingScope.length > 0 ? contract.groundingScope.join(", ") : "Course"} wide />
        <div className="sm:col-span-2">
          <dt className="text-[0.71875rem] text-[var(--color-faint)]">Connected tools</dt>
          <dd className="mt-0.5 text-[0.8125rem] leading-5 text-[var(--color-muted)]">None attached. <TextLink href="/teach/integrations" className="text-[0.75rem]">Open integrations</TextLink></dd>
        </div>
      </dl>
      <p className="mt-4 max-w-2xl text-[0.8125rem] leading-6 text-[var(--color-muted)]">{contract.instructions}</p>
    </section>
  );
}

export function RubricSummary({ criteria, version, changeHref }: { criteria: RubricCriterion[]; version: number; changeHref: string }) {
  return (
    <section aria-labelledby="rubric-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="rubric-heading" className="text-[1rem] font-semibold text-[var(--color-ink)]">
          Rubric <span className="text-[0.75rem] font-normal text-[var(--color-faint)]">v{version}</span>
        </h2>
        <TextLink href={changeHref} className="text-[0.75rem]">Change with Atlas</TextLink>
      </div>

      <div className="mt-4 space-y-1">
        {criteria.map((criterion) => (
          <div key={criterion.key} className="flex items-start justify-between gap-4 py-3">
            <div>
              <p className="text-[0.8125rem] font-medium text-[var(--color-ink)]">{criterion.name}</p>
              <p className="mt-0.5 line-clamp-2 text-[0.75rem] leading-5 text-[var(--color-muted)]">{criterion.description}</p>
            </div>
            <p className="shrink-0 text-[0.8125rem] font-medium tabular-nums text-[var(--color-ink)]">{criterion.weight} pts</p>
          </div>
        ))}
      </div>

      <details className="group mt-3">
        <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 text-[0.78125rem] font-medium text-[var(--color-ink)] underline decoration-[color-mix(in_oklch,var(--color-ink)_30%,transparent)] underline-offset-[3px] hover:text-[var(--color-accent-strong)]">
          View level descriptions
          <ChevronDown size={13} aria-hidden className="transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[42rem] border-collapse text-left">
            <thead>
              <tr className="text-[0.71875rem] text-[var(--color-muted)]">
                <th scope="col" className="pb-2.5 pr-4 font-medium">Criterion</th>
                <th scope="col" className="pb-2.5 pr-4 text-right font-medium">Points</th>
                <th scope="col" className="pb-2.5 font-medium">Full credit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {criteria.map((criterion) => {
                const fullCredit = criterion.levels.find((level) => level.level === "Exceeds") ?? criterion.levels[0];
                return (
                  <tr key={criterion.key}>
                    <th scope="row" className="py-3 pr-4 align-top text-[0.8125rem] font-medium text-[var(--color-ink)]">{criterion.name}</th>
                    <td className="py-3 pr-4 text-right align-top text-[0.8125rem] font-medium tabular-nums text-[var(--color-ink)]">{criterion.weight}</td>
                    <td className="py-3 align-top text-[0.75rem] leading-5 text-[var(--color-muted)]">{fullCredit.descriptor}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

function SettingFact({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <dt className="text-[0.71875rem] text-[var(--color-faint)]">{label}</dt>
      <dd className="mt-0.5 text-[0.8125rem] font-medium leading-5 text-[var(--color-ink)]">{value}</dd>
    </div>
  );
}
