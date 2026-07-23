"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useChat } from "@ai-sdk/react";
import { type UIMessage } from "ai";
import { WorkflowChatTransport } from "@ai-sdk/workflow";
import {
  CheckCircle2,
  FileCheck2,
  History,
  PanelRightClose,
  PanelRightOpen,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import { Response } from "@/components/ai-elements/response";
import {
  messageHasVisibleOutput,
  PromptCheckpointRail,
  promptAnchorId,
  promptCheckpointLabel,
  ThinkingIndicator,
} from "@/components/ai-elements/agent-status";
import {
  PromptInput,
  PromptInputButton,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import {
  VoiceTranscriptionButton,
  type VoiceTranscriptionState,
} from "@/components/ai-elements/voice-transcription-button";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput, type ToolState } from "@/components/ai-elements/tool";
import { AtlasMark, StatusBadge, TextLink } from "@/components/atlas/primitives";
import { RubricCard } from "@/components/planning/rubric-card";
import type { RubricCriterion } from "@/lib/agent/session-parts";

export type PlanningThreadRef = {
  id: string;
  title: string;
  userTurnCount: number;
  draftCount: number;
  decidedCount: number;
  updatedAt: string;
};

export type PlanningDraftRef = {
  proposalId: string;
  status: "pending" | "approved" | "rejected" | "applied";
  kind: string;
  summary: string;
  createdAt: string;
};

export type PlanningWorkRef = {
  assignmentId: string;
  name: string;
};

export type PlanningRoomProps = {
  threadId: string;
  threadTitle: string;
  course: { id: string; code: string; name: string; term: string | null };
  initialMessages: UIMessage[];
  activeRunId: string | null;
  threads: PlanningThreadRef[];
  drafts: PlanningDraftRef[];
  work: PlanningWorkRef[];
  pendingProposals: number;
  /** Optional composer seed from a direct course workflow. Never auto-submitted. */
  initialInput?: string;
};

const STATUS_TONE = { pending: "accent", approved: "good", rejected: "neutral", applied: "good" } as const;
const STATUS_LABEL = { pending: "Ready", approved: "Approved", rejected: "Dismissed", applied: "Applied" } as const;

type LoosePart = { type?: unknown; state?: unknown; input?: unknown; output?: unknown; data?: unknown; text?: unknown } & Record<string, unknown>;

type RunContext = {
  sessionId: string;
  builtAt: string;
  tokenEstimate: number;
  tools: number;
  skills: string[];
};

type RubricDraftOutput = {
  ok: true;
  proposalId: string;
  assignmentId: string;
  assignmentName: string;
  title: string;
  note: string | null;
  criteria: RubricCriterion[];
  replacesVersion: number;
  replacesCriteria: RubricCriterion[];
};

type CourseDraftOutput = {
  ok: true;
  proposalId: string;
  summary: string;
  records: Array<{ type: string; title: string }>;
};

type AiAssignmentDraftOutput = {
  ok: true;
  proposalId: string;
  assignmentId: string;
  assignmentName: string;
  instructions: string;
  durationMinutes: number;
  personalRecordSideNotes: boolean;
  criteria: RubricCriterion[];
  usedStandardFrame: boolean;
  note: string | null;
};

function outputObject(part: LoosePart): Record<string, unknown> | null {
  return part.output && typeof part.output === "object" ? (part.output as Record<string, unknown>) : null;
}

function aiAssignmentOutputFrom(part: LoosePart): AiAssignmentDraftOutput | { ok: false; error: string } | null {
  const output = outputObject(part);
  if (!output) return null;
  if (output.ok === false && typeof output.error === "string") return { ok: false, error: output.error };
  if (output.ok === true && Array.isArray(output.criteria) && typeof output.proposalId === "string") {
    return output as unknown as AiAssignmentDraftOutput;
  }
  return null;
}

function rubricOutputFrom(part: LoosePart): RubricDraftOutput | { ok: false; error: string } | null {
  const output = outputObject(part);
  if (!output) return null;
  if (output.ok === false && typeof output.error === "string") return { ok: false, error: output.error };
  if (output.ok === true && Array.isArray(output.criteria) && typeof output.proposalId === "string") {
    return output as unknown as RubricDraftOutput;
  }
  return null;
}

function courseDraftOutputFrom(part: LoosePart): CourseDraftOutput | { ok: false; error: string } | null {
  const output = outputObject(part);
  if (!output) return null;
  if (output.ok === false && typeof output.error === "string") return { ok: false, error: output.error };
  if (output.ok === true && Array.isArray(output.records) && typeof output.proposalId === "string") {
    return output as unknown as CourseDraftOutput;
  }
  return null;
}

function threadIdFromMessages(messages: UIMessage[]): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    for (const part of messages[index].parts as LoosePart[]) {
      if (part.type !== "data-planning-ref") continue;
      const data = part.data as { sessionId?: string } | undefined;
      if (data?.sessionId) return data.sessionId;
    }
  }
  return null;
}

