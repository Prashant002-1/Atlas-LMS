"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useChat } from "@ai-sdk/react";
import { type UIMessage } from "ai";
import { WorkflowChatTransport } from "@ai-sdk/workflow";
import { CheckCircle2, History, PanelRightClose, PanelRightOpen, Plus } from "lucide-react";
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
import { AtlasMark } from "@/components/atlas/primitives";

export type StudentThreadRef = {
  id: string;
  title: string;
  userTurnCount: number;
  updatedAt: string;
};

export type StudentAtlasRoomProps = {
  threadId: string;
  threadTitle: string;
  studentName: string;
  initialMessages: UIMessage[];
  activeRunId: string | null;
  threads: StudentThreadRef[];
  firstCourse: { id: string; code: string } | null;
};

type LoosePart = { type?: unknown; state?: unknown; input?: unknown; output?: unknown; data?: unknown; text?: unknown } & Record<string, unknown>;

function outputObject(part: LoosePart): Record<string, unknown> | null {
  return part.output && typeof part.output === "object" ? (part.output as Record<string, unknown>) : null;
}

function threadIdFromMessages(messages: UIMessage[]): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    for (const part of messages[index].parts as LoosePart[]) {
      if (part.type !== "data-atlas-ref") continue;
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
  "tool-inspect_record": "Checking your record",
  "tool-search_course": "Searching the course",
  "tool-read_page": "Reading the material",
  "tool-remember": "Noting",
};

function toolLabel(part: LoosePart): string {
  const type = String(part.type ?? "");
  const input = (part.input ?? {}) as Record<string, unknown>;
  if (type === "tool-inspect_record" && typeof input.resource === "string") {
    return `Checking your ${input.resource.replaceAll("_", " ")}`;
  }
  if (type === "tool-search_course" && typeof input.query === "string") return `Searching for “${input.query}”`;
  return TOOL_TITLES[type] ?? type.replace(/^tool-/, "").replaceAll("_", " ");
}

function errorText(part: LoosePart): string | undefined {
  const output = outputObject(part);
  return output?.ok === false && typeof output.error === "string" ? output.error : undefined;
}

function isActionResult(part: LoosePart): boolean {
  const output = outputObject(part);
  return output?.ok === true && typeof output.action === "string" && typeof output.summary === "string";
}

function actionSummary(part: LoosePart): string | null {
  const output = outputObject(part);
  return output?.ok === true && typeof output.summary === "string" ? output.summary : null;
}

