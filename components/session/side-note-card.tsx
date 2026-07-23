"use client";

import { cn } from "@/lib/utils";
import type { SideNoteCard } from "@/lib/agent/session-parts";

/** A server-composed note from the student's own course facts, not a chat bubble. */
export function SideNoteCardView({ note, className }: { note: SideNoteCard; className?: string }) {
  return (
    <aside
      aria-label="Note from your course"
      className={cn(
        "w-full max-w-[35rem] border-l-2 border-[var(--color-warn)] bg-[color-mix(in_oklch,var(--color-warn)_7%,transparent)] px-4 py-3",
        className
      )}
    >
      <p className="text-[0.6875rem] font-semibold text-[var(--color-warn)]">From your course:</p>
      <p className="mt-1 text-[0.84375rem] leading-6 text-[var(--color-ink)]">{stripFlagPrefix(note.text)}</p>
      {note.sourceRefs.length > 0 ? (
        <p className="mt-1.5 text-[0.65625rem] leading-4 text-[var(--color-faint)]">
          {note.sourceRefs.map(sourceLabel).join(" · ")}
        </p>
      ) : null}
    </aside>
  );
}

/** The stored text carries its own label prefix; the note already names its source. */
function stripFlagPrefix(text: string): string {
  return text.replace(/^FLAG - Based on your grades:\s*/i, "");
}

function sourceLabel(ref: string): string {
  if (ref.startsWith("record:")) return "Your gradebook";
  if (ref.startsWith("planning-session:")) return "Professor plan";
  return ref;
}