function toolState(part: LoosePart): ToolState {
  const output = outputObject(part);
  if (output?.ok === false) return "output-error";
  if (output || part.state === "output-available") return "output-available";
  if (part.state === "input-available") return "input-available";
  return "input-streaming";
}

const TOOL_TITLES: Record<string, string> = {
  "tool-inspect_lms": "Checking the course",
  "tool-read_gradebook": "Checking the gradebook",
  "tool-search_course": "Searching the course",
  "tool-mutate_lms": "Updating the LMS",
  "tool-load_skill": "Loading",
  "tool-draft_ai_assignment": "Preparing the AI assignment",
  "tool-draft_rubric": "Preparing the rubric",
  "tool-draft_course": "Preparing course work",
};

function toolLabel(part: LoosePart): string {
  const type = String(part.type ?? "");
  const input = (part.input ?? {}) as Record<string, unknown>;
  if (type === "tool-inspect_lms" && typeof input.resource === "string") return `Checking ${input.resource.replaceAll("_", " ")}`;
  if (type === "tool-read_gradebook") {
    if (typeof input.studentQuery === "string") return `Checking ${input.studentQuery}'s grades`;
    if (typeof input.assignmentId === "string") return "Checking assignment grades";
    return "Checking the gradebook";
  }
  if (type === "tool-search_course" && typeof input.query === "string") return `Searching for “${input.query}”`;
  if (type === "tool-mutate_lms" && typeof input.action === "string") return input.action.replaceAll("_", " ");
  return TOOL_TITLES[type] ?? type.replace(/^tool-/, "").replaceAll("_", " ");
}

function errorText(part: LoosePart): string | undefined {
  const output = outputObject(part);
  return output?.ok === false && typeof output.error === "string" ? output.error : undefined;
}

function actionSummary(part: LoosePart): string | null {
  const output = outputObject(part);
  return output?.ok === true && typeof output.summary === "string" ? output.summary : null;
}

function isActionResult(part: LoosePart): boolean {
  const output = outputObject(part);
  return output?.ok === true && typeof output.action === "string" && typeof output.summary === "string";
}

