import { cn } from "@/lib/utils";
import type { SteeringNote } from "@/components/ai-elements/use-steering";

/**
 * The two places a redirection is visible.
 *
 * Above the composer, what has been sent and whether the run has taken it, so
 * the difference between "typed" and "Atlas is acting on it" is never guessed.
 * And in the thread, the point where the redirection actually reached the
 * model, because a response that changes direction halfway needs to show why.
 */

export function SteeringPending({ notes }: { notes: SteeringNote[] }) {
  if (notes.length === 0) return null;
  return (
    <ul className="mb-2 space-y-1" aria-label="Redirections for this response">
      {notes.map((note) => (
        <li key={note.id} className="flex items-start gap-2 text-[0.71875rem] leading-5 text-[var(--color-muted)]">
          <span
            className={cn(
              "mt-1.5 size-1.5 shrink-0 rounded-full",
              note.applied ? "bg-[var(--color-accent-strong)]" : "bg-[var(--color-border-strong)]"
            )}
            aria-hidden
          />
          <span className="min-w-0 flex-1 truncate">{note.text}</span>
          <span className="shrink-0 text-[var(--color-faint)]">{note.applied ? "Atlas has it" : "Sending"}</span>
        </li>
      ))}
    </ul>
  );
}

/** Where the professor changed course while this response was being written. */
export function SteeringMark({ notes }: { notes: string[] }) {
  return (
    <div className="border-l-2 border-[var(--color-accent-strong)] pl-3">
      <p className="text-[0.6875rem] font-medium uppercase tracking-[0.06em] text-[var(--color-faint)]">You redirected Atlas</p>
      {notes.map((note, index) => (
        <p key={index} className="mt-1 text-[0.8125rem] leading-5 text-[var(--color-ink)]">{note}</p>
      ))}
    </div>
  );
}
