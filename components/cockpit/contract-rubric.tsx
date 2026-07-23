import { ChevronDown } from "lucide-react";
import { updateSessionContract } from "@/lib/instructor/session-actions";
import { ActionButton, TextLink } from "@/components/atlas/primitives";
import type { RubricCriterion } from "@/lib/agent/session-parts";

export function AssignmentSettings({
  assignmentId,
  contract,
}: {
  assignmentId: string;
  contract: {
    instructions: string;
    durationMinutes: number;
    groundingScope: string[];
    transcriptPolicy: string;
  };
}) {
  return (
    <section aria-labelledby="session-settings-heading" className="relative">
      <h2 id="session-settings-heading" className="text-[1rem] font-semibold text-[var(--color-ink)]">Session settings</h2>

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

      <details className="group mt-4 pt-3">
        <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 text-[0.78125rem] font-medium text-[var(--color-ink)] underline decoration-[color-mix(in_oklch,var(--color-ink)_30%,transparent)] underline-offset-[3px] hover:text-[var(--color-accent-strong)]">
          Edit settings
          <ChevronDown size={13} aria-hidden className="transition-transform group-open:rotate-180" />
        </summary>

        <form action={updateSessionContract} className="mt-5 grid gap-4">
          <input type="hidden" name="assignmentId" value={assignmentId} />
          <label className="grid gap-1.5 text-[0.75rem] font-medium text-[var(--color-ink)]" htmlFor="contract-instructions">
            Student instructions
            <textarea id="contract-instructions" name="instructions" rows={4} required minLength={10} maxLength={2000} defaultValue={contract.instructions} className="w-full resize-y rounded-control border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2.5 text-[0.8125rem] font-normal leading-5 transition focus:border-[var(--color-accent-strong)] focus:bg-[var(--color-surface)]" />
          </label>
          <div className="grid gap-4 md:grid-cols-[10rem_minmax(0,1fr)]">
            <label className="grid gap-1.5 text-[0.75rem] font-medium text-[var(--color-ink)]" htmlFor="contract-duration">
              Session length
              <span className="relative">
                <input id="contract-duration" name="durationMinutes" type="number" min={5} max={240} step={1} required defaultValue={contract.durationMinutes} className="w-full rounded-control border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2 pr-12 text-[0.8125rem] font-normal tabular-nums transition focus:border-[var(--color-accent-strong)] focus:bg-[var(--color-surface)]" />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[0.75rem] font-normal text-[var(--color-faint)]">min</span>
              </span>
            </label>
            <label className="grid gap-1.5 text-[0.75rem] font-medium text-[var(--color-ink)]" htmlFor="contract-transcript">
              Transcript policy
              <input id="contract-transcript" name="transcriptPolicy" type="text" required minLength={3} maxLength={200} defaultValue={contract.transcriptPolicy} className="rounded-control border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2 text-[0.8125rem] font-normal transition focus:border-[var(--color-accent-strong)] focus:bg-[var(--color-surface)]" />
            </label>
          </div>
          <div><ActionButton>Save settings</ActionButton></div>
        </form>
      </details>
    </section>
  );
}

export function RubricSummary({ criteria, version }: { criteria: RubricCriterion[]; version: number }) {
  return (
    <section aria-labelledby="rubric-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="rubric-heading" className="text-[1rem] font-semibold text-[var(--color-ink)]">
          Rubric <span className="text-[0.75rem] font-normal text-[var(--color-faint)]">v{version}</span>
        </h2>
        <TextLink href="/teach/atlas" className="text-[0.75rem]">Change with Atlas</TextLink>
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
