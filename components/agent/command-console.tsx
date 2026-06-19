"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, CircleStop, FileText, Eye, Search, Clock, Check } from "lucide-react";
import type { UIMessage } from "ai";
import { runAgentStream, toolParts, textOf } from "@/lib/agent/stream-client";
import { blockSchema, type Block } from "@/lib/agent/blocks";
import { BlockView } from "@/components/agent/block-views";

/**
 * The professor's command console: a streaming working session with the
 * course's agent, restructured from a single talking column into a working
 * stream plus a live artifact ledger.
 *
 *   left  : the working stream, the run as it happens. The agent's reads and
 *           recalls show as action receipts; every drafted block renders inline.
 *   right : everything this session has drafted, each waiting in Review. Nothing
 *           is live until the professor applies it.
 *
 * Runs against the existing /api/agent/command route; the block registry is
 * shared with Review, so a draft looks identical in flight and at rest.
 */

const TOOL_TO_BLOCK: Record<string, Block["type"]> = {
  proposeObjective: "objective",
  proposeModule: "module",
  proposeAssignment: "assignment",
  proposePage: "page",
  proposeAnnouncement: "announcement",
  proposePracticeSet: "practice_set",
  proposeRubric: "rubric",
};

const ACTION_META: Record<string, { label: string; Icon: typeof Eye }> = {
  inspectRecord: { label: "Read a record in full", Icon: Eye },
  recallSession: { label: "Recalled this session", Icon: Search },
  readHistoryWindow: { label: "Read earlier turns", Icon: Clock },
};

const KIND_LABEL: Record<Block["type"], string> = {
  objective: "Objective",
  module: "Module",
  assignment: "Work",
  page: "Page",
  announcement: "Note",
  practice_set: "Practice",
  rubric: "Rubric",
  explanation: "Explanation",
  answer: "Answer",
};

type DraftedBlock = { block: Block | null; toolName: string };
type ActionItem = { toolName: string; summary: string };
type UserEntry = { kind: "user"; text: string };
type AssistantEntry = {
  kind: "assistant";
  text: string;
  blocks: DraftedBlock[];
  actions: ActionItem[];
  done: boolean;
};
type Entry = UserEntry | AssistantEntry;

function parseBlock(toolName: string, input: unknown): Block | null {
  const type = TOOL_TO_BLOCK[toolName];
  if (!type || !input || typeof input !== "object") return null;
  const parsed = blockSchema.safeParse({ ...(input as object), type });
  return parsed.success ? parsed.data : null;
}

function summarizeAction(toolName: string, input: unknown): string {
  const data = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  if (toolName === "inspectRecord") {
    const t = typeof data.recordType === "string" ? data.recordType : "record";
    return t;
  }
  if (toolName === "recallSession") {
    const q = typeof data.query === "string" ? data.query : "";
    return q ? `“${q}”` : "earlier turns";
  }
  if (toolName === "readHistoryWindow") {
    const c = typeof data.centerTurn === "number" ? data.centerTurn : null;
    return c ? `around turn ${c}` : "a window of turns";
  }
  return "";
}

function blockTitle(block: Block): string {
  switch (block.type) {
    case "objective":
      return block.code;
    case "module":
    case "assignment":
      return block.name;
    case "page":
    case "announcement":
    case "practice_set":
    case "rubric":
      return block.title;
    case "explanation":
      return block.headline;
    case "answer":
      return "Answer";
    default:
      return "Block";
  }
}

function processAssistant(message: UIMessage, done: boolean): AssistantEntry {
  const parts = toolParts(message);
  const blocks: DraftedBlock[] = [];
  const actions: ActionItem[] = [];
  for (const part of parts) {
    if (TOOL_TO_BLOCK[part.toolName]) {
      blocks.push({ block: parseBlock(part.toolName, part.input), toolName: part.toolName });
    } else if (ACTION_META[part.toolName]) {
      actions.push({ toolName: part.toolName, summary: summarizeAction(part.toolName, part.input) });
    }
  }
  return { kind: "assistant", text: textOf(message), blocks, actions, done };
}

