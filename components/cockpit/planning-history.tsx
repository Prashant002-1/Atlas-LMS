import { History } from "lucide-react";
import type { PlanningSessionView } from "@/lib/instructor/cockpit";

/**
 * Planning history: the professor's own working sessions with Atlas, on the
 * record. This is the provenance story made visible; the side note a student
 * sees mid-session traces back to a conversation listed here, not to an
 * upload ceremony.
 */
export function PlanningHistory({ sessions }: { sessions: PlanningSessionView[] }) {
  return (
    <section
      aria-label="Planning history"
      className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-panel)]"
    >
      <p className="atlas-mono flex items-center gap-1.5 text-[11px] uppercase tracking-[0.08em] text-[var(--color-faint)]">
        <History size={12} aria-hidden />
        Planning history
      </p>

      {sessions.length === 0 ? (
        <p className="mt-2.5 text-[13px] leading-6 text-[var(--color-muted)]">
          No planning sessions on record yet. Your working sessions with Atlas land here and become the context your
          students&apos; sessions draw on.
        </p>
      ) : (
        <ul className="mt-2.5 space-y-2">
          {sessions.map((session) => (
            <li key={session.id}>
              <details className="group rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface-muted)]">
                <summary className="flex cursor-pointer list-none items-baseline justify-between gap-3 px-3 py-2.5">
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium text-[var(--color-ink)]">{session.title}</span>
                    {session.summary ? (
                      <span className="mt-0.5 block text-[12px] leading-5 text-[var(--color-muted)]">{session.summary}</span>
                    ) : null}
                  </span>
                  <span className="atlas-mono shrink-0 text-[10.5px] text-[var(--color-faint)]">
                    {new Date(session.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </summary>
                <div className="space-y-2 border-t border-[var(--color-border)] px-3 py-2.5">
                  {session.turns.map((turn, index) => (
                    <p key={index} className="text-[12px] leading-5">
                      <span className="atlas-mono mr-1.5 text-[10px] uppercase tracking-[0.07em] text-[var(--color-faint)]">
                        {turn.role === "user" ? "prof" : "atlas"}
                      </span>
                      <span className="text-[var(--color-muted)]">{turn.text}</span>
                    </p>
                  ))}
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
