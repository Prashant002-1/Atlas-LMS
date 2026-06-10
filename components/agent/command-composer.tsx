"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, CircleStop } from "lucide-react";
import type { UIMessage } from "ai";
import { runAgentStream, toolParts, textOf } from "@/lib/agent/stream-client";
import { blockSchema, type Block } from "@/lib/agent/blocks";
import { BlockView } from "@/components/agent/block-views";

/**
 * The professor's command line. One sentence in; a grounded draft out, streamed
 * as typed blocks. The run is visible while it happens, and lands as a proposal
 * in Review — Atlas proposes, the professor decides.
 */

const TOOL_TO_BLOCK: Record<string, string> = {
  proposeObjective: "objective",
  proposeModule: "module",
  proposeAssignment: "assignment",
  proposePage: "page",
  proposeAnnouncement: "announcement",
  proposePracticeSet: "practice_set",
  proposeRubric: "rubric",
};

type RunPhase = "idle" | "running" | "done" | "error";

const suggestions = [
  "Draft a practice set on this week's material",
  "Write a course note about the upcoming midterm",
  "Add a week on a topic the course is missing",
];

export function CommandComposer({ courseId }: { courseId: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<RunPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<Array<{ key: string; block: Block | null; toolName: string }>>([]);
  const [narration, setNarration] = useState("");
  const [intent, setIntent] = useState("");
  const abortRef = useRef<(() => void) | null>(null);
  const [, startTransition] = useTransition();

  async function run(text: string) {
    const trimmed = text.trim();
    if (!trimmed || phase === "running") return;
    setPhase("running");
    setError(null);
    setBlocks([]);
    setNarration("");

    try {
      const handle = await runAgentStream("/api/agent/command", { courseId, intent: trimmed });
      abortRef.current = handle.abort;

      let latest: UIMessage | null = null;
      for await (const message of handle.messages) {
        latest = message;
        const parts = toolParts(message);
        setBlocks(
          parts
            .filter((p) => TOOL_TO_BLOCK[p.toolName])
            .map((p, i) => {
              const type = TOOL_TO_BLOCK[p.toolName];
              const candidate = p.input && typeof p.input === "object" ? { ...(p.input as object), type } : null;
              const parsed = candidate ? blockSchema.safeParse(candidate) : null;
              return { key: `${i}-${p.toolName}`, block: parsed?.success ? parsed.data : null, toolName: p.toolName };
            })
        );
        setNarration(textOf(message));
      }

      setPhase("done");
      setIntent("");
      if (latest && toolParts(latest).some((p) => TOOL_TO_BLOCK[p.toolName])) {
        // A proposal landed — pull the fresh Review list into the page.
        startTransition(() => router.refresh());
      }
    } catch (err) {
      setPhase("error");
      setError(err instanceof Error ? err.message : "The run failed.");
    } finally {
      abortRef.current = null;
    }
  }

  const running = phase === "running";

  return (
    <div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void run(intent);
        }}
      >
        <div className="flex items-stretch gap-2">
          <label htmlFor="atlas-command" className="sr-only">
            Ask Atlas to draft something
          </label>
          <input
            id="atlas-command"
            value={intent}
            onChange={(event) => setIntent(event.target.value)}
            placeholder="Tell Atlas what to draft — it lands in Review"
            disabled={running}
            autoComplete="off"
            className="min-h-11 w-full rounded-[8px] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3.5 text-[14px] text-[var(--color-ink)] placeholder:text-[var(--color-faint)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)] disabled:opacity-60"
          />
          {running ? (
            <button
              type="button"
              onClick={() => abortRef.current?.()}
              className="inline-flex min-h-11 items-center gap-2 rounded-[8px] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-4 text-[14px] font-medium text-[var(--color-ink)] transition hover:border-[var(--color-ink)]"
            >
              <CircleStop size={15} strokeWidth={2} aria-hidden /> Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={intent.trim().length < 4}
              className="inline-flex min-h-11 items-center gap-2 rounded-[8px] border border-[var(--color-ink)] bg-[var(--color-ink)] px-4 text-[14px] font-medium text-white transition hover:border-[var(--color-accent-strong)] hover:bg-[var(--color-accent-strong)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Draft <ArrowUpRight size={15} strokeWidth={2} aria-hidden />
            </button>
          )}
        </div>
      </form>

      {phase === "idle" ? (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => void run(s)}
              className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-[12px] text-[var(--color-muted)] transition hover:border-[var(--color-border-strong)] hover:text-[var(--color-ink)]"
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-[6px] border border-[rgba(140,60,40,0.25)] bg-[rgba(140,60,40,0.06)] px-3 py-2 text-[13px] text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}

      {running || blocks.length > 0 ? (
        <div className="mt-4 space-y-3" aria-live="polite">
          {running ? (
            <p className="atlas-mono flex items-center gap-2 text-[12px] uppercase tracking-[0.08em] text-[var(--color-muted)]">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--color-accent)]" aria-hidden />
              Drafting from the course record
            </p>
          ) : null}
          {blocks.map(({ key, block, toolName }) =>
            block ? (
              <BlockView key={key} block={block} />
            ) : (
              <div
                key={key}
                className="animate-pulse rounded-[8px] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-[13px] text-[var(--color-faint)]"
              >
                Drafting {TOOL_TO_BLOCK[toolName] ?? toolName}…
              </div>
            )
          )}
          {phase === "done" && blocks.length > 0 ? (
            <p className="text-[13px] leading-6 text-[var(--color-muted)]">
              {narration || "Draft ready."} <span className="font-medium text-[var(--color-ink)]">It is waiting in Review — nothing is live until you apply it.</span>
            </p>
          ) : null}
          {phase === "done" && blocks.length === 0 && narration ? (
            <p className="whitespace-pre-wrap text-[14px] leading-6 text-[var(--color-ink)]">{narration}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
