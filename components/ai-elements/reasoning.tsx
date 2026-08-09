"use client";

import { useState } from "react";
import { BrainIcon, ChevronDownIcon } from "lucide-react";
import { Markdown } from "@/components/agent/markdown";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { cn } from "@/lib/utils";

/**
 * Provider-supplied reasoning or reasoning summaries. Live reasoning opens on
 * first mount and stays where the reader left it, so completion never causes
 * a large collapse and scroll jump. Rehydrated completed reasoning starts
 * collapsed to keep old turns compact.
 */
export function Reasoning({
  children,
  streaming = false,
  className,
}: {
  children: string;
  streaming?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(streaming);
  return (
    <section className={cn("w-full max-w-[42rem] overflow-hidden rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)]", className)}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex min-h-10 w-full items-center justify-between gap-3 px-3 py-2 text-left transition hover:bg-[var(--color-surface-muted)]"
      >
        <span className="flex min-w-0 items-center gap-2">
          <BrainIcon size={14} className="shrink-0 text-[var(--color-faint)]" aria-hidden />
          {streaming ? (
            <Shimmer as="span" duration={1.6} spread={1.4} className="text-[0.78125rem] font-medium">Reasoning</Shimmer>
          ) : (
            <span className="text-[0.78125rem] font-medium text-[var(--color-muted)]">Reasoning</span>
          )}
        </span>
        <ChevronDownIcon size={15} className={cn("shrink-0 text-[var(--color-faint)] transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open ? (
        <div className="border-t border-[var(--color-border)] px-3 py-3 text-[var(--color-muted)]">
          <Markdown streaming={streaming}>{children}</Markdown>
        </div>
      ) : null}
    </section>
  );
}
