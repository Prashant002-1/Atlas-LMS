import { cn } from "@/lib/utils";
import { SideNoteCardView } from "@/components/session/side-note-card";
import type { DrillInTurn } from "@/lib/instructor/cockpit";
import type { SideNoteCard } from "@/lib/agent/session-parts";

/** The frozen session transcript with verified grading evidence highlighted in place. */
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
    <section aria-labelledby="session-transcript-heading" className="pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="session-transcript-heading" className="text-[1.125rem] font-semibold text-[var(--color-ink)]">Session transcript</h2>
        <p className="text-[0.75rem] text-[var(--color-muted)]">Highlighted text was used in the grade.</p>
      </div>

      <div className="mt-5 space-y-5">
        {turns.map((turn) => (
          <div key={turn.id} id={`turn-${turn.id}`} className="scroll-mt-24">
            <p className="mb-1.5 text-[0.6875rem] font-medium uppercase tracking-[0.06em] text-[var(--color-faint)]">
              {turn.role === "user" ? "Student" : turn.role === "assistant" ? "Atlas" : "Tool"}
            </p>
            <div
              className={cn(
                "max-w-3xl text-[0.84375rem] leading-6",
                turn.role === "user"
                  ? "rounded-row bg-[var(--color-surface-muted)] px-3.5 py-2.5 text-[var(--color-ink)]"
                  : "text-[var(--color-muted)]"
              )}
            >
              {turn.segments.map((segment, index) =>
                segment.spans.length > 0 ? (
                  <mark
                    key={index}
                    className="rounded-control bg-[color-mix(in_oklch,var(--color-accent)_26%,transparent)] px-0.5 text-[var(--color-ink)]"
                    title={segment.spans.map((span) => criterionNames[span.criterionKey] ?? span.criterionKey).join(", ")}
                  >
                    {segment.text}
                    <sup className="ml-0.5 text-[0.625rem] font-medium text-[var(--color-accent-strong)]">
                      {[...new Set(segment.spans.map((span) => shortTag(span.criterionKey)))].join(",")}
                    </sup>
                  </mark>
                ) : (
                  <span key={index}>{segment.text}</span>
                )
              )}
            </div>
            {(sideNotesByTurnIndex[turn.turnIndex] ?? []).map((note) => (
              <div key={note.id} className="mt-2 max-w-3xl">
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
