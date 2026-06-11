"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, CircleStop, FileText } from "lucide-react";
import type { UIMessage } from "ai";
import { runAgentStream, toolParts, textOf } from "@/lib/agent/stream-client";
import { blockSchema, type Block } from "@/lib/agent/blocks";
import { BlockView } from "@/components/agent/block-views";

/**
 * The professor's Atlas surface: a streaming conversation with the course's
 * own agent. Every drafted block lands in Review; the conversation is the
 * working session, not the record.
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

type Entry =
  | { kind: "user"; text: string }
  | { kind: "assistant"; text: string; blocks: Array<Block | null>; toolNames: string[]; done: boolean };

function entriesFromHistory(messages: UIMessage[]): Entry[] {
  return messages.map((message) => {
    if (message.role === "user") {
      return { kind: "user" as const, text: textOf(message) };
    }
    const parts = toolParts(message).filter((p) => TOOL_TO_BLOCK[p.toolName]);
    return {
      kind: "assistant" as const,
      text: textOf(message),
      blocks: parts.map((p) => parseBlock(p.toolName, p.input)),
      toolNames: parts.map((p) => p.toolName),
      done: true,
    };
  });
}

function parseBlock(toolName: string, input: unknown): Block | null {
  if (!input || typeof input !== "object") return null;
  const parsed = blockSchema.safeParse({ ...(input as object), type: TOOL_TO_BLOCK[toolName] });
  return parsed.success ? parsed.data : null;
}

export function AtlasAssistant({ courseId, initialMessages }: { courseId: string; initialMessages: UIMessage[] }) {
  const router = useRouter();
  const [entries, setEntries] = useState<Entry[]>(() => entriesFromHistory(initialMessages));
  const [intent, setIntent] = useState("");
  const [syllabus, setSyllabus] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<(() => void) | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  async function run(text: string) {
    const trimmed = text.trim();
    if (!trimmed || running) return;
    setRunning(true);
    setError(null);
    setEntries((prev) => [...prev, { kind: "user", text: trimmed }, { kind: "assistant", text: "", blocks: [], toolNames: [], done: false }]);
    queueMicrotask(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }));

    let drafted = false;
    try {
      const handle = await runAgentStream("/api/agent/command", { courseId, intent: trimmed });
      abortRef.current = handle.abort;

      for await (const message of handle.messages) {
        const parts = toolParts(message).filter((p) => TOOL_TO_BLOCK[p.toolName]);
        if (parts.length > 0) drafted = true;
        const next: Entry = {
          kind: "assistant",
          text: textOf(message),
          blocks: parts.map((p) => parseBlock(p.toolName, p.input)),
          toolNames: parts.map((p) => p.toolName),
          done: false,
        };
        setEntries((prev) => [...prev.slice(0, -1), next]);
      }
      setEntries((prev) => {
        const last = prev[prev.length - 1];
        return last.kind === "assistant" ? [...prev.slice(0, -1), { ...last, done: true }] : prev;
      });
      setIntent("");
      setSyllabus("");
      if (drafted) router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The run failed.");
      setEntries((prev) => (prev[prev.length - 1]?.kind === "assistant" && !prev[prev.length - 1]?.text ? prev.slice(0, -2) : prev));
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }

  function importSyllabus() {
    const text = syllabus.trim();
    if (text.length < 40) return;
    void run(
      "Import this syllabus into the course record. Draft the learning objectives first, then weekly modules, then the graded work, all as proposal blocks. Keep my wording where it is specific.\n\nSYLLABUS:\n" +
        text
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-160px)] flex-col">
      <div className="flex-1 space-y-5">
        {entries.length === 0 ? (
          <div className="rounded-[8px] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-6">
            <p className="text-[14px] leading-6 text-[var(--color-muted)]">
              Tell Atlas what to draft. It works from the course record and everything it writes waits in
              Review until you apply it. Try one of these, or paste a syllabus below.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {[
                "Draft a practice set on this week's material",
                "Write a course note about the upcoming midterm",
                "Add a week on a topic the course is missing",
              ].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void run(s)}
                  className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-[12.5px] text-[var(--color-muted)] transition hover:border-[var(--color-border-strong)] hover:text-[var(--color-ink)]"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {entries.map((entry, index) =>
          entry.kind === "user" ? (
            <div key={index} className="flex justify-end">
              <p className="max-w-[80%] whitespace-pre-wrap rounded-[10px] bg-[var(--color-indigo-soft)] px-3.5 py-2.5 text-[14px] leading-6">
                {entry.text.length > 600 ? entry.text.slice(0, 600) + "…" : entry.text}
              </p>
            </div>
          ) : (
            <div key={index} className="space-y-3">
              {!entry.done && entry.blocks.length === 0 && !entry.text ? (
                <p className="atlas-mono flex items-center gap-2 text-[12px] uppercase tracking-[0.08em] text-[var(--color-muted)]">
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--color-accent)]" aria-hidden />
                  Reading the course record
                </p>
              ) : null}
              {entry.blocks.map((block, i) =>
                block ? (
                  <BlockView key={i} block={block} />
                ) : (
                  <div key={i} className="animate-pulse rounded-[8px] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-[13px] text-[var(--color-faint)]">
                    Drafting {(TOOL_TO_BLOCK[entry.toolNames[i]] ?? "block").replaceAll("_", " ")}&hellip;
                  </div>
                )
              )}
              {entry.text ? <p className="whitespace-pre-wrap text-[14px] leading-6">{entry.text}</p> : null}
              {entry.done && entry.blocks.length > 0 ? (
                <p className="text-[13px] text-[var(--color-muted)]">
                  Waiting in <a href="/teach/review" className="font-medium text-[var(--color-accent-strong)]">Review</a>. Nothing is live until you apply it.
                </p>
              ) : null}
            </div>
          )
        )}
        <div ref={endRef} />
      </div>

      {error ? (
        <p className="mt-4 rounded-[6px] border border-[rgba(140,60,40,0.25)] bg-[rgba(140,60,40,0.06)] px-3 py-2 text-[13px] text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}

      <div className="sticky bottom-0 mt-5 border-t border-[var(--color-border)] bg-[var(--color-bg)] pb-1 pt-4">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void run(intent);
          }}
        >
          <div className="flex items-stretch gap-2">
            <label htmlFor="atlas-intent" className="sr-only">
              Ask Atlas to draft something
            </label>
            <input
              id="atlas-intent"
              value={intent}
              onChange={(event) => setIntent(event.target.value)}
              placeholder="Tell Atlas what to draft"
              disabled={running}
              autoComplete="off"
              className="min-h-11 w-full rounded-[8px] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3.5 text-[14px] placeholder:text-[var(--color-faint)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)] disabled:opacity-60"
            />
            {running ? (
              <button
                type="button"
                onClick={() => abortRef.current?.()}
                className="inline-flex min-h-11 items-center gap-2 rounded-[8px] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-4 text-[14px] font-medium transition hover:border-[var(--color-ink)]"
              >
                <CircleStop size={15} strokeWidth={2} aria-hidden /> Stop
              </button>
            ) : (
              <button
                type="submit"
                disabled={intent.trim().length < 4}
                className="inline-flex min-h-11 items-center gap-2 rounded-[8px] border border-[var(--color-ink)] bg-[var(--color-ink)] px-4 text-[14px] font-medium text-white transition hover:border-[var(--color-accent-strong)] hover:bg-[var(--color-accent-strong)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Send <ArrowUpRight size={15} strokeWidth={2} aria-hidden />
              </button>
            )}
          </div>
        </form>

        <details className="mt-2.5">
          <summary className="inline-flex cursor-pointer items-center gap-1.5 text-[12.5px] font-medium text-[var(--color-muted)] transition hover:text-[var(--color-ink)]">
            <FileText size={13} strokeWidth={2} aria-hidden /> Import a syllabus
          </summary>
          <div className="mt-2 grid gap-2">
            <textarea
              value={syllabus}
              onChange={(event) => setSyllabus(event.target.value)}
              rows={6}
              disabled={running}
              placeholder="Paste your syllabus. Atlas drafts the objectives, weeks, and work from it, for your review."
              className="w-full resize-y rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-[13.5px] leading-6 placeholder:text-[var(--color-faint)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)] disabled:opacity-60"
            />
            <div>
              <button
                type="button"
                onClick={importSyllabus}
                disabled={running || syllabus.trim().length < 40}
                className="inline-flex min-h-10 items-center rounded-[8px] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-4 text-[13.5px] font-medium transition hover:border-[var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Draft from syllabus
              </button>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}
