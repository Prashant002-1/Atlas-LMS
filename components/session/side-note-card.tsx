"use client";

import { Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SideNoteCard } from "@/lib/agent/session-parts";

/**
 * Side-note card, the context layer made visible. Deliberately NOT a chat
 * bubble: a flagged margin annotation with its sources on it, so the claim
 * "this came from your record, not from the model" is legible at a glance.
 */
export function SideNoteCardView({ note, className }: { note: SideNoteCard; className?: string }) {
  return (
    <aside
      aria-label="Side note based on your grades"
      className={cn(
        "relative w-full max-w-[35rem] rounded-panel border border-[color-mix(in_oklch,var(--color-warn)_45%,var(--color-border))]",
        "bg-[color-mix(in_oklch,var(--color-warn)_9%,var(--color-surface))] px-4 py-3 shadow-[var(--shadow-panel)]",
        className
      )}
    >
      <span aria-hidden className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-[var(--color-warn)]" />
      <p className="atlas-mono flex items-center gap-1.5 text-[0.65625rem] uppercase tracking-[0.09em] text-[var(--color-warn)]">
        <Flag size={11} strokeWidth={2.4} aria-hidden />
        Based on your grades
      </p>
      <p className="mt-1.5 text-[0.84375rem] leading-6 text-[var(--color-ink)]">{stripFlagPrefix(note.text)}</p>
      {note.sourceRefs.length > 0 ? (
        <p className="atlas-mono mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[0.65625rem] text-[var(--color-faint)]">
          {note.sourceRefs.map((ref) => (
            <span key={ref} className="inline-flex items-center gap-1">
              <span aria-hidden className="inline-block size-1 rounded-full bg-[var(--color-warn)]" />
              {sourceLabel(ref)}
            </span>
          ))}
        </p>
      ) : null}
    </aside>
  );
}

/** The stored text carries its own label prefix; the card chrome already says it. */
function stripFlagPrefix(text: string): string {
  return text.replace(/^FLAG - Based on your grades:\s*/i, "");
}

function sourceLabel(ref: string): string {
  if (ref.startsWith("record:")) return "gradebook record";
  if (ref.startsWith("planning-session:")) return "professor's planning session";
  return `page: ${ref}`;
}
