"use client";

import { useMemo, useState } from "react";
import { Table2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PricingArtifact } from "@/lib/agent/session-parts";

/**
 * Artifact panel, the student's evolving deliverable. Shows the selected
 * revision as a real table, with the cells that changed since the previous
 * revision highlighted, so "iteration under challenge" is something you can
 * SEE happen, not something the transcript claims.
 */

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
    const before = previous?.tiers.find((t) => t.name === tier.name);
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

export function ArtifactPanel({ revisions, className }: { revisions: ArtifactRevision[]; className?: string }) {
  // Follow the newest revision unless the reader pins an older one; a pin on
  // the latest revision clears itself so new revisions keep taking over.
  const [pinned, setPinned] = useState<number | null>(null);
  const latest = revisions.length - 1;
  const index = pinned !== null && pinned < latest ? pinned : Math.max(latest, 0);
  const current = revisions[index]?.state ?? null;
  const previous = index > 0 ? revisions[index - 1]?.state ?? null : null;
  const diff = useMemo(() => (current ? diffTiers(current, previous) : new Map<string, TierDiff>()), [current, previous]);

  return (
    <section
      aria-label="Your working artifact"
      className={cn(
        "rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-panel)]",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="atlas-mono flex items-center gap-1.5 text-[11px] uppercase tracking-[0.08em] text-[var(--color-faint)]">
          <Table2 size={12} aria-hidden />
          Your design
        </p>
        {revisions.length > 1 ? (
          <div className="flex items-center gap-1" role="tablist" aria-label="Revisions">
            {revisions.map((_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === index}
                onClick={() => setPinned(i >= latest ? null : i)}
                className={cn(
                  "rounded-[6px] px-2 py-0.5 text-[11px] font-medium transition",
                  i === index
                    ? "bg-[var(--color-ink)] text-[var(--color-bg)]"
                    : "text-[var(--color-faint)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]"
                )}
              >
                v{i + 1}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {!current ? (
        <p className="mt-3 text-[13px] leading-6 text-[var(--color-muted)]">
          Nothing captured yet. As you propose and revise your design in the session, every version lands here.
        </p>
      ) : (
        <>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-[12.5px] leading-5">
              <thead>
                <tr className="atlas-mono text-left text-[10.5px] uppercase tracking-[0.07em] text-[var(--color-faint)]">
                  <th className="border-b border-[var(--color-border)] py-1.5 pr-3 font-medium">Tier</th>
                  <th className="border-b border-[var(--color-border)] py-1.5 pr-3 font-medium">Price</th>
                  <th className="border-b border-[var(--color-border)] py-1.5 pr-3 font-medium">Segment</th>
                  <th className="border-b border-[var(--color-border)] py-1.5 font-medium">Fence</th>
                </tr>
              </thead>
              <tbody>
                {current.tiers.map((tier) => {
                  const d = diff.get(tier.name);
                  return (
                    <tr key={tier.name} className={cn(d?.added && "bg-[color-mix(in_oklch,var(--color-accent)_10%,transparent)]")}>
                      <td className="border-b border-[var(--color-border)] py-2 pr-3 font-medium text-[var(--color-ink)]" title={tier.rationale}>
                        {tier.name}
                      </td>
                      <td className={cn("border-b border-[var(--color-border)] py-2 pr-3 tabular-nums", d?.changed.has("price") && changedCell)}>
                        ${tier.price.toFixed(2)}
                      </td>
                      <td className={cn("border-b border-[var(--color-border)] py-2 pr-3 text-[var(--color-muted)]", d?.changed.has("targetSegment") && changedCell)}>
                        {tier.targetSegment}
                      </td>
                      <td className={cn("border-b border-[var(--color-border)] py-2 text-[var(--color-muted)]", d?.changed.has("fence") && changedCell)}>
                        {tier.fence}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {current.revisionNote && index > 0 ? (
            <p className="mt-2.5 text-[12px] leading-5 text-[var(--color-accent-strong)]">Revised: {current.revisionNote}</p>
          ) : null}
          <p className="mt-2 text-[12px] leading-5 text-[var(--color-muted)]">
            <span className="atlas-mono text-[10.5px] uppercase tracking-[0.07em] text-[var(--color-faint)]">Risk </span>
            {current.expectedRisk}
          </p>
        </>
      )}
    </section>
  );
}