export function PlanningRoom(props: PlanningRoomProps) {
  const initialThreadId = props.threadId;
  const [railOpen, setRailOpen] = useState(false);
  const [railView, setRailView] = useState<"threads" | "drafts">("threads");
  const [voiceState, setVoiceState] = useState<VoiceTranscriptionState>("idle");
  const [voiceError, setVoiceError] = useState<string | null>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setRailOpen(window.localStorage.getItem("atlas-harness-rail") === "open");
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  function updateRail(open: boolean) {
    setRailOpen(open);
    window.localStorage.setItem("atlas-harness-rail", open ? "open" : "closed");
  }

  const runStorageKey = `atlas-active-run:planning:${props.threadId}`;
  const [steerQueue, setSteerQueue] = useState<string[]>([]);
  const steerQueueRef = useRef<string[]>([]);
  const transport = useMemo(() => new WorkflowChatTransport<UIMessage>({
    api: "/api/atlas/planning",
    prepareSendMessagesRequest: ({ messages: outgoing }) => ({
      body: {
        sessionId: threadIdFromMessages(outgoing) ?? initialThreadId,
        message: outgoing[outgoing.length - 1],
      },
    }),
    onChatSendMessage: (response) => {
      const runId = response.headers.get("x-workflow-run-id");
      if (!runId) return;
      window.localStorage.setItem(runStorageKey, runId);
    },
    onChatEnd: () => {
      window.localStorage.removeItem(runStorageKey);
    },
    prepareReconnectToStreamRequest: ({ ...rest }) => {
      const runId = window.localStorage.getItem(runStorageKey);
      if (!runId) throw new Error("No active Atlas run to resume.");
      return { ...rest, api: `/api/agent-runs/${encodeURIComponent(runId)}/stream` };
    },
  }), [initialThreadId, runStorageKey]);

  useEffect(() => {
    if (props.activeRunId) window.localStorage.setItem(runStorageKey, props.activeRunId);
    else window.localStorage.removeItem(runStorageKey);
  }, [props.activeRunId, runStorageKey]);

  const { messages, sendMessage, status, error } = useChat({
    id: `planning-${props.threadId}`,
    messages: props.initialMessages,
    resume: Boolean(props.activeRunId),
    transport,
    onError: (chatError) => console.error("Atlas planning stream failed", chatError),
    onFinish: ({ isAbort, isDisconnect }) => {
      if (isAbort || isDisconnect) return;
      const [next, ...rest] = steerQueueRef.current;
      if (!next) return;
      steerQueueRef.current = rest;
      setSteerQueue(rest);
      window.setTimeout(() => sendMessage({ text: next }), 0);
    },
  });

  const sendPlanningMessage = (text: string) => sendMessage({ text });

  const promptCheckpoints = useMemo(
    () => messages
      .filter((message) => message.role === "user")
      .map((message, index) => ({ id: message.id, label: promptCheckpointLabel(message, index) })),
    [messages]
  );

  const learnedThreadId = useMemo(() => threadIdFromMessages(messages), [messages]);
  const visibleThreads = useMemo(() => {
    if (!learnedThreadId || props.threads.some((thread) => thread.id === learnedThreadId)) return props.threads;
    const firstUserMessage = messages.find((message) => message.role === "user");
    const firstText = (firstUserMessage?.parts as LoosePart[] | undefined)?.find(
      (part) => part.type === "text" && typeof part.text === "string"
    )?.text;
    const compact = typeof firstText === "string" ? firstText.replace(/\s+/g, " ").trim() : "New thread";
    const title = compact.length > 64 ? `${compact.slice(0, 61)}...` : compact || "New thread";
    const contextPart = messages.flatMap((message) => message.parts as LoosePart[]).find((part) => part.type === "data-run-context");
    const context = contextPart?.data as RunContext | undefined;
    return [{ id: learnedThreadId, title, userTurnCount: 1, draftCount: 0, decidedCount: 0, updatedAt: context?.builtAt ?? new Date(0).toISOString() }, ...props.threads];
  }, [learnedThreadId, messages, props.threads]);

  const visibleDrafts = useMemo(() => {
    const byId = new Map(props.drafts.map((draft) => [draft.proposalId, draft]));
    for (const message of messages.slice(-20)) {
      const parts = message.parts as LoosePart[];
      const context = parts.find((part) => part.type === "data-run-context")?.data as RunContext | undefined;
      for (const part of parts) {
        const type = String(part.type ?? "");
        if (type === "tool-draft_ai_assignment") {
          const output = aiAssignmentOutputFrom(part);
          if (output?.ok && !byId.has(output.proposalId)) {
            byId.set(output.proposalId, { proposalId: output.proposalId, status: "pending", kind: "assignment", summary: `AI assignment: ${output.assignmentName}`, createdAt: context?.builtAt ?? new Date(0).toISOString() });
          }
        } else if (type === "tool-draft_rubric") {
          const output = rubricOutputFrom(part);
          if (output?.ok && !byId.has(output.proposalId)) {
            byId.set(output.proposalId, { proposalId: output.proposalId, status: "pending", kind: "rubric", summary: `Rubric: ${output.assignmentName} · ${output.title}`, createdAt: context?.builtAt ?? new Date(0).toISOString() });
          }
        } else if (type === "tool-draft_course") {
          const output = courseDraftOutputFrom(part);
          if (output?.ok && !byId.has(output.proposalId)) {
            byId.set(output.proposalId, { proposalId: output.proposalId, status: "pending", kind: "course", summary: output.summary, createdAt: context?.builtAt ?? new Date(0).toISOString() });
          }
        }
      }
    }
    return [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [messages, props.drafts]);

  useEffect(() => {
    if (!learnedThreadId || props.threadId !== "new") return;
    window.history.replaceState(null, "", `/teach/atlas?thread=${learnedThreadId}`);
  }, [learnedThreadId, props.threadId]);

  const statusByProposal = useMemo(() => {
    const map = new Map<string, PlanningDraftRef["status"]>();
    for (const draft of props.drafts) map.set(draft.proposalId, draft.status);
    return map;
  }, [props.drafts]);

  const activeThreadTitle = visibleThreads.find((thread) => thread.id === (learnedThreadId ?? props.threadId))?.title ?? props.threadTitle;
  const storedDraftIds = new Set(props.drafts.map((draft) => draft.proposalId));
  const pendingReviewCount = props.pendingProposals + visibleDrafts.filter((draft) => draft.status === "pending" && !storedDraftIds.has(draft.proposalId)).length;
  const busy = status === "submitted" || status === "streaming";
  const lastMessage = messages[messages.length - 1];
  const awaitingReply = busy && !messageHasVisibleOutput(lastMessage);
  const firstWork = props.work[0] ?? null;

  return (
    <div className="atlas-harness-root flex h-full min-h-0 w-full bg-[var(--color-bg)]">
      <style jsx global>{`
        html:has(.atlas-harness-root),
        html:has(.atlas-harness-root) body,
        html:has(.atlas-harness-root) .atlas-app-bg {
          height: 100dvh;
          overflow: hidden;
        }
        html:has(.atlas-harness-root) .atlas-app-bg > main,
        html:has(.atlas-harness-root) .atlas-app-bg > main > div,
        html:has(.atlas-harness-root) .atlas-app-bg > main > div > div {
          height: 100dvh;
          min-height: 0;
        }
        html:has(.atlas-harness-root) .atlas-app-bg > main > div {
          max-width: none;
          padding: 0;
        }
      `}</style>

      <section aria-label="Atlas conversation" className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 md:px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <AtlasMark size={22} />
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <h1 className="text-[0.875rem] font-semibold text-[var(--color-ink)]">Atlas</h1>
                <span className="hidden truncate text-[0.71875rem] text-[var(--color-faint)] sm:block">{props.course.code}</span>
              </div>
              <p className="truncate text-[0.6875rem] text-[var(--color-muted)]">{activeThreadTitle}</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {pendingReviewCount > 0 ? (
              <Link href="/teach/review" className="mr-1 hidden rounded-control px-2 py-1 text-[0.75rem] font-medium text-[var(--color-muted)] transition hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)] sm:inline-flex">
                Review {pendingReviewCount}
              </Link>
            ) : null}
            <Link href="/teach/atlas?thread=new" aria-label="New thread" title="New thread" className="inline-flex size-8 items-center justify-center rounded-control text-[var(--color-muted)] transition hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)]">
              <Plus size={16} aria-hidden />
            </Link>
            <button type="button" onClick={() => updateRail(!railOpen)} aria-label={railOpen ? "Close Atlas sidebar" : "Open Atlas sidebar"} aria-expanded={railOpen} title={railOpen ? "Close sidebar" : "Threads and drafts"} className="inline-flex size-8 items-center justify-center rounded-control text-[var(--color-muted)] transition hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)]">
              {railOpen ? <PanelRightClose size={16} aria-hidden /> : <PanelRightOpen size={16} aria-hidden />}
            </button>
          </div>
        </header>

        <div className="relative min-h-0 flex-1">
          <Conversation className="h-full bg-[var(--color-bg)]">
            <ConversationContent className="mx-auto w-full max-w-[50rem] flex-1 gap-7 px-4 pb-10 pt-8 md:px-8">
              {messages.length === 0 ? (
                <ConversationEmptyState className="min-h-[26rem] items-start justify-center px-0 text-left">
                  <div className="w-full max-w-[40rem] space-y-6">
                    <div className="space-y-2">
                      <p className="text-[0.75rem] font-medium text-[var(--color-accent-strong)]">{props.course.code}</p>
                      <h2 className="atlas-serif text-[1.75rem] font-semibold leading-tight text-[var(--color-ink)]">What should Atlas do?</h2>
                      <p className="max-w-[36rem] text-[0.875rem] leading-6 text-[var(--color-muted)]">
                        Ask about any assignment, student, grade, submission, session, or part of the course, or ask Atlas to change the LMS.
                      </p>
                    </div>
                    <Suggestions className="justify-start">
                      <Suggestion suggestion="What is the grade distribution for this class?" onClick={(text) => sendMessage({ text })} />
                      <Suggestion suggestion="How is Maya Patel doing?" onClick={(text) => sendMessage({ text })} />
                      {firstWork ? <Suggestion suggestion={`Revise the rubric for ${firstWork.name}.`} onClick={(text) => sendMessage({ text })} /> : null}
                    </Suggestions>
                  </div>
                </ConversationEmptyState>
              ) : (
                messages.map((message, index) => (
                  <Message
                    key={message.id}
                    id={message.role === "user" ? promptAnchorId(message.id) : undefined}
                    className={message.role === "user" ? "scroll-mt-24" : undefined}
                    from={message.role === "user" ? "user" : "assistant"}
                  >
                    <MessageContent>
                      <PlanningMessageParts message={message} streaming={busy && index === messages.length - 1 && message.role === "assistant"} statusByProposal={statusByProposal} />
                    </MessageContent>
                  </Message>
                ))
              )}
              {awaitingReply ? <ThinkingIndicator label="Thinking" /> : null}
            </ConversationContent>
          </Conversation>
          {promptCheckpoints.length > 0 ? <PromptCheckpointRail checkpoints={promptCheckpoints} /> : null}
        </div>

        <div className="shrink-0 bg-gradient-to-t from-[var(--color-bg)] via-[var(--color-bg)] to-transparent px-3 pb-3 pt-2 md:px-6 md:pb-5">
          <div className="mx-auto w-full max-w-[50rem]">
            {error ? <p className="mb-2 text-[0.78125rem] leading-5 text-[var(--color-danger)]">{error.message || "Atlas could not finish that turn. Your message is saved."}</p> : null}
            {voiceError ? <p role="alert" className="mb-2 text-[0.78125rem] leading-5 text-[var(--color-danger)]">{voiceError}</p> : null}
            {steerQueue.length > 0 ? <p className="mb-2 text-[0.71875rem] text-[var(--color-muted)]" role="status">Steer queued · {steerQueue[0]}</p> : null}
            <PromptInput className="min-h-[3.25rem] flex-row items-end overflow-hidden shadow-[var(--shadow-floating)]" onSubmit={(message, event) => {
              const text = message.text.trim();
              if (!text) return;
              if (busy) {
                const nextQueue = [...steerQueueRef.current, text];
                steerQueueRef.current = nextQueue;
                setSteerQueue(nextQueue);
              } else {
                sendPlanningMessage(text);
              }
              const form = event.currentTarget;
              form.reset();
              const field = form.querySelector("textarea");
              if (field) field.style.height = "auto";
            }}>
              <PromptInputButton
                disabled
                aria-label="Attachments coming soon"
                title="Attachments coming soon"
                className="mb-1.5 ml-1.5 size-9 shrink-0 justify-center rounded-full px-0 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus size={16} aria-hidden />
              </PromptInputButton>
              <PromptInputTextarea defaultValue={props.initialInput} className="min-h-[3.125rem] w-auto min-w-0 flex-1 px-1.5 py-[0.8125rem]" placeholder={busy ? "Steer Atlas..." : "Ask Atlas..."} autoFocus />
              <PromptInputToolbar className="shrink-0 justify-end gap-0.5 px-1.5 py-1.5">
                <PromptInputTools>
                  <VoiceTranscriptionButton onError={setVoiceError} onStateChange={setVoiceState} />
                </PromptInputTools>
                <PromptInputSubmit disabled={voiceState !== "idle"} status={status} allowSubmitWhileBusy className="rounded-full" />
              </PromptInputToolbar>
            </PromptInput>
          </div>
        </div>
      </section>

      {railOpen ? <button type="button" aria-label="Close Atlas sidebar" className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => updateRail(false)} /> : null}
      <aside aria-hidden={!railOpen} inert={!railOpen} className={cn("fixed inset-y-0 right-0 z-40 flex w-[min(22rem,92vw)] flex-col overflow-hidden border-l bg-[var(--color-surface)] shadow-[var(--shadow-floating)] transition-[transform,opacity,width,border-color] duration-[220ms] ease-out lg:static lg:z-auto lg:translate-x-0 lg:shadow-none", railOpen ? "translate-x-0 border-[var(--color-border)] opacity-100 lg:w-[21rem]" : "pointer-events-none translate-x-full border-transparent opacity-0 lg:w-0 lg:translate-x-0")}>
        <div className="flex h-14 w-[min(21rem,92vw)] shrink-0 items-center justify-between border-b border-[var(--color-border)] px-3">
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setRailView("threads")} className={cn("rounded-control px-2.5 py-1.5 text-[0.75rem] font-medium transition", railView === "threads" ? "bg-[var(--color-surface-muted)] text-[var(--color-ink)]" : "text-[var(--color-muted)] hover:text-[var(--color-ink)]")}>Threads</button>
            <button type="button" onClick={() => setRailView("drafts")} className={cn("rounded-control px-2.5 py-1.5 text-[0.75rem] font-medium transition", railView === "drafts" ? "bg-[var(--color-surface-muted)] text-[var(--color-ink)]" : "text-[var(--color-muted)] hover:text-[var(--color-ink)]")}>Drafts{visibleDrafts.length > 0 ? ` ${visibleDrafts.length}` : ""}</button>
          </div>
          <button type="button" onClick={() => updateRail(false)} aria-label="Close Atlas sidebar" className="inline-flex size-8 items-center justify-center rounded-control text-[var(--color-muted)] transition hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]"><PanelRightClose size={15} aria-hidden /></button>
        </div>
        <div className="min-h-0 w-[min(21rem,92vw)] flex-1 overflow-y-auto px-3 py-3">
          {railView === "threads" ? <ThreadsPanel threads={visibleThreads} activeId={learnedThreadId ?? props.threadId} /> : <ThreadDraftsPanel drafts={visibleDrafts} pendingProposals={pendingReviewCount} />}
        </div>
      </aside>
    </div>
  );
}

