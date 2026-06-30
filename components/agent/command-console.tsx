"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  ChevronDown,
  FileText,
  Eye,
  Search,
  Clock,
  Plus,
  PenLine,
  RotateCcw,
} from "lucide-react";
import type { UIMessage } from "ai";
import { runAgentStream, runEveAgentStream, toolParts, textOf } from "@/lib/agent/stream-client";
import type { CommandSessionSummary, SessionDraft } from "@/lib/agent/session";
import { blockSchema, type Block } from "@/lib/agent/blocks";
import { BlockView } from "@/components/agent/block-views";
import { AtlasMark } from "@/components/atlas/primitives";
import { setCourseScope } from "@/lib/workspace/scope-actions";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Loader } from "@/components/ai-elements/loader";
import { Message, MessageContent } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { Response } from "@/components/ai-elements/response";
import { Tool, ToolContent, ToolHeader } from "@/components/ai-elements/tool";

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
  return messages.map((message): Entry => {
    if (message.role === "user") return { kind: "user", text: textOf(message) };
    const entry = processAssistant(message, true);
    if (entry.blocks.some((b) => b.block)) return entry;
    const draft = drafts[draftIndex];
    if (!draft) return entry;
    draftIndex += 1;
    return withHydratedDraft(entry, draft);
  });
}

function withHydratedDraft(entry: AssistantEntry, draft: SessionDraft | undefined): AssistantEntry {
  if (!draft || !Array.isArray(draft.blocks) || draft.blocks.length === 0 || entry.blocks.some((b) => b.block)) return entry;
  const blocks = draft.blocks.map(draftedBlock);
  const actions = blocks.map((b) => ({ toolName: b.toolName, summary: b.block ? blockTitle(b.block) : "" }));
  return { ...entry, blocks, actions };
}

const SUGGESTIONS = [
  "Draft a practice set on this week's material",
  "Write a course note about the upcoming midterm",
  "Add a week on a topic the course is missing",
];

function sessionGroupLabel(updatedAt: string): "Today" | "Earlier" {
  const updated = new Date(updatedAt);
  const now = new Date();
  return updated.toDateString() === now.toDateString() ? "Today" : "Earlier";
}

