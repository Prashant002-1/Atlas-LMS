import { cn } from "@/lib/utils";
import { SideNoteCardView } from "@/components/session/side-note-card";
import type { DrillInTurn } from "@/lib/instructor/cockpit";
import type { SideNoteCard } from "@/lib/agent/session-parts";

/**
 * The frozen transcript with evidence highlighted IN PLACE: every verified
 * span the grade stands on is marked in the exact characters it was taken
 * from, tagged with its criterion. This is the review surface that earns
 * operational trust; citations are claims, highlights are receipts.
 */

export function TranscriptView({
  turns,
  sideNotesByTurnIndex,
  criterionNames,
}: {
  turns: DrillInTurn[];
  sideNotesByTurnIndex: Record<number, SideNoteCard[]>;
  criterionNames: Record<string, string>;
}) {
  return (
    <section
      aria-label="Session transcript"
      className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-panel)]"
    >
      <p className="atlas-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-faint)]">
        Transcript, as graded
      </p>

      <div className="mt-3 space-y-4">
        {turns.map((turn) => (
          <div key={turn.id} id={`turn-${turn.id}`} className="scroll-mt-24">
            <div
              className={cn(
                "max-w-[95%] text-[13.5px] leading-6",
                turn.role === "user"
                  ? "ml-auto w-fit rounded-[12px] bg-[var(--color-indigo-soft)] px-3.5 py-2 text-[var(--color-ink)]"
                  : "text-[var(--color-muted)]"
              )}
            >
              <span className="atlas-mono mr-2 text-[10px] uppercase tracking-[0.07em] text-[var(--color-faint)]">
                {turn.role === "user" ? "student" : turn.role === "assistant" ? "atlas" : "tool"}
              </span>
              {turn.segments.map((segment, index) =>
                segment.spans.length > 0 ? (
                  <mark
                    key={index}
                    className="rounded-[3px] bg-[color-mix(in_oklch,var(--color-accent)_26%,transparent)] px-0.5 text-[var(--color-ink)]"
                    title={segment.spans
                      .map((span) => criterionNames[span.criterionKey] ?? span.criterionKey)
                      .join(", ")}
                  >
                    {segment.text}
                    <sup className="atlas-mono ml-0.5 text-[9px] text-[var(--color-accent-strong)]">
                      {[...new Set(segment.spans.map((span) => shortTag(span.criterionKey)))].join(",")}
                    </sup>
                  </mark>
                ) : (
                  <span key={index}>{segment.text}</span>
                )
              )}
            </div>
            {(sideNotesByTurnIndex[turn.turnIndex] ?? []).map((note) => (
              <div key={note.id} className="mt-2">
                <SideNoteCardView note={note} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function shortTag(criterionKey: string): string {
  const word = criterionKey.split("_")[0];
  return word.slice(0, 4);
}
