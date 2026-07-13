import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { diffRubrics, type RubricDiff } from "@/lib/agent/rubric-proposal";
import type { RubricCriterion } from "@/lib/agent/session-parts";

/**
 * The rubric, rendered as the record it will become. One component serves
 * the planning conversation (with a comparison against the version it
 * replaces), Review (the full draft before the professor applies it), and
 * any surface that wants the current rubric readable at a glance.
 *
 * Server-safe and pure: criteria in, marks on what changed, no hooks.
 */

export type RubricCardProps = {
  title?: string;
  criteria: RubricCriterion[];
  /** The rubric this draft replaces; turns the card into a comparison. */
  compare?: { version: number; criteria: RubricCriterion[] } | null;
  /** compact = name/weight rows only (Review summaries, rails). */
  compact?: boolean;
  className?: string;
};

const LEVEL_TONE: Record<string, string> = {
  Exceeds: "text-[var(--color-accent-strong)]",
  Meets: "text-[var(--color-ink)]",
  Developing: "text-[var(--color-muted)]",
  Missing: "text-[var(--color-faint)]",
};

function Chip({ tone, children }: { tone: "accent" | "neutral"; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-row border px-1.5 py-px text-[0.65625rem] font-medium leading-4",
        tone === "accent"
          ? "border-[color-mix(in_oklch,var(--color-accent)_38%,transparent)] bg-[color-mix(in_oklch,var(--color-accent)_12%,transparent)] text-[var(--color-accent-strong)]"
          : "border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-muted)]"
      )}
    >
      {children}
    </span>
  );
}

export function RubricCard({ title, criteria, compare, compact = false, className }: RubricCardProps) {
  const diff: RubricDiff | null = compare ? diffRubrics(compare.criteria, criteria) : null;
  const diffByKey = new Map((diff?.criteria ?? []).map((entry) => [entry.key, entry]));
  const totalWeight = criteria.reduce((sum, criterion) => sum + criterion.weight, 0);

  return (
    <div className={cn("overflow-hidden rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)]", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3.5 py-2.5">
        <p className="min-w-0 text-[0.84375rem] font-semibold text-[var(--color-ink)]">{title ?? "Rubric"}</p>
        <p className="atlas-mono text-[0.65625rem] uppercase tracking-[0.07em] text-[var(--color-faint)]">
          {criteria.length} criteria · {totalWeight} pts
          {compare ? ` · against v${compare.version}` : ""}
        </p>
      </div>

      <ul className={cn("divide-y divide-[var(--color-border)]", compact ? "" : "")}>
        {criteria.map((criterion) => {
          const entry = diffByKey.get(criterion.key) ?? null;
          const weightMoved = entry?.state === "changed" && entry.weightFrom !== null && entry.weightFrom !== entry.weightTo;
          const revisedByLevel = new Map((entry?.revisedLevels ?? []).map((r) => [r.level, r.previous]));

          return (
            <li key={criterion.key} className="px-3.5 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="min-w-0 text-[0.8125rem] font-medium text-[var(--color-ink)]">
                  {criterion.name}
                  {entry?.renamedFrom ? (
                    <span className="ml-2 text-[0.71875rem] font-normal text-[var(--color-faint)]">was {entry.renamedFrom}</span>
                  ) : null}
                </p>
                <span className="flex shrink-0 items-center gap-1.5">
                  {entry?.state === "new" ? <Chip tone="accent">New</Chip> : null}
                  <span className="atlas-mono text-[0.71875rem] tabular-nums text-[var(--color-muted)]">
                    {weightMoved ? (
                      <>
                        <span className="text-[var(--color-faint)] line-through">{entry!.weightFrom}</span>{" "}
                        <span className="font-medium text-[var(--color-accent-strong)]">{criterion.weight} pts</span>
                      </>
                    ) : (
                      `${criterion.weight} pts`
                    )}
                  </span>
                </span>
              </div>

              {!compact ? (
                <>
                  <p className="mt-1 text-[0.75rem] leading-5 text-[var(--color-muted)]">{criterion.description}</p>
                  <div className="mt-2.5 grid gap-px overflow-hidden rounded-row border border-[var(--color-border)] bg-[var(--color-border)] sm:grid-cols-2 xl:grid-cols-4">
                    {criterion.levels.map((level) => {
                      const previous = revisedByLevel.get(level.level);
                      return (
                        <div key={level.level} className="bg-[var(--color-surface)] px-2.5 py-2">
                          <p className="flex items-baseline justify-between gap-2">
                            <span className={cn("atlas-mono text-[0.625rem] uppercase tracking-[0.07em]", LEVEL_TONE[level.level])}>
                              {level.level}
                            </span>
                            <span className="atlas-mono text-[0.6875rem] tabular-nums text-[var(--color-faint)]">{level.score}</span>
                          </p>
                          <p className="mt-1 text-[0.71875rem] leading-4 text-[var(--color-muted)]">{level.descriptor}</p>
                          {previous !== undefined ? (
                            <details className="mt-1.5">
                              <summary className="cursor-pointer list-none text-[0.625rem] font-medium uppercase tracking-[0.07em] text-[var(--color-accent-strong)]">
                                Revised
                              </summary>
                              <p className="mt-1 text-[0.6875rem] leading-4 text-[var(--color-faint)]">{previous}</p>
                            </details>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : null}
            </li>
          );
        })}
      </ul>

      {diff && diff.removed.length > 0 ? (
        <p className="border-t border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3.5 py-2 text-[0.71875rem] leading-4 text-[var(--color-muted)]">
          Not carried over:{" "}
          {diff.removed.map((removed, index) => (
            <span key={removed.key}>
              <span className="line-through">{removed.name}</span>
              <span className="text-[var(--color-faint)]"> ({removed.weight} pts)</span>
              {index < diff.removed.length - 1 ? ", " : ""}
            </span>
          ))}
        </p>
      ) : null}
    </div>
  );
}
