import type { ReactNode } from "react";
import { ProgressBar, StatusBadge } from "@/components/atlas/primitives";

type ObjectiveRecord = {
  code: string;
  title: string;
  description: string;
  bloom: string;
  assessedWeight: number;
  coverage: number;
  evidence?: string[];
};

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

export function ObjectiveMeter({
  objective,
  progressLabel,
  evidenceStyle = "none",
}: {
  objective: ObjectiveRecord;
  progressLabel: string;
  evidenceStyle?: "none" | "line" | "badge";
}) {
  return (
    <article className="py-4 first:pt-3 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone="accent">{objective.code}</StatusBadge>
            <h4 className="text-[13px] font-semibold leading-5 text-[var(--color-ink)]">{objective.title}</h4>
          </div>
          <p className="mt-2 text-[12px] leading-5 text-[var(--color-muted)]">{objective.description}</p>
        </div>
        <StatusBadge tone={objective.coverage >= 70 ? "good" : "warn"}>{objective.coverage}%</StatusBadge>
      </div>
      <div className="mt-3">
        <ProgressBar value={objective.coverage} label={progressLabel} />
      </div>
      <p className="mt-3 text-[12px] leading-5 text-[var(--color-faint)]">
        Weight {objective.assessedWeight}% / {objective.bloom}
      </p>
      <ObjectiveEvidence evidence={objective.evidence ?? []} style={evidenceStyle} />
    </article>
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

function ObjectiveEvidence({ evidence, style }: { evidence: string[]; style: "none" | "line" | "badge" }) {
  if (style === "none" || evidence.length === 0) return null;

  if (style === "badge") {
    return (
      <p className="mt-3 text-[12px] leading-5 text-[var(--color-muted)]">{evidence.join(", ")}</p>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      {evidence.slice(0, 3).map((item) => (
        <p key={item} className="text-[12px] leading-5 text-[var(--color-muted)]">
          {item}
        </p>
      ))}
    </div>
  );
}
