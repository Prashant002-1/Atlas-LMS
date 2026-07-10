import type { ReactNode } from "react";
import { EMPTY_STATE_ART, type EmptyStateArt } from "@/components/atlas/illustrations";


export function EmptyRecord({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="py-5">
      <p className="text-[0.875rem] font-semibold text-[var(--color-ink)]">{title}</p>
      <p className="mt-1 text-[0.8125rem] leading-5 text-[var(--color-muted)]">{detail}</p>
    </div>
  );
}

/**
 * A section-level empty or completion state. The drawing names the state
 * (a clear horizon, an unplotted chart, a summit flag, a quiet month); the
 * copy states the fact. Used only where there is genuinely nothing to show.
 */
export function EmptyState({
  art,
  title,
  detail,
  action,
}: {
  art: EmptyStateArt;
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  const Art = EMPTY_STATE_ART[art];
  return (
    <div className="flex flex-col items-center px-6 py-9 text-center">
      <Art className="text-[var(--color-faint)]" />
      <p className="mt-4 text-[0.875rem] font-semibold text-[var(--color-ink)]">{title}</p>
      <p className="mt-1 max-w-sm text-[0.8125rem] leading-5 text-[var(--color-muted)]">{detail}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function RecordFact({
  label,
  value,
  variant = "row",
}: {
  label: string;
  value: ReactNode;
  variant?: "row" | "stack";
}) {
  if (variant === "stack") {
    return (
      <div className="grid gap-1 py-2 first:pt-0 last:pb-0">
        <span className="text-[0.75rem] text-[var(--color-faint)]">{label}</span>
        <span className="text-[0.8125rem] font-medium leading-5 text-[var(--color-ink)]">{value}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[var(--color-muted)]">{label}</span>
      <span className="font-medium text-[var(--color-ink)]">{value}</span>
    </div>
  );
}


export function ObjectiveChecklist({
  objectives,
  selectedCodes = [],
  legend = "Objectives",
}: {
  objectives: Array<{ code: string; title: string }>;
  selectedCodes?: string[];
  legend?: string;
}) {
  if (objectives.length === 0) return null;

  const selected = new Set(selectedCodes);

  return (
    <fieldset className="grid gap-2">
      <legend className="text-[0.75rem] font-medium text-[var(--color-ink)]">{legend}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {objectives.map((objective) => (
          <label
            key={objective.code}
            className="flex min-h-10 items-center gap-2 rounded-row border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 text-[0.75rem] text-[var(--color-muted)]"
          >
            <input
              type="checkbox"
              name="objectiveCode"
              value={objective.code}
              defaultChecked={selected.has(objective.code)}
              className="size-4 accent-[var(--color-accent)]"
            />
            <span className="font-medium text-[var(--color-ink)]">{objective.code}</span>
            <span className="min-w-0 truncate">{objective.title}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

