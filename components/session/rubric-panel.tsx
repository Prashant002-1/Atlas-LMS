"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RubricCriterion } from "@/lib/agent/session-parts";

/** The assignment rubric stays visible while the student works. */
export function RubricPanel({
  criteria,
  className,
  plain = false,
}: {
  criteria: RubricCriterion[];
  className?: string;
  plain?: boolean;
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);

  return (
    <section
      aria-label="Rubric"
      className={cn(
        plain ? "" : "rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)] p-4",
        className
      )}
    >
      <h2 className="text-[0.8125rem] font-semibold text-[var(--color-ink)]">Rubric</h2>
      <ul className="mt-2 space-y-1">
        {criteria.map((criterion) => {
          const open = openKey === criterion.key;
          const target = criterion.levels.find((level) => level.level === "Exceeds") ?? criterion.levels[0];
          return (
            <li key={criterion.key}>
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpenKey(open ? null : criterion.key)}
                className="flex w-full items-center justify-between gap-2 py-2.5 text-left"
              >
                <span className="text-[0.78125rem] font-medium leading-5 text-[var(--color-ink)]">
                  {criterion.name}
                  <span className="ml-1.5 font-normal tabular-nums text-[var(--color-faint)]">{criterion.weight}%</span>
                </span>
                <ChevronDown
                  size={13}
                  aria-hidden
                  className={cn("shrink-0 text-[var(--color-faint)] transition-transform", open && "rotate-180")}
                />
              </button>
              <div className={cn("pb-3", !open && "hidden")}>
                <p className="text-[0.75rem] leading-5 text-[var(--color-muted)]">{criterion.description}</p>
                <p className="mt-1.5 text-[0.75rem] leading-5 text-[var(--color-muted)]">
                  <span className="font-medium text-[var(--color-accent-strong)]">{target.level}: </span>
                  {target.descriptor}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
