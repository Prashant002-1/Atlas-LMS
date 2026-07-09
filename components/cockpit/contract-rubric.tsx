import { FileSliders, ListChecks } from "lucide-react";
import { updateRubricWeights, updateSessionContract } from "@/lib/instructor/session-actions";
import { ActionButton } from "@/components/atlas/primitives";
import type { RubricCriterion } from "@/lib/agent/session-parts";

/**
 * The session contract and rubric, editable in place. These are direct record
 * edits (the same doctrine as every other course record): the contract row is
 * the per-assignment policy object, and the rubric edit rescales level points
 * to keep "weight = full credit" true. Once anything has been graded, a
 * weight edit writes a NEW rubric version; what already graded stays pinned.
 */

export function ContractPanel({
  assignmentId,
  contract,
}: {
  assignmentId: string;
  contract: {
    instructions: string;
    durationMinutes: number;
    groundingScope: string[];
    transcriptPolicy: string;
    personalRecordSideNotes: boolean;
  };
}) {
  return (
    <section
      aria-label="Session contract"
      className="rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-panel)]"
    >
      <p className="atlas-mono flex items-center gap-1.5 text-[11px] uppercase tracking-[0.08em] text-[var(--color-faint)]">
        <FileSliders size={12} aria-hidden />
        Session contract
      </p>

      <form action={updateSessionContract} className="mt-3 space-y-3">
        <input type="hidden" name="assignmentId" value={assignmentId} />

        <div>
          <label htmlFor="contract-instructions" className="text-[12px] font-medium text-[var(--color-muted)]">
            Brief the student sees
          </label>
          <textarea
            id="contract-instructions"
            name="instructions"
            rows={3}
            required
            minLength={10}
            maxLength={2000}
            defaultValue={contract.instructions}
            className="mt-1 w-full resize-y rounded-control border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2 text-[13px] leading-5 transition focus:border-[var(--color-accent-strong)] focus:bg-[var(--color-surface)]"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="contract-duration" className="text-[12px] font-medium text-[var(--color-muted)]">
              Duration (minutes)
            </label>
            <input
              id="contract-duration"
              name="durationMinutes"
              type="number"
              min={5}
              max={240}
              step={1}
              required
              defaultValue={contract.durationMinutes}
              className="mt-1 w-full rounded-control border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2 text-[13px] tabular-nums transition focus:border-[var(--color-accent-strong)] focus:bg-[var(--color-surface)]"
            />
          </div>
          <div>
            <label htmlFor="contract-transcript" className="text-[12px] font-medium text-[var(--color-muted)]">
              Transcript policy (students see this)
            </label>
            <input
              id="contract-transcript"
              name="transcriptPolicy"
              type="text"
              required
              minLength={3}
              maxLength={200}
              defaultValue={contract.transcriptPolicy}
              className="mt-1 w-full rounded-control border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2 text-[13px] transition focus:border-[var(--color-accent-strong)] focus:bg-[var(--color-surface)]"
            />
          </div>
        </div>

        <label className="flex items-start gap-2.5 rounded-panel border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2.5">
          <input
            type="checkbox"
            name="personalRecordSideNotes"
            defaultChecked={contract.personalRecordSideNotes}
            className="mt-0.5 size-4 accent-[var(--color-accent-strong)]"
          />
          <span>
            <span className="block text-[13px] font-medium text-[var(--color-ink)]">Personal-record side notes</span>
            <span className="mt-0.5 block text-[11.5px] leading-4 text-[var(--color-muted)]">
              Lets the session surface a student&apos;s own record (their exam topics, your flagged plans) as margin cards.
              Their data flows to them, never to other students.
            </span>
          </span>
        </label>

        {contract.groundingScope.length > 0 ? (
          <p className="text-[11.5px] text-[var(--color-faint)]">Grounded on: {contract.groundingScope.join(", ")}</p>
        ) : null}

        <div>
          <ActionButton>Save contract</ActionButton>
        </div>
      </form>
    </section>
  );
}

export function RubricEditor({
  assignmentId,
  criteria,
  version,
  hasReports,
}: {
  assignmentId: string;
  criteria: RubricCriterion[];
  version: number;
  hasReports: boolean;
}) {
  return (
    <section
      aria-label="Rubric"
      className="rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-panel)]"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="atlas-mono flex items-center gap-1.5 text-[11px] uppercase tracking-[0.08em] text-[var(--color-faint)]">
          <ListChecks size={12} aria-hidden />
          Rubric
        </p>
        <span className="atlas-mono text-[10.5px] uppercase tracking-[0.07em] text-[var(--color-faint)]">v{version}</span>
      </div>

      <form action={updateRubricWeights} className="mt-3 space-y-2.5">
        <input type="hidden" name="assignmentId" value={assignmentId} />
        {criteria.map((criterion) => (
          <div key={criterion.key} className="rounded-panel border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px] font-medium text-[var(--color-ink)]">{criterion.name}</p>
              <label className="flex items-center gap-1.5">
                <span className="sr-only">Weight for {criterion.name}</span>
                <input
                  name={`weight:${criterion.key}`}
                  type="number"
                  min={1}
                  max={97}
                  step={1}
                  required
                  defaultValue={criterion.weight}
                  className="w-16 rounded-control border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-right text-[13px] tabular-nums transition focus:border-[var(--color-accent-strong)]"
                />
                <span className="text-[12px] text-[var(--color-faint)]">%</span>
              </label>
            </div>
            <p className="mt-1 text-[12px] leading-5 text-[var(--color-muted)]">{criterion.description}</p>
            <p className="atlas-mono mt-1.5 text-[10.5px] text-[var(--color-faint)]">
              {criterion.levels.map((level) => `${level.level} ${level.score}`).join(" / ")}
            </p>
          </div>
        ))}

        <div className="flex flex-wrap items-center gap-3">
          <ActionButton>Save weights</ActionButton>
          <p className="text-[11.5px] leading-4 text-[var(--color-faint)]">
            Weights must sum to 100; level points rescale to match.
            {hasReports ? " Sessions are already graded, so saving writes rubric v" + (version + 1) + "; existing grades stay pinned to v" + version + "." : ""}
          </p>
        </div>
      </form>
    </section>
  );
}
