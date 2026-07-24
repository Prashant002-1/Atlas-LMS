"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Tabs for a record that has several complete views of itself.
 *
 * A grade, the work that was submitted, and the transcript it came from are
 * three ways of reading one session, not three parts of one page. Stacked, the
 * reader scrolls past the whole grade to reach the transcript and then scrolls
 * back to compare, and nothing on screen tells them how much is left. As tabs,
 * each view owns the viewport and switching is one click in a fixed place.
 *
 * Only the selected panel is mounted, so a long transcript costs nothing until
 * it is asked for. State is local because a professor moving between grade and
 * transcript on one student is reading, not navigating: it should not stack up
 * in browser history.
 */

export type SectionTab = {
  id: string;
  label: string;
  /** A short fact beside the label, such as a count. Never a status word. */
  hint?: string;
  panel: ReactNode;
};

export function SectionTabs({
  tabs,
  ariaLabel,
  initialTabId,
}: {
  tabs: SectionTab[];
  ariaLabel: string;
  initialTabId?: string;
}) {
  const first = initialTabId && tabs.some((tab) => tab.id === initialTabId) ? initialTabId : tabs[0]?.id;
  const [activeId, setActiveId] = useState<string | undefined>(first);
  if (tabs.length === 0) return null;

  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0];

  return (
    <>
      <div role="tablist" aria-label={ariaLabel} className="flex flex-wrap items-end gap-6 border-b border-[var(--color-border)]">
        {tabs.map((tab) => {
          const selected = tab.id === active.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`panel-${tab.id}`}
              onClick={() => setActiveId(tab.id)}
              /*
               * The selected tab is marked by weight and the rule it sits on,
               * the way a real tab meets its panel. No pill, no badge.
               */
              className={cn(
                "-mb-px inline-flex items-baseline gap-1.5 border-b-2 pb-2.5 text-[0.84375rem] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)]",
                selected
                  ? "border-[var(--color-ink)] font-semibold text-[var(--color-ink)]"
                  : "border-transparent font-medium text-[var(--color-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-ink)]"
              )}
            >
              {tab.label}
              {tab.hint ? (
                <span className="text-[0.71875rem] font-normal tabular-nums text-[var(--color-faint)]">{tab.hint}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`panel-${active.id}`} aria-labelledby={`tab-${active.id}`} className="pt-7">
        {active.panel}
      </div>
    </>
  );
}