function sessionWhen(updatedAt: string): string {
  const updated = new Date(updatedAt);
  const now = new Date();
  if (updated.toDateString() === now.toDateString()) {
    return updated.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  return updated.toLocaleDateString([], { month: "short", day: "numeric" });
}

function sessionDetail(session: CommandSessionSummary): string {
  const parts = [`${session.userTurnCount} ${session.userTurnCount === 1 ? "turn" : "turns"}`];
  if (session.draftCount > 0) parts.push(`${session.draftCount} ${session.draftCount === 1 ? "draft" : "drafts"}`);
  if (session.decidedCount > 0) parts.push(`${session.decidedCount} decided`);
  return parts.join(" · ");
}

function courseParts(courseLabel: string): { code: string; name: string } {
  const [code, ...nameParts] = courseLabel.split(" / ");
  return { code: code?.trim() || "Course", name: nameParts.join(" / ").trim() };
}

export function CommandConsole({
  courseId,
  courseLabel,
  courses,
  sessionId,
  sessions,
  initialMessages,
  initialDrafts = [],
  runtime = "atlas",
}: {
  courseId: string;
  courseLabel: string;
  courses: { id: string; code: string; name: string }[];
  sessionId: string;
  sessions: CommandSessionSummary[];
  initialMessages: UIMessage[];
  initialDrafts?: SessionDraft[];
  runtime?: "atlas" | "eve";
}) {
  const router = useRouter();
  const [entries, setEntries] = useState<Entry[]>(() => entriesFromHistory(initialMessages, initialDrafts));
  const [intent, setIntent] = useState("");
  const [syllabus, setSyllabus] = useState("");
  const [sessionQuery, setSessionQuery] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<(() => void) | null>(null);
  const activeRunRef = useRef(0);

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

  const activeSession = useMemo(() => sessions.find((session) => session.id === sessionId), [sessionId, sessions]);
  const course = useMemo(() => courseParts(courseLabel), [courseLabel]);

  const sessionTitle = useMemo(() => {
    const firstUser = entries.find((entry): entry is UserEntry => entry.kind === "user");
    if (!firstUser) return activeSession?.title ?? "Course command session";
    return firstUser.text.length > 54 ? `${firstUser.text.slice(0, 54)}...` : firstUser.text;
  }, [activeSession?.title, entries]);

  const turnCount = entries.filter((entry) => entry.kind === "user").length;
  const runtimeQuery = runtime === "eve" ? "&runtime=eve" : "";
  // Switching course is a clean context boundary: drop the session param so the
  // new course opens its own latest session, never the previous course's.
  const switchReturnTo = runtime === "eve" ? "/teach/atlas?runtime=eve" : "/teach/atlas";
  const lastUserIntent = useMemo(() => {
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const entry = entries[index];
      if (entry.kind === "user") return entry.text;
    }
    return "";
  }, [entries]);

  const sessionGroups = useMemo(() => {
    const adjusted = sessions.map((session) =>
      session.id === sessionId ? { ...session, title: sessionTitle, userTurnCount: turnCount } : session
    );
    const query = sessionQuery.trim().toLowerCase();
    const filtered = query ? adjusted.filter((session) => session.title.toLowerCase().includes(query)) : adjusted;
    return filtered.reduce<Array<{ label: "Today" | "Earlier"; sessions: CommandSessionSummary[] }>>((groups, session) => {
      const label = sessionGroupLabel(session.updatedAt);
      const existing = groups.find((group) => group.label === label);
      if (existing) existing.sessions.push(session);
      else groups.push({ label, sessions: [session] });
      return groups;
    }, []);
  }, [sessionId, sessionQuery, sessionTitle, sessions, turnCount]);

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

    try {
      const handle =
        runtime === "eve"
          ? await runEveAgentStream("/api/agent/eve-command", { courseId, sessionId, intent: trimmed })
          : await runAgentStream("/api/agent/command", { courseId, sessionId, intent: trimmed });
      abortRef.current = handle.abort;

      for await (const message of handle.messages) {
        if (activeRunRef.current !== runId) return;
        const next = processAssistant(message, false);
        setEntries((prev) => [...prev.slice(0, -1), next]);
      }
      if (activeRunRef.current !== runId) return;
      setEntries((prev) => {
        const last = prev[prev.length - 1];
        return last && last.kind === "assistant" ? [...prev.slice(0, -1), { ...last, done: true }] : prev;
      });
      setIntent("");
      setSyllabus("");
      router.refresh();
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

  function replayLastRun() {
    if (!lastUserIntent || running) return;
    void run(lastUserIntent);
  }

  return (
    <div className="grid h-full min-h-0 w-full grid-rows-[auto_minmax(0,1fr)] overflow-x-hidden overflow-y-auto bg-[var(--color-bg)] shadow-[var(--shadow-panel)] lg:overflow-hidden">
      <header className="flex min-h-14 shrink-0 items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4">
        <Link
          href={`/teach/atlas?session=${sessionId}${runtimeQuery}`}
          aria-label="Atlas"
          className="flex shrink-0 items-center gap-2 rounded-[6px] text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)]"
        >
          <AtlasMark size={24} />
          <span className="atlas-serif text-[18px] font-semibold leading-none">Atlas</span>
        </Link>
        <CourseSwitcher courses={courses} activeCourseId={courseId} courseLabel={courseLabel} returnTo={switchReturnTo} />
        <div className="min-w-0 flex-1" />
        <Link
          href="/teach/review"
          className="inline-flex min-h-8 items-center gap-1.5 rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 text-[12px] font-medium text-[var(--color-muted)] transition hover:border-[var(--color-border-strong)] hover:text-[var(--color-ink)]"
        >
          Review queue <span className="atlas-mono text-[11px]">{ledger.length}</span>
        </Link>
      </header>

      <div className="grid min-h-0 w-full overflow-y-auto lg:grid-cols-[230px_minmax(0,1fr)_300px] lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden 2xl:grid-cols-[264px_minmax(0,1fr)_332px]">
      <aside className="order-2 min-w-0 border-b border-[var(--color-border)] bg-[var(--color-surface-sidebar)] lg:order-none lg:min-h-0 lg:border-b-0 lg:border-r">
        <div className="border-b border-[var(--color-border)] p-3">
          <Link
            href={`/teach/atlas?new=1${runtimeQuery}`}
            aria-disabled={running}
            className={`flex min-h-10 w-full items-center justify-between gap-3 rounded-[8px] bg-[var(--color-ink)] px-3 text-left text-[13px] font-semibold text-[var(--color-bg)] transition hover:bg-[var(--color-accent-strong)] ${
              running ? "pointer-events-none opacity-60" : ""
            }`}
          >
            <span className="inline-flex items-center gap-2">
              <Plus size={14} strokeWidth={2} aria-hidden /> New session
            </span>
            <span className="atlas-mono rounded-[6px] bg-[color-mix(in_oklch,var(--color-bg)_22%,transparent)] px-1.5 py-0.5 text-[10px]">N</span>
          </Link>
          <p className="atlas-mono mt-3 text-[10px] uppercase tracking-[0.08em] text-[var(--color-faint)]">Course sessions</p>
          <label className="mt-1.5 flex h-9 items-center gap-2 rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 text-[12.5px] text-[var(--color-faint)] focus-within:border-[var(--color-border-strong)]">
            <Search size={13} strokeWidth={2} aria-hidden />
            <span className="sr-only">Search sessions</span>
            <input
              value={sessionQuery}
              onChange={(event) => setSessionQuery(event.target.value)}
              placeholder="Search sessions"
              className="min-w-0 flex-1 bg-transparent text-[12.5px] text-[var(--color-ink)] outline-none placeholder:text-[var(--color-faint)]"
            />
          </label>
        </div>
        <div className="max-h-[calc(100vh-122px)] overflow-y-auto p-2">
          {sessionGroups.length === 0 ? (
            <p className="px-3 py-8 text-center text-[12.5px] leading-5 text-[var(--color-faint)]">No matching sessions.</p>
          ) : null}
          {sessionGroups.map((group) => (
            <div key={group.label}>
              <p className="atlas-mono px-2 py-2 text-[10px] uppercase tracking-[0.08em] text-[var(--color-faint)]">
                {group.label}
              </p>
              <div className="space-y-1">
                {group.sessions.map((session) => {
                  const active = session.id === sessionId;
                  return (
                    <Link
                      key={session.id}
                      href={`/teach/atlas?session=${session.id}${runtimeQuery}`}
                      aria-current={active ? "page" : undefined}
                      className={`relative block w-full rounded-[8px] px-3 py-2.5 text-left transition hover:bg-[var(--color-surface-muted)] ${
                        active ? "bg-[var(--color-surface)] shadow-[var(--shadow-panel)]" : ""
                      }`}
                    >
                      {active ? (
                        <span className="absolute bottom-2.5 left-1 top-2.5 w-[2px] rounded-full bg-[var(--color-accent)]" aria-hidden />
                      ) : null}
                      <span className="flex items-center gap-2 pl-2">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            active && running
                              ? "animate-pulse bg-[var(--color-accent)]"
                              : session.draftCount > 0
                                ? "bg-[var(--color-good)]"
                                : "bg-[var(--color-faint)]"
                          }`}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{session.title}</span>
                      </span>
                      <span className="mt-1 flex min-w-0 items-center gap-1.5 pl-6 text-[11px] text-[var(--color-muted)]">
                        <span className="truncate">{sessionDetail(session)}</span>
                        <span aria-hidden>·</span>
                        <span className="shrink-0">{sessionWhen(session.updatedAt)}</span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </aside>

      <section className="order-1 flex min-h-[calc(100vh-56px)] min-w-0 flex-col overflow-hidden lg:order-none lg:h-full lg:min-h-0">
        <header className="flex shrink-0 items-center gap-3 border-b border-[var(--color-border)] px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-serif text-[17px] font-semibold leading-tight 2xl:text-[20px]">{sessionTitle}</h2>
            <p className="mt-1 text-[12.5px] text-[var(--color-muted)]">
              {courseLabel} · {turnCount} {turnCount === 1 ? "turn" : "turns"}
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
          <button
            type="button"
            onClick={replayLastRun}
            disabled={!lastUserIntent || running}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-[8px] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 text-[12.5px] font-semibold transition hover:border-[var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-45"
          >
            <RotateCcw size={14} strokeWidth={2} aria-hidden /> Replay
          </button>
        </header>

        <Conversation>
          <ConversationContent className="mx-auto w-full max-w-[780px]">
            {entries.length === 0 ? (
              <div className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-6 shadow-[var(--shadow-panel)]">
                <h3 className="atlas-serif text-[18px] font-medium leading-tight text-[var(--color-ink)]">
                  {course.code} - new session
                </h3>
                <p className="mt-1.5 text-[13px] leading-5 text-[var(--color-muted)]">
                  Start from the syllabus, this week, or a note. Nothing is live until you apply it.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void run("Draft a practice set for this week's material, aligned to the current module and objectives.")}
                    disabled={running}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-[8px] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 text-[13px] font-medium transition hover:border-[var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Clock size={14} strokeWidth={2} aria-hidden /> Draft this week
                  </button>
                  <button
                    type="button"
                    onClick={() => void run("Write a concise course note for students based on the current course context.")}
                    disabled={running}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-[8px] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 text-[13px] font-medium transition hover:border-[var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <PenLine size={14} strokeWidth={2} aria-hidden /> Write a note
                  </button>
                </div>
                <details className="group mt-2">
                  <summary className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-[8px] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 text-[13px] font-medium text-[var(--color-ink)] transition hover:border-[var(--color-ink)] [&::-webkit-details-marker]:hidden">
                    <Plus size={14} strokeWidth={2} aria-hidden /> Import syllabus
                  </summary>
                  <div className="mt-2 grid gap-2">
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
                <div className="mt-4 border-t border-[var(--color-border)] pt-3">
                  <p className="atlas-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-faint)]">Try</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
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
              </div>
            ) : null}

            {entries.map((entry, index) =>
              entry.kind === "user" ? (
                <Message key={index} from="user">
                  <MessageContent>
                    {entry.text.length > 700 ? entry.text.slice(0, 700) + "..." : entry.text}
                  </MessageContent>
                </Message>
              ) : (
                <Message key={index} from="assistant">
                  <MessageContent>

                  {!entry.done && entry.actions.length === 0 && entry.blocks.length === 0 && !entry.text ? (
                    <p className="flex items-center gap-2 text-[12.5px] text-[var(--color-muted)]">
                      <Loader size={14} /> Reading the course record
                    </p>
                  ) : null}

                  {entry.actions
                    .filter((action) => !TOOL_TO_BLOCK[action.toolName])
                    .map((action, i) => {
                      const meta = ACTION_META[action.toolName];
                      if (!meta) return null;
                      return (
                        <Tool key={`a-${i}`}>
                          <ToolHeader title={meta.label} state={entry.done ? "output-available" : "input-available"} />
                          {action.summary ? <ToolContent>{action.summary}</ToolContent> : null}
                        </Tool>
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

                  {entry.text ? <Response streaming={!entry.done}>{entry.text}</Response> : null}

                  {entry.done && entry.blocks.some((b) => b.block) ? (
                    <p className="text-[13px] text-[var(--color-muted)]">
                      Waiting in{" "}
                      <Link href="/teach/review" className="font-medium text-[var(--color-accent-strong)]">
                        Review
                      </Link>
                      .
                    </p>
                  ) : null}
                  </MessageContent>
                </Message>
              )
            )}
            </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        {error ? (
          <p className="mx-5 mb-3 shrink-0 rounded-[6px] border border-[color-mix(in_oklch,var(--color-danger)_38%,transparent)] bg-[color-mix(in_oklch,var(--color-danger)_10%,transparent)] px-3 py-2 text-[13px] text-[var(--color-danger)]">
            {error}
          </p>
        ) : null}

        <div className="sticky bottom-0 z-10 shrink-0 border-t border-[var(--color-border)] bg-[color-mix(in_oklch,var(--color-bg)_72%,var(--color-surface))] px-5 py-3">
          <PromptInput
            className="mx-auto max-w-[780px]"
            onSubmit={(message, event) => {
              event.preventDefault();
              if (running) {
                stopRun();
                return;
              }
              void run(message.text);
            }}
          >
            <label htmlFor="atlas-command" className="sr-only">
              Ask Atlas to draft something
            </label>
            <PromptInputTextarea
              id="atlas-command"
              value={intent}
              onChange={(event) => setIntent(event.target.value)}
              placeholder="Tell Atlas what to draft - it works from the course record and lands in Review"
              disabled={running}
            />
            <PromptInputToolbar>
              <PromptInputTools />
              <PromptInputSubmit
                status={running ? "streaming" : error ? "error" : "ready"}
                disabled={intent.trim().length < 4}
              />
            </PromptInputToolbar>
          </PromptInput>
        </div>
      </section>

      <aside className="order-3 flex min-h-0 min-w-0 flex-col border-t border-[var(--color-border)] bg-[var(--color-surface-sidebar)] lg:order-none lg:h-full lg:border-l lg:border-t-0">
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
                    <span className="atlas-mono shrink-0 rounded-[6px] bg-[color-mix(in_oklch,var(--color-accent)_11%,transparent)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.04em] text-[var(--color-accent-strong)]">
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
        </section>
      </aside>
    </div>
    </div>
  );
}

/**
 * Course scope, in the command bar. Each course is its own context: its own
 * sessions, record, and history. Switching here sets the course-scope cookie
 * and reloads Atlas in that course; nothing from the previous course carries
 * over. The native select sits invisibly over a styled pill so the control
 * looks at home in the bar while staying fully accessible.
 */
function CourseSwitcher({
  courses,
  activeCourseId,
  courseLabel,
  returnTo,
}: {
  courses: { id: string; code: string; name: string }[];
  activeCourseId: string;
  courseLabel: string;
  returnTo: string;
}) {
  const { code, name } = courseParts(courseLabel);
  const pill = (
    <>
      <span className="size-1.5 shrink-0 rounded-full bg-[var(--color-accent)]" aria-hidden />
      <span className="truncate">{code}</span>
      {name ? <span className="truncate text-[var(--color-muted)]">· {name}</span> : null}
    </>
  );

  if (!courses || courses.length <= 1) {
    return (
      <span className="hidden h-8 min-w-0 max-w-[320px] items-center gap-2 rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] font-medium md:inline-flex">
        {pill}
      </span>
    );
  }

  return (
    <form action={setCourseScope} className="relative hidden h-8 min-w-0 max-w-[320px] md:block">
      <input type="hidden" name="returnTo" value={returnTo} />
      <span className="pointer-events-none flex h-8 min-w-0 items-center gap-2 rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface)] pl-3 pr-8 text-[13px] font-medium">
        {pill}
        <ChevronDown size={13} strokeWidth={2} className="absolute right-2.5 text-[var(--color-faint)]" aria-hidden />
      </span>
      <label htmlFor="command-course" className="sr-only">
        Switch course
      </label>
      <select
        id="command-course"
        name="course"
        defaultValue={activeCourseId}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className="absolute inset-0 h-full w-full cursor-pointer rounded-[8px] opacity-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)]"
        aria-label="Switch course"
      >
        {courses.map((course) => (
          <option key={course.id} value={course.id}>
            {course.code} · {course.name}
          </option>
        ))}
      </select>
    </form>
  );
}