function entriesFromHistory(messages: UIMessage[]): Entry[] {
  return messages.map((message): Entry =>
    message.role === "user"
      ? { kind: "user", text: textOf(message) }
      : processAssistant(message, true)
  );
}

const SUGGESTIONS = [
  "Draft a practice set on this week's material",
  "Write a course note about the upcoming midterm",
  "Add a week on a topic the course is missing",
];

export function CommandConsole({ courseId, initialMessages }: { courseId: string; initialMessages: UIMessage[] }) {
  const router = useRouter();
  const [entries, setEntries] = useState<Entry[]>(() => entriesFromHistory(initialMessages));
  const [intent, setIntent] = useState("");
  const [syllabus, setSyllabus] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<(() => void) | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const ledger = useMemo(() => {
    const items: Array<{ key: string; type: Block["type"]; title: string }> = [];
    entries.forEach((entry, ei) => {
      if (entry.kind !== "assistant") return;
      entry.blocks.forEach((b, bi) => {
        if (b.block) items.push({ key: `${ei}-${bi}`, type: b.block.type, title: blockTitle(b.block) });
      });
    });
    return items;
  }, [entries]);

  async function run(text: string) {
    const trimmed = text.trim();
    if (trimmed.length < 4 || running) return;
    setRunning(true);
    setError(null);
    setEntries((prev) => [
      ...prev,
      { kind: "user", text: trimmed },
      { kind: "assistant", text: "", blocks: [], actions: [], done: false },
    ]);
    queueMicrotask(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }));

    let drafted = false;
    try {
      const handle = await runAgentStream("/api/agent/command", { courseId, intent: trimmed });
      abortRef.current = handle.abort;

      for await (const message of handle.messages) {
        const next = processAssistant(message, false);
        if (next.blocks.length > 0) drafted = true;
        setEntries((prev) => [...prev.slice(0, -1), next]);
      }
      setEntries((prev) => {
        const last = prev[prev.length - 1];
        return last && last.kind === "assistant" ? [...prev.slice(0, -1), { ...last, done: true }] : prev;
      });
      setIntent("");
      setSyllabus("");
      if (drafted) router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The run failed.");
      setEntries((prev) => {
        const last = prev[prev.length - 1];
        return last && last.kind === "assistant" && !last.text && last.blocks.length === 0 ? prev.slice(0, -2) : prev;
      });
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
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      {/* working stream */}
      <div className="flex min-h-[calc(100vh-220px)] flex-col">
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-[var(--color-border)] pb-3">
          <span className="inline-flex items-center gap-2 text-[12.5px] font-medium">
            <span
              className={`inline-block h-2 w-2 rounded-full ${running ? "animate-pulse bg-[var(--color-accent)]" : "bg-[var(--color-faint)]"}`}
              aria-hidden
            />
            {running ? "Atlas is working" : "Working session"}
          </span>
          <Link
            href="/teach/review"
            className="inline-flex items-center gap-1.5 rounded-[6px] text-[13px] font-medium text-[var(--color-muted)] transition hover:text-[var(--color-ink)]"
          >
            Open Review <ArrowUpRight size={14} strokeWidth={2} aria-hidden />
          </Link>
        </div>

        <div className="flex-1 space-y-5">
          {entries.length === 0 ? (
            <div className="rounded-[8px] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-6">
              <p className="text-[14px] leading-6 text-[var(--color-muted)]">
                Tell Atlas what to draft. It works from the course record, and everything it writes waits in
                Review until you apply it. Try one of these, or paste a syllabus below.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {SUGGESTIONS.map((s) => (
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
                {!entry.done && entry.actions.length === 0 && entry.blocks.length === 0 && !entry.text ? (
                  <p className="atlas-mono flex items-center gap-2 text-[12px] uppercase tracking-[0.08em] text-[var(--color-muted)]">
                    <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--color-accent)]" aria-hidden />
                    Reading the course record
                  </p>
                ) : null}

                {entry.actions.map((action, i) => {
                  const meta = ACTION_META[action.toolName];
                  if (!meta) return null;
                  const Icon = meta.Icon;
                  return (
                    <div
                      key={`a-${i}`}
                      className="flex items-center gap-2.5 rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 shadow-[var(--shadow-panel)]"
                    >
                      <span className="grid h-6 w-6 place-items-center rounded-[6px] bg-[var(--color-surface-muted)] text-[var(--color-muted)]">
                        <Icon size={14} strokeWidth={2} aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13px]">
                        <span className="font-medium">{meta.label}</span>
                        {action.summary ? <span className="text-[var(--color-muted)]"> · {action.summary}</span> : null}
                      </span>
                      {entry.done ? <Check size={14} strokeWidth={2} className="text-[var(--color-good)]" aria-hidden /> : null}
                    </div>
                  );
                })}

                {entry.blocks.map((b, i) =>
                  b.block ? (
                    <BlockView key={`b-${i}`} block={b.block} />
                  ) : (
                    <div
                      key={`b-${i}`}
                      className="animate-pulse rounded-[8px] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-[13px] text-[var(--color-faint)]"
                    >
                      Drafting {(TOOL_TO_BLOCK[b.toolName] ?? "block").replaceAll("_", " ")}…
                    </div>
                  )
                )}

                {entry.text ? <p className="whitespace-pre-wrap text-[14px] leading-6">{entry.text}</p> : null}

                {entry.done && entry.blocks.some((b) => b.block) ? (
                  <p className="text-[13px] text-[var(--color-muted)]">
                    Waiting in{" "}
                    <Link href="/teach/review" className="font-medium text-[var(--color-accent-strong)]">
                      Review
                    </Link>
                    . Nothing is live until you apply it.
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
              <label htmlFor="atlas-command" className="sr-only">
                Ask Atlas to draft something
              </label>
              <input
                id="atlas-command"
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

      {/* artifact ledger */}
      <aside className="lg:sticky lg:top-4 lg:self-start">
        <div className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-panel)]">
          <header className="flex items-baseline justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3">
            <h2 className="text-[13px] font-semibold text-[var(--color-ink)]">This session</h2>
            <span className="atlas-mono text-[11px] text-[var(--color-muted)]">
              {ledger.length} {ledger.length === 1 ? "draft" : "drafts"}
            </span>
          </header>
          <div className="p-3">
            {ledger.length === 0 ? (
              <p className="px-1 py-4 text-center text-[12.5px] leading-5 text-[var(--color-faint)]">
                Nothing drafted yet. What Atlas proposes appears here and waits in Review.
              </p>
            ) : (
              <ul className="space-y-2">
                {ledger.map((item) => (
                  <li
                    key={item.key}
                    className="flex items-start gap-2.5 rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-2 shadow-[var(--shadow-panel)]"
                  >
                    <span className="mt-0.5 min-w-0 flex-1">
                      <span className="atlas-mono block text-[10px] uppercase tracking-[0.06em] text-[var(--color-faint)]">
                        {KIND_LABEL[item.type]}
                      </span>
                      <span className="block truncate text-[13px] font-medium text-[var(--color-ink)]">{item.title}</span>
                    </span>
                    <span className="atlas-mono shrink-0 rounded-[5px] bg-[color-mix(in_oklch,var(--color-accent)_11%,transparent)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.04em] text-[var(--color-accent-strong)]">
                      Drafted
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {ledger.length > 0 ? (
            <footer className="border-t border-[var(--color-border)] px-4 py-3">
              <Link
                href="/teach/review"
                className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--color-accent-strong)]"
              >
                Review and apply <ArrowUpRight size={14} strokeWidth={2} aria-hidden />
              </Link>
            </footer>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
