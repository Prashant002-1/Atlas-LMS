"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";

export type ModuleSwitcherItem = {
  id: string;
  week: string;
  title: string;
  status: "draft" | "needs-review" | "approved";
};

export function ModuleSwitcher({ modules, currentId }: { modules: ModuleSwitcherItem[]; currentId: string }) {
  const [open, setOpen] = useState(false);
  const currentIndex = modules.findIndex((module) => module.id === currentId);
  const current = currentIndex >= 0 ? modules[currentIndex] : null;
  const previous = currentIndex > 0 ? modules[currentIndex - 1] : null;
  const next = currentIndex < modules.length - 1 ? modules[currentIndex + 1] : null;
  const stepStyle = "inline-flex size-8 items-center justify-center text-[var(--color-muted)] transition hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-accent-strong)]";

  if (!current) return null;

  return (
    <div className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <div className="inline-flex overflow-hidden rounded-control border border-[var(--color-border-strong)] bg-[var(--color-surface)] shadow-[var(--shadow-panel)]">
        {previous ? (
          <Link href={`/teach/week/${previous.id}`} aria-label={`Previous module, ${previous.title}`} title={previous.title} className={`${stepStyle} border-r border-[var(--color-border)]`}>
            <ChevronLeft size={14} aria-hidden />
          </Link>
        ) : <span className={`${stepStyle} border-r border-[var(--color-border)] opacity-30`} aria-hidden><ChevronLeft size={14} /></span>}
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="inline-flex min-h-8 min-w-[6.5rem] items-center justify-center px-3 text-[0.75rem] font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-accent-strong)]"
        >
          Week {current.week}
        </button>
        {next ? (
          <Link href={`/teach/week/${next.id}`} aria-label={`Next module, ${next.title}`} title={next.title} className={`${stepStyle} border-l border-[var(--color-border)]`}>
            <ChevronRight size={14} aria-hidden />
          </Link>
        ) : <span className={`${stepStyle} border-l border-[var(--color-border)] opacity-30`} aria-hidden><ChevronRight size={14} /></span>}
      </div>

      <div
        className={`absolute right-0 top-full z-30 w-[20rem] origin-top-right pt-2 transition-[opacity,transform,visibility] duration-150 ease-out ${
          open ? "visible translate-y-0 opacity-100" : "pointer-events-none invisible -translate-y-1 opacity-0"
        }`}
      >
        <div role="listbox" aria-label="Switch module" className="overflow-hidden rounded-panel border border-[var(--color-border-strong)] bg-[var(--color-surface)] py-1 shadow-[var(--shadow-floating)]">
          {modules.map((module) => {
            const active = module.id === currentId;
            return (
              <Link
                key={module.id}
                href={`/teach/week/${module.id}`}
                role="option"
                aria-selected={active}
                className={`grid grid-cols-[2.75rem_minmax(0,1fr)_1rem] items-center gap-2 px-3 py-2.5 transition hover:bg-[var(--color-surface-muted)] ${active ? "bg-[var(--color-indigo-soft)]" : ""}`}
              >
                <span className="atlas-mono text-[0.6875rem] text-[var(--color-faint)]">{module.week}</span>
                <span className="min-w-0">
                  <span className="block truncate text-[0.78125rem] font-medium text-[var(--color-ink)]">{module.title}</span>
                  {module.status !== "approved" ? <span className="mt-0.5 block text-[0.65625rem] text-[var(--color-muted)]">{module.status === "needs-review" ? "Review" : "Draft"}</span> : null}
                </span>
                {active ? <Check size={13} aria-hidden className="text-[var(--color-accent-strong)]" /> : null}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