function PlanningMessageParts({ message, streaming, statusByProposal }: { message: UIMessage; streaming: boolean; statusByProposal: Map<string, PlanningDraftRef["status"]> }) {
  const parts = (message.parts ?? []) as LoosePart[];
  const rendered: ReactNode[] = [];
  const toolParts = parts.filter((part) => String(part.type ?? "").startsWith("tool-"));

  parts.forEach((part, index) => {
    const type = String(part.type ?? "");
    if (type.startsWith("data-")) return;

    if (type === "text" && typeof part.text === "string") {
      rendered.push(<Response key={index} streaming={streaming && index === parts.length - 1}>{part.text}</Response>);
      return;
    }

    if (!type.startsWith("tool-")) return;
    const state = toolState(part);
    if (state === "output-error") {
      rendered.push(<ToolError key={`error-${index}`} part={part} />);
      return;
    }

    if (isActionResult(part) && state === "output-available") {
      const summary = actionSummary(part);
      if (summary) rendered.push(<ActionReceipt key={`action-${index}`} summary={summary} />);
      return;
    }

    if (type === "tool-draft_ai_assignment") {
      const output = aiAssignmentOutputFrom(part);
      if (output?.ok) rendered.push(<AiAssignmentDraftCard key={`draft-${index}`} draft={output} status={statusByProposal.get(output.proposalId) ?? "pending"} />);
      return;
    }

    if (type === "tool-draft_rubric") {
      const output = rubricOutputFrom(part);
      if (output?.ok) rendered.push(<RubricDraftCard key={`draft-${index}`} draft={output} status={statusByProposal.get(output.proposalId) ?? "pending"} />);
      return;
    }

    if (type === "tool-draft_course") {
      const output = courseDraftOutputFrom(part);
      if (output?.ok) rendered.push(<CourseDraftCard key={`draft-${index}`} draft={output} status={statusByProposal.get(output.proposalId) ?? "pending"} />);
    }
  });

  if (streaming) {
    const activeTool = [...toolParts].reverse().find((part) => toolState(part) === "input-streaming" || toolState(part) === "input-available");
    if (activeTool) rendered.push(<ThinkingIndicator key="working" label={toolLabel(activeTool)} />);
  }

  return <>{rendered}</>;
}

