"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type {
  PricingArtifact,
  StructuredArtifact,
  UpdateArtifactInput,
} from "@/lib/agent/session-parts";

export type ArtifactRevision = UpdateArtifactInput;

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

function changedSections(current: StructuredArtifact, previous: StructuredArtifact | null) {
  if (!previous) return new Set<string>();
  const beforeByHeading = new Map(previous.sections.map((section) => [section.heading, JSON.stringify(section)]));
  return new Set(
    current.sections
      .filter((section) => beforeByHeading.get(section.heading) !== JSON.stringify(section))
      .map((section) => section.heading)
  );
}

const changedCell = "bg-[color-mix(in_oklch,var(--color-accent)_16%,transparent)]";

export function ArtifactPanel({
  revisions,
  className,
  title = "Submission draft",
  plain = false,
  headingHidden = false,
}: {
  revisions: ArtifactRevision[];
  className?: string;
  title?: string;
  plain?: boolean;
  /**
   * Keep the heading for assistive technology but drop it visually. Used when
   * the panel sits under a tab that already carries the same word: showing it
   * twice in the same corner is the redundancy this UI keeps removing.
   */
  headingHidden?: boolean;
}) {
  const [pinned, setPinned] = useState<number | null>(null);
  const latest = revisions.length - 1;
  const index = pinned !== null && pinned < latest ? pinned : Math.max(latest, 0);
  const current = revisions[index] ?? null;
  const previous = index > 0 ? revisions[index - 1] ?? null : null;

  return (
    <section
      aria-label={title}
      className={cn(
        plain ? "" : "rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)] p-4",
        className
      )}
    >
      <div className={cn("flex items-center gap-3", headingHidden ? "justify-end" : "justify-between")}>
        <h2 className={cn(headingHidden ? "sr-only" : "font-semibold text-[var(--color-ink)]", !headingHidden && (plain ? "text-[1rem]" : "text-[0.8125rem]"))}>{title}</h2>
        {revisions.length > 1 ? (
          <div className="flex items-center gap-1" role="tablist" aria-label="Submission revisions">
            {revisions.map((_, revisionIndex) => (
              <button
                key={revisionIndex}
                type="button"
                role="tab"
                aria-label={`Revision ${revisionIndex + 1}`}
                aria-selected={revisionIndex === index}
                onClick={() => setPinned(revisionIndex >= latest ? null : revisionIndex)}
                className={cn(
                  "min-w-6 rounded-row px-1.5 py-0.5 text-[0.6875rem] font-medium tabular-nums transition",
                  revisionIndex === index
                    ? "bg-[var(--color-ink)] text-[var(--color-bg)]"
                    : "text-[var(--color-faint)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]"
                )}
              >
                {revisionIndex + 1}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {!current ? (
        <p className="mt-3 text-[0.8125rem] leading-6 text-[var(--color-muted)]">
          No draft.
        </p>
      ) : current.artifactType === "pricing_table" ? (
        <PricingArtifactView
          current={current.state}
          previous={previous?.artifactType === "pricing_table" ? previous.state : null}
          index={index}
        />
      ) : (
        <StructuredArtifactView
          current={current.state}
          previous={previous?.artifactType === "structured_response" ? previous.state : null}
          index={index}
        />
      )}
    </section>
  );
}

function StructuredArtifactView({
  current,
  previous,
  index,
}: {
  current: StructuredArtifact;
  previous: StructuredArtifact | null;
  index: number;
}) {
  const changed = useMemo(() => changedSections(current, previous), [current, previous]);

  return (
    <div className="mt-3">
      <h3 className="text-[0.875rem] font-semibold leading-6 text-[var(--color-ink)]">{current.title}</h3>
      {current.summary ? <p className="mt-1 text-[0.78125rem] leading-5 text-[var(--color-muted)]">{current.summary}</p> : null}
      <div className="mt-3 space-y-3">
        {current.sections.map((section, sectionIndex) => (
          <section
            key={`${section.heading}-${sectionIndex}`}
            className={cn("py-3", changed.has(section.heading) && "bg-[color-mix(in_oklch,var(--color-accent)_8%,transparent)]")}
          >
            <h4 className="text-[0.75rem] font-semibold text-[var(--color-ink)]">{section.heading}</h4>
            {section.content ? <p className="mt-1 whitespace-pre-wrap text-[0.78125rem] leading-5 text-[var(--color-muted)]">{section.content}</p> : null}
            {section.fields?.length ? (
              <dl className="mt-2 grid gap-2">
                {section.fields.map((field, fieldIndex) => (
                  <div key={`${field.label}-${fieldIndex}`} className="grid gap-0.5 py-1.5 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-3">
                    <dt className="text-[0.6875rem] font-medium text-[var(--color-faint)]">{field.label}</dt>
                    <dd className="text-[0.75rem] leading-5 text-[var(--color-ink)]">{field.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {section.items?.length ? (
              <ul className="mt-2 list-disc space-y-1 pl-4 text-[0.75rem] leading-5 text-[var(--color-muted)]">
                {section.items.map((item, itemIndex) => <li key={`${section.heading}-${itemIndex}`}>{item}</li>)}
              </ul>
            ) : null}
          </section>
        ))}
      </div>
      {current.revisionNote && index > 0 ? (
        <p className="mt-2.5 text-[0.75rem] leading-5 text-[var(--color-accent-strong)]">Revised: {current.revisionNote}</p>
      ) : null}
    </div>
  );
}

function PricingArtifactView({
  current,
  previous,
  index,
}: {
  current: PricingArtifact;
  previous: PricingArtifact | null;
  index: number;
}) {
  const diff = useMemo(() => diffTiers(current, previous), [current, previous]);

  return (
    <>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full border-collapse text-[0.78125rem] leading-5">
          <caption className="sr-only">Pricing submission draft</caption>
          <thead>
            <tr className="border-b border-[var(--color-border)] text-left text-[0.6875rem] text-[var(--color-muted)]">
              <th className="py-1.5 pr-3 font-medium">Tier</th>
              <th className="py-1.5 pr-3 font-medium">Price</th>
              <th className="py-1.5 pr-3 font-medium">Segment</th>
              <th className="py-1.5 font-medium">Fence</th>
            </tr>
          </thead>
          <tbody>
            {current.tiers.map((tier) => {
              const tierDiff = diff.get(tier.name);
              return (
                <tr key={tier.name} className={cn("border-b border-[var(--color-border)] last:border-b-0", tierDiff?.added && "bg-[color-mix(in_oklch,var(--color-accent)_10%,transparent)]")}>
                  <td className="py-2 pr-3 font-medium text-[var(--color-ink)]" title={tier.rationale}>{tier.name}</td>
                  <td className={cn("py-2 pr-3 tabular-nums", tierDiff?.changed.has("price") && changedCell)}>${tier.price.toFixed(2)}</td>
                  <td className={cn("py-2 pr-3 text-[var(--color-muted)]", tierDiff?.changed.has("targetSegment") && changedCell)}>{tier.targetSegment}</td>
                  <td className={cn("py-2 text-[var(--color-muted)]", tierDiff?.changed.has("fence") && changedCell)}>{tier.fence}</td>
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
  );
}