export function StudentAtlasRoom(props: StudentAtlasRoomProps) {
  const initialThreadId = props.threadId;
  const [railOpen, setRailOpen] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceTranscriptionState>("idle");
  const [voiceError, setVoiceError] = useState<string | null>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setRailOpen(window.localStorage.getItem("atlas-student-rail") === "open");
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  function updateRail(open: boolean) {
    setRailOpen(open);
    window.localStorage.setItem("atlas-student-rail", open ? "open" : "closed");
  }

  const runStorageKey = `atlas-active-run:student:${props.threadId}`;
  const [steerQueue, setSteerQueue] = useState<string[]>([]);
  const steerQueueRef = useRef<string[]>([]);
  const transport = useMemo(() => new WorkflowChatTransport<UIMessage>({
    api: "/api/atlas/student",
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
    id: `student-atlas-${props.threadId}`,
    messages: props.initialMessages,
    resume: Boolean(props.activeRunId),
    transport,
    onError: (chatError) => console.error("student Atlas stream failed", chatError),
    onFinish: ({ isAbort, isDisconnect }) => {
      if (isAbort || isDisconnect) return;
      const [next, ...rest] = steerQueueRef.current;
      if (!next) return;
      steerQueueRef.current = rest;
      setSteerQueue(rest);
      window.setTimeout(() => sendMessage({ text: next }), 0);
    },
  });

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
    return [
      { id: learnedThreadId, title, userTurnCount: 1, updatedAt: new Date().toISOString() },
      ...props.threads,
    ];
  }, [learnedThreadId, messages, props.threads]);

  useEffect(() => {
    if (!learnedThreadId || props.threadId !== "new") return;
    window.history.replaceState(null, "", `/student/atlas?thread=${learnedThreadId}`);
  }, [learnedThreadId, props.threadId]);

  const activeThreadTitle =
    visibleThreads.find((thread) => thread.id === (learnedThreadId ?? props.threadId))?.title ?? props.threadTitle;
  const busy = status === "submitted" || status === "streaming";
  const lastMessage = messages[messages.length - 1];
  const awaitingReply = busy && !messageHasVisibleOutput(lastMessage);
  const firstName = props.studentName.split(/\s+/)[0] || "there";

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
              <h1 className="text-[0.875rem] font-semibold text-[var(--color-ink)]">Atlas</h1>
              <p className="truncate text-[0.6875rem] text-[var(--color-muted)]">{activeThreadTitle}</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <Link href="/student/atlas?thread=new" aria-label="New thread" title="New thread" className="inline-flex size-8 items-center justify-center rounded-control text-[var(--color-muted)] transition hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)]">
              <Plus size={16} aria-hidden />
            </Link>
            <button type="button" onClick={() => updateRail(!railOpen)} aria-label={railOpen ? "Close threads" : "Open threads"} aria-expanded={railOpen} title={railOpen ? "Close threads" : "Threads"} className="inline-flex size-8 items-center justify-center rounded-control text-[var(--color-muted)] transition hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)]">
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
                      <h2 className="atlas-serif text-[1.75rem] font-semibold leading-tight text-[var(--color-ink)]">
                        What are you working on, {firstName}?
                      </h2>
                      <p className="max-w-[36rem] text-[0.875rem] leading-6 text-[var(--color-muted)]">
                        Atlas knows your courses, your work, and your record. Ask it to explain material, plan your studying, or read your results with you.
                      </p>
                    </div>
                    <Suggestions className="justify-start">
                      <Suggestion suggestion="What is due this week?" onClick={(text) => sendMessage({ text })} />
                      {props.firstCourse ? (
                        <Suggestion suggestion={`Where am I losing points in ${props.firstCourse.code}?`} onClick={(text) => sendMessage({ text })} />
                      ) : null}
                      <Suggestion suggestion="Plan my studying for the next two weeks." onClick={(text) => sendMessage({ text })} />
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
                      <StudentMessageParts message={message} streaming={busy && index === messages.length - 1 && message.role === "assistant"} />
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
                sendMessage({ text });
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
              <PromptInputTextarea className="min-h-[3.125rem] w-auto min-w-0 flex-1 px-1.5 py-[0.8125rem]" placeholder={busy ? "Steer Atlas..." : "Ask Atlas..."} autoFocus />
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

      {railOpen ? <button type="button" aria-label="Close threads" className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => updateRail(false)} /> : null}
      <aside aria-hidden={!railOpen} inert={!railOpen} className={cn("fixed inset-y-0 right-0 z-40 flex w-[min(22rem,92vw)] flex-col overflow-hidden border-l bg-[var(--color-surface)] shadow-[var(--shadow-floating)] transition-[transform,opacity,width,border-color] duration-[220ms] ease-out lg:static lg:z-auto lg:translate-x-0 lg:shadow-none", railOpen ? "translate-x-0 border-[var(--color-border)] opacity-100 lg:w-[21rem]" : "pointer-events-none translate-x-full border-transparent opacity-0 lg:w-0 lg:translate-x-0")}>
        <div className="flex h-14 w-[min(21rem,92vw)] shrink-0 items-center justify-between border-b border-[var(--color-border)] px-3">
          <p className="px-2 text-[0.75rem] font-medium text-[var(--color-ink)]">Threads</p>
          <button type="button" onClick={() => updateRail(false)} aria-label="Close threads" className="inline-flex size-8 items-center justify-center rounded-control text-[var(--color-muted)] transition hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]"><PanelRightClose size={15} aria-hidden /></button>
        </div>
        <div className="min-h-0 w-[min(21rem,92vw)] flex-1 overflow-y-auto px-3 py-3">
          <ThreadsPanel threads={visibleThreads} activeId={learnedThreadId ?? props.threadId} />
        </div>
      </aside>
    </div>
  );
}

function StudentMessageParts({ message, streaming }: { message: UIMessage; streaming: boolean }) {
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
      rendered.push(<StudentToolError key={`error-${index}`} part={part} />);
      return;
    }

    if (isActionResult(part) && state === "output-available") {
      const summary = actionSummary(part);
      if (summary) rendered.push(<ActionReceipt key={`action-${index}`} summary={summary} />);
      return;
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

function StudentToolError({ part }: { part: LoosePart }) {
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

function ThreadsPanel({ threads, activeId }: { threads: StudentThreadRef[]; activeId: string }) {
  if (threads.length === 0) {
    return (
      <div className="px-2 py-8 text-center">
        <History size={18} className="mx-auto text-[var(--color-faint)]" aria-hidden />
        <p className="mt-2 text-[0.75rem] text-[var(--color-muted)]">No threads.</p>
      </div>
    );
  }
  return (
    <ul className="space-y-0.5">
      {threads.map((thread) => {
        const active = thread.id === activeId;
        return (
          <li key={thread.id}>
            <Link href={`/student/atlas?thread=${thread.id}`} aria-current={active ? "page" : undefined} className={cn("block rounded-row px-2.5 py-2.5 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-accent-strong)]", active ? "bg-[var(--color-surface-muted)]" : "hover:bg-[var(--color-surface-muted)]")}>
              <span className={cn("block truncate text-[0.78125rem]", active ? "font-medium text-[var(--color-ink)]" : "text-[var(--color-muted)]")}>{thread.title}</span>
              <span className="mt-1 block text-[0.65625rem] text-[var(--color-faint)]">
                {new Date(thread.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
