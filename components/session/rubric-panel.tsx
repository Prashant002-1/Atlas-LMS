"use client";

import { useState } from "react";
import { ChevronDown, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RubricCriterion } from "@/lib/agent/session-parts";

/**
 * Rubric panel, "what doing well looks like", visible from the first second
 * of the session. Scoring transparency is the pedagogy claim: the student
 * knows what is measured before they start, so the journey report later reads
 * as fair, not as an ambush.
 */
export function RubricPanel({ criteria, className }: { criteria: RubricCriterion[]; className?: string }) {
  const [openKey, setOpenKey] = useState<string | null>(null);

  return (
    <section
      aria-label="What doing well looks like"
      className={cn(
        "rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-panel)]",
        className
      )}
    >
      <p className="atlas-mono flex items-center gap-1.5 text-[11px] uppercase tracking-[0.08em] text-[var(--color-faint)]">
        <ListChecks size={12} aria-hidden />
        What doing well looks like
      </p>
      <ul className="mt-2.5 space-y-1">
        {criteria.map((criterion) => {
          const open = openKey === criterion.key;
          const meets = criterion.levels.find((l) => l.level === "Exceeds") ?? criterion.levels[0];
          return (
            <li key={criterion.key} className="rounded-row border border-transparent transition hover:border-[var(--color-border)]">
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpenKey(open ? null : criterion.key)}
                className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left"
              >
                <span className="text-[13px] font-medium text-[var(--color-ink)]">
                  {criterion.name}
                  <span className="ml-1.5 text-[11.5px] font-normal text-[var(--color-faint)]">{criterion.weight}%</span>
                </span>
                <ChevronDown
                  size={13}
                  aria-hidden
                  className={cn("shrink-0 text-[var(--color-faint)] transition-transform", open && "rotate-180")}
                />
              </button>
              <div className={cn("px-2 pb-2", !open && "hidden")}>
                <p className="text-[12.5px] leading-5 text-[var(--color-muted)]">{criterion.description}</p>
                <p className="mt-1.5 text-[12px] leading-5 text-[var(--color-muted)]">
                  <span className="atlas-mono text-[10.5px] uppercase tracking-[0.07em] text-[var(--color-accent-strong)]">
                    {meets.level}{" "}
                  </span>
                  {meets.descriptor}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
