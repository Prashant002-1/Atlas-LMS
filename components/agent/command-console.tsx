"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, CircleStop, FileText, Eye, Search, Clock, Check, Plus, PenLine } from "lucide-react";
import type { UIMessage } from "ai";
import { runAgentStream, toolParts, textOf } from "@/lib/agent/stream-client";
import type { SessionDraft } from "@/lib/agent/session";
import { blockSchema, type Block } from "@/lib/agent/blocks";
import { BlockView } from "@/components/agent/block-views";

/**
 * The professor's command console: a streaming working session with the
 * course's agent, structured as a command center rather than a single
 * talking column.
 *
 *   left   : current durable command session.
 *   center : the run as it happens. The agent's reads and recalls show as action
 *            receipts; every drafted block renders inline.
 *   right  : everything this session has drafted, plus the activity trail.
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

const BLOCK_TO_TOOL: Partial<Record<Block["type"], string>> = Object.fromEntries(
  Object.entries(TOOL_TO_BLOCK).map(([toolName, blockType]) => [blockType, toolName])
);

const ACTION_META: Record<string, { label: string; Icon: typeof Eye }> = {
  proposeObjective: { label: "Drafted objective", Icon: FileText },
  proposeModule: { label: "Drafted module", Icon: FileText },
  proposeAssignment: { label: "Drafted work", Icon: FileText },
  proposePage: { label: "Drafted page", Icon: FileText },
  proposeAnnouncement: { label: "Drafted note", Icon: FileText },
  proposePracticeSet: { label: "Drafted practice", Icon: FileText },
  proposeRubric: { label: "Drafted rubric", Icon: FileText },
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
  if (TOOL_TO_BLOCK[toolName]) {
    const title = data.name ?? data.title ?? data.code ?? data.headline;
    return typeof title === "string" ? title : TOOL_TO_BLOCK[toolName].replaceAll("_", " ");
  }
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
    }
    if (ACTION_META[part.toolName]) {
      actions.push({ toolName: part.toolName, summary: summarizeAction(part.toolName, part.input) });
    }
  }
  return { kind: "assistant", text: textOf(message), blocks, actions, done };
}

function draftedBlock(block: Block): DraftedBlock {
  return { block, toolName: BLOCK_TO_TOOL[block.type] ?? block.type };
}

function entriesFromHistory(messages: UIMessage[], drafts: SessionDraft[] = []): Entry[] {
  let draftIndex = 0;
  return messages.map((message): Entry =>
    message.role === "user"
      ? { kind: "user", text: textOf(message) }
      : withHydratedDraft(processAssistant(message, true), drafts[draftIndex++])
  );
}

function withHydratedDraft(entry: AssistantEntry, draft: SessionDraft | undefined): AssistantEntry {
  if (!draft || entry.blocks.some((b) => b.block)) return entry;
  const blocks = draft.blocks.map(draftedBlock);
  const actions = blocks.map((b) => ({ toolName: b.toolName, summary: b.block ? blockTitle(b.block) : "" }));
  return { ...entry, blocks, actions };
}

const SUGGESTIONS = [
  "Draft a practice set on this week's material",
  "Write a course note about the upcoming midterm",
  "Add a week on a topic the course is missing",
];

export function CommandConsole({
  courseId,
  courseLabel,
  initialMessages,
  initialDrafts = [],
}: {
  courseId: string;
  courseLabel: string;
  initialMessages: UIMessage[];
  initialDrafts?: SessionDraft[];
}) {
  const router = useRouter();
  const [entries, setEntries] = useState<Entry[]>(() => entriesFromHistory(initialMessages, initialDrafts));
  const [intent, setIntent] = useState("");
  const [syllabus, setSyllabus] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<(() => void) | null>(null);
  const activeRunRef = useRef(0);
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

  const activity = useMemo(() => {
    const items: Array<{ key: string; label: string; summary: string; done: boolean }> = [];
    entries.forEach((entry, entryIndex) => {
      if (entry.kind !== "assistant") return;
      entry.actions.forEach((action, actionIndex) => {
        const meta = ACTION_META[action.toolName];
        if (!meta) return;
        items.push({
          key: `${entryIndex}-${actionIndex}`,
          label: meta.label,
          summary: action.summary,
          done: entry.done,
        });
      });
    });
    return items;
  }, [entries]);

  const sessionTitle = useMemo(() => {
    const firstUser = entries.find((entry): entry is UserEntry => entry.kind === "user");
    if (!firstUser) return "Course command session";
    return firstUser.text.length > 54 ? `${firstUser.text.slice(0, 54)}...` : firstUser.text;
  }, [entries]);

  const turnCount = entries.filter((entry) => entry.kind === "user").length;

  async function run(text: string) {
    const trimmed = text.trim();
    if (trimmed.length < 4 || running) return;
    const runId = activeRunRef.current + 1;
    activeRunRef.current = runId;
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
        if (activeRunRef.current !== runId) return;
        const next = processAssistant(message, false);
        if (next.blocks.length > 0) drafted = true;
        setEntries((prev) => [...prev.slice(0, -1), next]);
      }
      if (activeRunRef.current !== runId) return;
      setEntries((prev) => {
        const last = prev[prev.length - 1];
        return last && last.kind === "assistant" ? [...prev.slice(0, -1), { ...last, done: true }] : prev;
      });
      setIntent("");
      setSyllabus("");
      if (drafted) router.refresh();
    } catch (err) {
      if (activeRunRef.current === runId) {
        setError(err instanceof Error ? err.message : "The run failed.");
        settleLastAssistant();
      }
    } finally {
      if (activeRunRef.current === runId) {
        setRunning(false);
        abortRef.current = null;
      }
    }
  }

  function stopRun() {
    activeRunRef.current += 1;
    abortRef.current?.();
    abortRef.current = null;
    setRunning(false);
    settleLastAssistant();
  }

  function settleLastAssistant() {
    setEntries((prev) => {
      const last = prev[prev.length - 1];
      if (!last || last.kind !== "assistant") return prev;
      if (!last.text && last.blocks.length === 0 && last.actions.length === 0) return prev.slice(0, -2);
      return [...prev.slice(0, -1), { ...last, done: true }];
    });
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
    <div className="grid h-full min-h-[720px] w-full overflow-x-hidden overflow-y-auto bg-[var(--color-bg)] shadow-[var(--shadow-panel)] lg:min-h-0 lg:grid-cols-[230px_minmax(0,1fr)_300px] lg:overflow-hidden 2xl:grid-cols-[264px_minmax(0,1fr)_332px]">
      <aside className="min-w-0 border-b border-[var(--color-border)] bg-[var(--color-surface-sidebar)] lg:border-b-0 lg:border-r">
        <div className="border-b border-[var(--color-border)] p-3">
          <button
            type="button"
            onClick={() => document.getElementById("atlas-command")?.focus()}
            className="flex min-h-10 w-full items-center justify-between gap-3 rounded-[8px] bg-[var(--color-ink)] px-3 text-left text-[13px] font-semibold text-white transition hover:bg-[var(--color-accent-strong)]"
          >
            <span className="inline-flex items-center gap-2">
              <Plus size={14} strokeWidth={2} aria-hidden /> New session
            </span>
            <span className="atlas-mono rounded-[4px] bg-white/15 px-1.5 py-0.5 text-[10px]">N</span>
          </button>
          <div className="mt-2 flex h-9 items-center gap-2 rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 text-[12.5px] text-[var(--color-faint)]">
            <Search size={13} strokeWidth={2} aria-hidden />
            <span>This session</span>
          </div>
        </div>
        <div className="p-2">
          <p className="atlas-mono px-2 py-2 text-[10px] uppercase tracking-[0.08em] text-[var(--color-faint)]">Sessions</p>
          <button
            type="button"
            onClick={() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })}
            className="relative w-full rounded-[8px] bg-[var(--color-surface)] px-3 py-2.5 text-left shadow-[var(--shadow-panel)]"
          >
            <span className="absolute bottom-2.5 left-1 top-2.5 w-[2px] rounded-full bg-[var(--color-accent)]" aria-hidden />
            <span className="flex items-center gap-2 pl-2">
              <span
                className={`h-2 w-2 rounded-full ${running ? "animate-pulse bg-[var(--color-accent)]" : "bg-[var(--color-good)]"}`}
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{sessionTitle}</span>
            </span>
            <span className="mt-1 flex items-center gap-1.5 pl-6 text-[11px] text-[var(--color-muted)]">
              <span className="atlas-mono uppercase">Command</span>
              <span aria-hidden>·</span>
              <span>{turnCount} {turnCount === 1 ? "turn" : "turns"}</span>
            </span>
          </button>
        </div>
      </aside>

      <section className="flex min-h-0 min-w-0 flex-col">
        <header className="flex items-center gap-3 border-b border-[var(--color-border)] px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-serif text-[17px] font-semibold leading-tight 2xl:text-[20px]">{sessionTitle}</h2>
            <p className="mt-1 text-[12.5px] text-[var(--color-muted)]">
              {courseLabel} · Command session · {turnCount} {turnCount === 1 ? "turn" : "turns"}
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-semibold ${
              running
                ? "border-[color-mix(in_oklch,var(--color-accent)_32%,var(--color-border))] bg-[color-mix(in_oklch,var(--color-accent)_9%,transparent)] text-[var(--color-accent-strong)]"
                : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted)]"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full bg-current ${running ? "animate-pulse" : ""}`} aria-hidden />
            {running ? "Working" : "Idle"}
          </span>
          <Link
            href="/teach/review"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-[8px] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 text-[12.5px] font-semibold transition hover:border-[var(--color-ink)]"
          >
            Review <ArrowUpRight size={14} strokeWidth={2} aria-hidden />
          </Link>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <div className="mx-auto flex max-w-[780px] flex-col gap-4">
            {entries.length === 0 ? (
              <div className="rounded-[8px] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-5">
                <p className="text-[14px] leading-6 text-[var(--color-muted)]">
                  Tell Atlas what to draft. Every block waits in Review until you apply it.
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
                  <p className="max-w-[82%] whitespace-pre-wrap rounded-[12px_12px_4px_12px] bg-[var(--color-indigo-soft)] px-3.5 py-2.5 text-[14px] leading-6">
                    {entry.text.length > 700 ? entry.text.slice(0, 700) + "..." : entry.text}
                  </p>
                </div>
              ) : (
                <div key={index} className="space-y-3">
                  <p className="flex items-center gap-2 text-[12px] text-[var(--color-muted)]">
                    <span className="grid h-5 w-5 place-items-center rounded-full border border-[var(--color-indigo)] text-[var(--color-accent)]" aria-hidden>
                      •
                    </span>
                    Atlas worked from the course record
                  </p>

                  {!entry.done && entry.actions.length === 0 && entry.blocks.length === 0 && !entry.text ? (
                    <div className="rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
                      <p className="atlas-mono flex items-center gap-2 text-[12px] uppercase tracking-[0.08em] text-[var(--color-muted)]">
                        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--color-accent)]" aria-hidden />
                        Reading the course record
                      </p>
                    </div>
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
                        Drafting {(TOOL_TO_BLOCK[b.toolName] ?? "block").replaceAll("_", " ")}...
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
        </div>

        {error ? (
          <p className="mx-5 mb-3 rounded-[6px] border border-[rgba(140,60,40,0.25)] bg-[rgba(140,60,40,0.06)] px-3 py-2 text-[13px] text-[var(--color-danger)]">
            {error}
          </p>
        ) : null}

        <div className="border-t border-[var(--color-border)] bg-[color-mix(in_oklch,var(--color-bg)_72%,var(--color-surface))] px-5 py-3">
          <form
            className="mx-auto max-w-[780px]"
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
                placeholder="Tell Atlas what to draft - it works from the course record and lands in Review"
                disabled={running}
                autoComplete="off"
                className="min-h-11 w-full rounded-[8px] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3.5 text-[14px] placeholder:text-[var(--color-faint)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)] disabled:opacity-60"
              />
              {running ? (
                <button
                  type="button"
                  onClick={stopRun}
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

          <div className="mx-auto mt-2.5 flex max-w-[780px] flex-wrap items-center gap-2">
            <details>
              <summary className="inline-flex min-h-7 cursor-pointer items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[12px] font-medium text-[var(--color-muted)] transition hover:border-[var(--color-border-strong)] hover:text-[var(--color-ink)]">
                <Plus size={13} strokeWidth={2} aria-hidden /> Import syllabus
              </summary>
              <div className="mt-2 grid w-[min(720px,calc(100vw-2rem))] gap-2 rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-elevated)]">
                <textarea
                  value={syllabus}
                  onChange={(event) => setSyllabus(event.target.value)}
                  rows={5}
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
            <button
              type="button"
              onClick={() => void run("Draft a practice set for this week's material, aligned to the current module and objectives.")}
              disabled={running}
              className="inline-flex min-h-7 items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[12px] font-medium text-[var(--color-muted)] transition hover:border-[var(--color-border-strong)] hover:text-[var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Clock size={13} strokeWidth={2} aria-hidden /> Draft this week
            </button>
            <button
              type="button"
              onClick={() => void run("Write a concise course note for students based on the current course context.")}
              disabled={running}
              className="inline-flex min-h-7 items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[12px] font-medium text-[var(--color-muted)] transition hover:border-[var(--color-border-strong)] hover:text-[var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <PenLine size={13} strokeWidth={2} aria-hidden /> Write a note
            </button>
            <span className="ml-auto text-[11.5px] text-[var(--color-faint)]">
              Atlas proposes · you apply · nothing goes live without your review
            </span>
          </div>
        </div>
      </section>

      <aside className="flex min-h-0 min-w-0 flex-col border-t border-[var(--color-border)] bg-[var(--color-surface-sidebar)] lg:border-l lg:border-t-0">
        <section className="min-h-0 border-b border-[var(--color-border)]">
          <header className="flex items-baseline justify-between gap-3 px-4 py-3">
            <h2 className="text-[13px] font-semibold text-[var(--color-ink)]">Artifacts</h2>
            <span className="atlas-mono text-[11px] text-[var(--color-muted)]">
              {ledger.length} {ledger.length === 1 ? "draft" : "drafts"}
            </span>
          </header>
          <div className="max-h-[260px] overflow-y-auto px-3 pb-3">
            {ledger.length === 0 ? (
              <p className="px-1 py-6 text-center text-[12.5px] leading-5 text-[var(--color-faint)]">
                Drafts will appear here.
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
        </section>

        <section className="min-h-0 flex-1">
          <header className="flex items-baseline justify-between gap-3 px-4 py-3">
            <h2 className="text-[13px] font-semibold text-[var(--color-ink)]">Activity</h2>
            <span className="atlas-mono text-[11px] text-[var(--color-muted)]">audit trail</span>
          </header>
          <div className="min-h-0 overflow-y-auto px-4 pb-4">
            {activity.length === 0 ? (
              <p className="py-6 text-center text-[12.5px] text-[var(--color-faint)]">Activity will log here.</p>
            ) : (
              <ol className="space-y-0">
                {activity.map((item, index) => (
                  <li key={item.key} className="relative pb-4 pl-5">
                    <span
                      className={`absolute left-0 top-1 h-2.5 w-2.5 rounded-full border ${
                        item.done
                          ? "border-[var(--color-good)] bg-[var(--color-good)]"
                          : "border-[var(--color-accent)] bg-[var(--color-surface)]"
                      }`}
                      aria-hidden
                    />
                    {index < activity.length - 1 ? (
                      <span className="absolute bottom-0 left-[4px] top-4 w-px bg-[var(--color-border)]" aria-hidden />
                    ) : null}
                    <p className="text-[12.5px] leading-5">
                      <span className="font-semibold">{item.label}</span>
                      {item.summary ? <span className="text-[var(--color-muted)]"> · {item.summary}</span> : null}
                    </p>
                    <p className="atlas-mono mt-0.5 text-[10.5px] text-[var(--color-faint)]">{item.done ? "done" : "working"}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>
          <div className="mx-4 mb-4 rounded-[8px] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-[11.5px] leading-5 text-[var(--color-muted)]">
            Drafted by Atlas, reviewed by you.
          </div>
        </section>
      </aside>
    </div>
  );
}