function ActionReceipt({ summary }: { summary: string }) {
  return (
    <div className="flex max-w-[42rem] items-start gap-2 border-l-2 border-[var(--color-good)] py-1 pl-3 text-[0.78125rem] leading-5 text-[var(--color-muted)]">
      <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-[var(--color-good)]" aria-hidden />
      <span>{summary}</span>
    </div>
  );
}

function ToolError({ part }: { part: LoosePart }) {
  return (
    <Tool defaultOpen className="max-w-[42rem] border-[color-mix(in_oklch,var(--color-danger)_35%,var(--color-border))]">
      <ToolHeader type={String(part.type ?? "tool")} state="output-error" title={toolLabel(part)} />
      <ToolContent>
        <ToolInput input={part.input ?? {}} />
        <ToolOutput errorText={errorText(part)} />
      </ToolContent>
    </Tool>
  );
}

function DraftFrame({ eyebrow, status, children }: { eyebrow: string; status: PlanningDraftRef["status"]; children: ReactNode }) {
  return (
    <section className="my-1 w-full max-w-[42rem]">
      <div className="flex items-center justify-between gap-3 pb-1.5">
        <p className="atlas-mono flex items-center gap-1.5 text-[0.6875rem] uppercase tracking-[0.08em] text-[var(--color-faint)]"><FileCheck2 size={11} aria-hidden />{eyebrow}</p>
        <div className="flex items-center gap-2">
          <StatusBadge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</StatusBadge>
          {status === "pending" ? <TextLink href="/teach/review" className="text-[0.71875rem]">Review</TextLink> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function RubricDraftCard({ draft, status }: { draft: RubricDraftOutput; status: PlanningDraftRef["status"] }) {
  return <DraftFrame eyebrow={`Rubric · ${draft.assignmentName}`} status={status}><RubricCard title={draft.title} criteria={draft.criteria} compare={{ version: draft.replacesVersion, criteria: draft.replacesCriteria }} />{draft.note ? <p className="mt-1.5 text-[0.75rem] leading-5 text-[var(--color-muted)]">{draft.note}</p> : null}</DraftFrame>;
}

function AiAssignmentDraftCard({ draft, status }: { draft: AiAssignmentDraftOutput; status: PlanningDraftRef["status"] }) {
  return (
    <DraftFrame eyebrow={`AI assignment · ${draft.assignmentName}`} status={status}>
      <div className="overflow-hidden rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="bg-[var(--color-surface-muted)] px-3.5 py-2.5">
          <p className="text-[0.8125rem] leading-5 text-[var(--color-ink)]">{draft.instructions}</p>
          <p className="atlas-mono mt-1.5 text-[0.65625rem] uppercase tracking-[0.07em] text-[var(--color-faint)]">{draft.durationMinutes} min</p>
        </div>
        <RubricCard title={draft.usedStandardFrame ? "Rubric · standard frame" : "Rubric"} criteria={draft.criteria} className="rounded-none border-0" />
      </div>
      {draft.note ? <p className="mt-1.5 text-[0.75rem] leading-5 text-[var(--color-muted)]">{draft.note}</p> : null}
    </DraftFrame>
  );
}

function CourseDraftCard({ draft, status }: { draft: CourseDraftOutput; status: PlanningDraftRef["status"] }) {
  return (
    <DraftFrame eyebrow="Course draft" status={status}>
      <div className="overflow-hidden rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)]">
        <p className="bg-[var(--color-surface-muted)] px-3.5 py-2.5 text-[0.8125rem] font-medium text-[var(--color-ink)]">{draft.summary}</p>
        <ul className="space-y-1">
          {draft.records.map((record, index) => <li key={index} className="flex items-baseline justify-between gap-3 px-3.5 py-2 text-[0.78125rem]"><span className="min-w-0 text-[var(--color-ink)]">{record.title}</span><span className="atlas-mono shrink-0 text-[0.65625rem] uppercase tracking-[0.07em] text-[var(--color-faint)]">{record.type.replaceAll("_", " ")}</span></li>)}
        </ul>
      </div>
    </DraftFrame>
  );
}

function ThreadDraftsPanel({ drafts, pendingProposals }: { drafts: PlanningDraftRef[]; pendingProposals: number }) {
  if (drafts.length === 0) return <div className="px-2 py-8 text-center"><FileCheck2 size={18} className="mx-auto text-[var(--color-faint)]" aria-hidden /><p className="mt-2 text-[0.75rem] text-[var(--color-muted)]">No drafts in this thread.</p></div>;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between px-2"><p className="text-[0.6875rem] text-[var(--color-faint)]">This thread</p>{pendingProposals > 0 ? <TextLink href="/teach/review" className="text-[0.6875rem]">Open Review</TextLink> : null}</div>
      <ul className="space-y-1">
        {drafts.map((draft) => <li key={draft.proposalId} className="flex items-start justify-between gap-3 px-2 py-3"><div className="min-w-0"><p className="text-[0.78125rem] leading-5 text-[var(--color-ink)]">{draft.summary}</p><p className="mt-0.5 text-[0.65625rem] text-[var(--color-faint)]">{new Date(draft.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p></div><StatusBadge tone={STATUS_TONE[draft.status]}>{STATUS_LABEL[draft.status]}</StatusBadge></li>)}
      </ul>
    </div>
  );
}

function ThreadsPanel({ threads, activeId }: { threads: PlanningThreadRef[]; activeId: string }) {
  if (threads.length === 0) return <div className="px-2 py-8 text-center"><History size={18} className="mx-auto text-[var(--color-faint)]" aria-hidden /><p className="mt-2 text-[0.75rem] text-[var(--color-muted)]">No threads.</p></div>;
  return (
    <ul className="space-y-0.5">
      {threads.map((thread) => {
        const active = thread.id === activeId;
        return <li key={thread.id}><Link href={`/teach/atlas?thread=${thread.id}`} aria-current={active ? "page" : undefined} className={cn("block rounded-row px-2.5 py-2.5 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-accent-strong)]", active ? "bg-[var(--color-surface-muted)]" : "hover:bg-[var(--color-surface-muted)]")}><span className={cn("block truncate text-[0.78125rem]", active ? "font-medium text-[var(--color-ink)]" : "text-[var(--color-muted)]")}>{thread.title}</span><span className="mt-1 flex items-center gap-1.5 text-[0.65625rem] text-[var(--color-faint)]"><span>{new Date(thread.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>{thread.draftCount > 0 ? <span>· {thread.draftCount} draft{thread.draftCount === 1 ? "" : "s"}</span> : null}</span></Link></li>;
      })}
    </ul>
  );
}
