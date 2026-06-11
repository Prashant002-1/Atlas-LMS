import type { ReactNode } from "react";


export function EmptyRecord({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="py-5">
      <p className="text-[14px] font-semibold text-[var(--color-ink)]">{title}</p>
      <p className="mt-1 text-[13px] leading-5 text-[var(--color-muted)]">{detail}</p>
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
        <span className="text-[12px] text-[var(--color-faint)]">{label}</span>
        <span className="text-[13px] font-medium leading-5 text-[var(--color-ink)]">{value}</span>
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
      <legend className="text-[12px] font-medium text-[var(--color-ink)]">{legend}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {objectives.map((objective) => (
          <label
            key={objective.code}
            className="flex min-h-10 items-center gap-2 rounded-[8px] border border-[var(--color-border)] bg-white px-3 text-[12px] text-[var(--color-muted)]"
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

