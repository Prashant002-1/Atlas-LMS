"use client";

import { useMemo, useState } from "react";
import { Table2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PricingArtifact } from "@/lib/agent/session-parts";

export type ArtifactRevision = {
  state: PricingArtifact;
};

type TierDiff = {
  added: boolean;
  changed: Set<"price" | "targetSegment" | "fence" | "rationale">;
};

function diffTiers(current: PricingArtifact, previous: PricingArtifact | null): Map<string, TierDiff> {
  const result = new Map<string, TierDiff>();
  for (const tier of current.tiers) {
    const before = previous?.tiers.find((candidate) => candidate.name === tier.name);
    if (!before) {
      result.set(tier.name, { added: Boolean(previous), changed: new Set() });
      continue;
    }
    const changed = new Set<"price" | "targetSegment" | "fence" | "rationale">();
    if (before.price !== tier.price) changed.add("price");
    if (before.targetSegment !== tier.targetSegment) changed.add("targetSegment");
    if (before.fence !== tier.fence) changed.add("fence");
    if (before.rationale !== tier.rationale) changed.add("rationale");
    result.set(tier.name, { added: false, changed });
  }
  return result;
}

const changedCell = "bg-[color-mix(in_oklch,var(--color-accent)_16%,transparent)]";

export function ArtifactPanel({
  revisions,
  className,
  title = "Your design",
  plain = false,
}: {
  revisions: ArtifactRevision[];
  className?: string;
  title?: string;
  plain?: boolean;
}) {
  const [pinned, setPinned] = useState<number | null>(null);
  const latest = revisions.length - 1;
  const index = pinned !== null && pinned < latest ? pinned : Math.max(latest, 0);
  const current = revisions[index]?.state ?? null;
  const previous = index > 0 ? revisions[index - 1]?.state ?? null : null;
  const diff = useMemo(() => (current ? diffTiers(current, previous) : new Map<string, TierDiff>()), [current, previous]);

  return (
    <section
      aria-label={title}
      className={cn(
        plain
          ? ""
          : "rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-panel)]",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className={cn("flex items-center gap-1.5 font-semibold text-[var(--color-ink)]", plain ? "text-[1.125rem]" : "text-[0.8125rem]")}>
          <Table2 size={plain ? 15 : 12} aria-hidden className="text-[var(--color-muted)]" />
          {title}
        </h2>
        {revisions.length > 1 ? (
          <div className="flex items-center gap-1" role="tablist" aria-label="Revisions">
            {revisions.map((_, revisionIndex) => (
              <button
                key={revisionIndex}
                type="button"
                role="tab"
                aria-selected={revisionIndex === index}
                onClick={() => setPinned(revisionIndex >= latest ? null : revisionIndex)}
                className={cn(
                  "rounded-row px-2 py-0.5 text-[0.6875rem] font-medium transition",
                  revisionIndex === index
                    ? "bg-[var(--color-ink)] text-[var(--color-bg)]"
                    : "text-[var(--color-faint)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]"
                )}
              >
                v{revisionIndex + 1}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {!current ? (
        <p className="mt-3 text-[0.8125rem] leading-6 text-[var(--color-muted)]">No final work was captured.</p>
      ) : (
        <>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-[0.78125rem] leading-5">
              <thead>
                <tr className="text-left text-[0.6875rem] text-[var(--color-muted)]">
                  <th className="border-b border-[var(--color-border)] py-1.5 pr-3 font-medium">Tier</th>
                  <th className="border-b border-[var(--color-border)] py-1.5 pr-3 font-medium">Price</th>
                  <th className="border-b border-[var(--color-border)] py-1.5 pr-3 font-medium">Segment</th>
                  <th className="border-b border-[var(--color-border)] py-1.5 font-medium">Fence</th>
                </tr>
              </thead>
              <tbody>
                {current.tiers.map((tier) => {
                  const tierDiff = diff.get(tier.name);
                  return (
                    <tr key={tier.name} className={cn(tierDiff?.added && "bg-[color-mix(in_oklch,var(--color-accent)_10%,transparent)]")}>
                      <td className="border-b border-[var(--color-border)] py-2 pr-3 font-medium text-[var(--color-ink)]" title={tier.rationale}>{tier.name}</td>
                      <td className={cn("border-b border-[var(--color-border)] py-2 pr-3 tabular-nums", tierDiff?.changed.has("price") && changedCell)}>${tier.price.toFixed(2)}</td>
                      <td className={cn("border-b border-[var(--color-border)] py-2 pr-3 text-[var(--color-muted)]", tierDiff?.changed.has("targetSegment") && changedCell)}>{tier.targetSegment}</td>
                      <td className={cn("border-b border-[var(--color-border)] py-2 text-[var(--color-muted)]", tierDiff?.changed.has("fence") && changedCell)}>{tier.fence}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {current.revisionNote && index > 0 ? (
            <p className="mt-2.5 text-[0.75rem] leading-5 text-[var(--color-accent-strong)]">Revised: {current.revisionNote}</p>
          ) : null}
          <p className="mt-2 text-[0.75rem] leading-5 text-[var(--color-muted)]">
            <span className="font-medium text-[var(--color-ink)]">Risk: </span>
            {current.expectedRisk}
          </p>
        </>
      )}
    </section>
  );
}
