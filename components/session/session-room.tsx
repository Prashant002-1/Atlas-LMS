"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { WorkflowChatTransport } from "@ai-sdk/workflow";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { submitSession } from "@/lib/student/actions";
import type { StudentJourneyReportView } from "@/lib/student/session-view";
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
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import {
  artifactUpdatesFromParts,
  isArtifactToolPartType,
  parseSessionArtifact,
  sideNotesFromParts,
  type RubricCriterion,
  type SideNoteCard,
} from "@/lib/agent/session-parts";
import { ArtifactPanel, type ArtifactRevision } from "@/components/session/artifact-panel";
import { JourneyReportPanel } from "@/components/session/journey-report-panel";
import { RubricPanel } from "@/components/session/rubric-panel";
import { SideNoteCardView } from "@/components/session/side-note-card";

export type SessionRoomProps = {
  assignmentId: string;
  assignmentName: string;
  courseCode: string;
  agentName: string;
  brief: string;
  durationMinutes: number;
  groundingScope: string[];
  criteria: RubricCriterion[];
  initialMessages: UIMessage[];
  initialArtifacts: Array<{ turnIndex: number; artifactType: string; state: unknown }>;
  initialSideNotes: SideNoteCard[];
  sessionStartedAt: string | null;
  deadlineAt: string | null;
  activeRunId: string | null;
  submitted: boolean;
  submittedAt: string | null;
  report: StudentJourneyReportView | null;
  gradingPending: boolean;
};

const TURN_ID_PATTERN = /^turn-(\d+)$/;

export function SessionRoom(props: SessionRoomProps) {
  const [freshRun, setFreshRun] = useState(false);

  if (!freshRun) {
    return <SessionRoomInner {...props} onStartFresh={props.submitted ? () => setFreshRun(true) : undefined} />;
  }

  return (
    <SessionRoomInner
      key="fresh-run"
      {...props}
      chatIdSuffix="-fresh"
      initialMessages={[]}
      initialArtifacts={[]}
      initialSideNotes={[]}
      sessionStartedAt={null}
      deadlineAt={null}
      activeRunId={null}
      submitted={false}
      submittedAt={null}
      report={null}
      gradingPending={false}
    />
  );
}

function SessionRoomInner(props: SessionRoomProps & { onStartFresh?: () => void; chatIdSuffix?: string }) {
  const router = useRouter();
  const runStorageKey = `atlas-active-run:session:${props.assignmentId}${props.chatIdSuffix ?? ""}`;
  const [localDeadlineAt, setLocalDeadlineAt] = useState<string | null>(props.deadlineAt);
  const [closing, setClosing] = useState(false);
  const [steerQueue, setSteerQueue] = useState<string[]>([]);
  const steerQueueRef = useRef<string[]>([]);
  const deadlineAt = localDeadlineAt ?? props.deadlineAt;
  const transport = useMemo(() => new WorkflowChatTransport<UIMessage>({
    api: `/api/session/${props.assignmentId}`,
    prepareSendMessagesRequest: ({ messages: outgoing }) => ({
      body: { message: outgoing[outgoing.length - 1] },
    }),
    onChatSendMessage: (response) => {
      const runId = response.headers.get("x-workflow-run-id");
      const exactDeadline = response.headers.get("x-session-deadline-at");
      if (runId) {
        window.localStorage.setItem(runStorageKey, runId);
      }
      if (exactDeadline) setLocalDeadlineAt(exactDeadline);
    },
    onChatEnd: () => {
      window.localStorage.removeItem(runStorageKey);
    },
    prepareReconnectToStreamRequest: ({ ...rest }) => {
      const runId = window.localStorage.getItem(runStorageKey);
      if (!runId) throw new Error("No active session run to resume.");
      return { ...rest, api: `/api/agent-runs/${encodeURIComponent(runId)}/stream` };
    },
  }), [props.assignmentId, runStorageKey]);

  useEffect(() => {
    if (props.activeRunId) window.localStorage.setItem(runStorageKey, props.activeRunId);
    else window.localStorage.removeItem(runStorageKey);
  }, [props.activeRunId, runStorageKey]);

  const { messages, sendMessage, status, error } = useChat({
    id: `session-${props.assignmentId}${props.chatIdSuffix ?? ""}`,
    messages: props.initialMessages,
    resume: Boolean(props.activeRunId),
    transport,
    onError: (chatError) => console.error("Atlas session stream failed", chatError),
    onFinish: ({ isAbort, isDisconnect }) => {
      if (isAbort || isDisconnect) return;
      if (closing || props.submitted) {
        steerQueueRef.current = [];
        setSteerQueue([]);
        return;
      }
      const [next, ...rest] = steerQueueRef.current;
      if (!next) return;
      steerQueueRef.current = rest;
      setSteerQueue(rest);
      window.setTimeout(() => sendMessage({ text: next }), 0);
    },
  });
  const [inspectorOpen, setInspectorOpen] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const sync = () => setInspectorOpen(query.matches);
    const frame = requestAnimationFrame(sync);
    query.addEventListener("change", sync);
    return () => {
      cancelAnimationFrame(frame);
      query.removeEventListener("change", sync);
    };
  }, []);

  const busy = status === "submitted" || status === "streaming";
  const started = messages.length > 0;

  const beginIfNeeded = () => {
    if (deadlineAt || started) return;
    setLocalDeadlineAt(new Date(Date.now() + props.durationMinutes * 60_000).toISOString());
  };

  const sendSessionMessage = (text: string) => {
    beginIfNeeded();
    sendMessage({ text });
  };

  useEffect(() => {
    if (!deadlineAt || props.submitted) return;
    const delay = Math.max(0, Date.parse(deadlineAt) - Date.now());
    const timer = window.setTimeout(() => setClosing(true), delay);
    return () => window.clearTimeout(timer);
  }, [deadlineAt, props.submitted]);

  useEffect(() => {
    if (!closing && !props.gradingPending) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const response = await fetch(`/api/session/${props.assignmentId}/state`, { cache: "no-store" });
        if (!response.ok || cancelled) return;
        const state = await response.json() as { submitted: boolean; reportReady: boolean; deadlineAt: string | null };
        if (state.deadlineAt) setLocalDeadlineAt(state.deadlineAt);
        if ((state.submitted && !props.submitted) || (state.reportReady && !props.report)) router.refresh();
      } catch {
        // The durable workflow owns completion; a transient poll failure is harmless.
      }
    };
    void poll();
    const timer = window.setInterval(poll, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [closing, props.assignmentId, props.gradingPending, props.report, props.submitted, router]);

  const liveRevisions = useMemo(() => {
    const out: ArtifactRevision[] = [];
    for (const message of messages) {
      if (message.role !== "assistant") continue;
      for (const update of artifactUpdatesFromParts(message.parts)) out.push(update);
    }
    return out;
  }, [messages]);

  const seededRevisions = useMemo(() => {
    const out: ArtifactRevision[] = [];
    for (const row of props.initialArtifacts) {
      const parsed = parseSessionArtifact(row.artifactType, row.state);
      if (parsed) out.push(parsed);
    }
    return out;
  }, [props.initialArtifacts]);

  const revisions = liveRevisions.length > 0 ? liveRevisions : seededRevisions;

  const inlineNoteIds = useMemo(() => {
    const ids = new Set<string>();
    for (const message of messages) {
      for (const note of sideNotesFromParts(message.parts)) ids.add(note.id);
    }
    return ids;
  }, [messages]);

  const seededNotesByTurn = useMemo(() => {
    const map = new Map<number, SideNoteCard[]>();
    for (const note of props.initialSideNotes) {
      if (inlineNoteIds.has(note.id)) continue;
      const list = map.get(note.turnIndex) ?? [];
      list.push(note);
      map.set(note.turnIndex, list);
    }
    return map;
  }, [props.initialSideNotes, inlineNoteIds]);

  const lastMessage = messages[messages.length - 1];
  const awaitingReply = busy && !messageHasVisibleOutput(lastMessage);
  const promptCheckpoints = useMemo(
    () => messages
      .filter((message) => message.role === "user")
      .map((message, index) => ({ id: message.id, label: promptCheckpointLabel(message, index) })),
    [messages]
  );

  return (
    <div className="student-assignment-session-root flex h-full min-h-0 w-full bg-[var(--color-bg)]">
      <style jsx global>{`
        html:has(.student-assignment-session-root),
        html:has(.student-assignment-session-root) body,
        html:has(.student-assignment-session-root) .atlas-app-bg {
          height: 100dvh;
          overflow: hidden;
        }
        html:has(.student-assignment-session-root) .atlas-app-bg > main,
        html:has(.student-assignment-session-root) .atlas-app-bg > main > div,
        html:has(.student-assignment-session-root) .atlas-app-bg > main > div > div {
          height: 100dvh;
          min-height: 0;
        }
        html:has(.student-assignment-session-root) .atlas-app-bg > main > div {
          max-width: none;
          padding: 0;
        }
      `}</style>

      <section aria-label="Assignment session" className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 md:px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <Link
              href={`/student/assignments/${props.assignmentId}`}
              aria-label="Back to assignment"
              title="Back to assignment"
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-control text-[var(--color-muted)] transition hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]"
            >
              <ArrowLeft size={15} aria-hidden />
            </Link>
            <div className="min-w-0">
              <div className="flex min-w-0 items-baseline gap-2">
                <h1 className="truncate text-[0.875rem] font-semibold text-[var(--color-ink)]">{props.assignmentName}</h1>
                <span className="hidden shrink-0 text-[0.6875rem] text-[var(--color-faint)] sm:block">{props.courseCode}</span>
              </div>
              <p className="truncate text-[0.6875rem] text-[var(--color-muted)]">Session with {props.agentName}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <SessionTimer deadlineAt={deadlineAt} durationMinutes={props.durationMinutes} running={started && !props.submitted} onElapsed={() => setClosing(true)} />
            {props.submitted ? <span className="hidden text-[0.71875rem] font-medium text-[var(--color-accent-strong)] sm:block">Submitted</span> : null}
            <button
              type="button"
              onClick={() => setInspectorOpen((open) => !open)}
              aria-label={inspectorOpen ? "Close assignment details" : "Open assignment details"}
              aria-controls="assignment-details-panel"
              aria-expanded={inspectorOpen}
              title={inspectorOpen ? "Close details" : "Assignment details"}
              className="inline-flex size-8 items-center justify-center rounded-control text-[var(--color-muted)] transition hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]"
            >
              {inspectorOpen ? <PanelRightClose size={16} aria-hidden /> : <PanelRightOpen size={16} aria-hidden />}
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="relative flex min-h-0 flex-1">
              <Conversation className="h-full bg-[var(--color-bg)]">
                <ConversationContent className="mx-auto w-full max-w-[48rem] flex-1 gap-7 px-4 pb-10 pt-8 md:px-8">
                {messages.length === 0 ? (
                  <ConversationEmptyState className="min-h-[25rem] items-start justify-center px-0 text-left">
                    <div className="w-full max-w-[40rem] space-y-6">
                      <div className="space-y-2">
                        <p className="text-[0.75rem] font-medium text-[var(--color-accent-strong)]">Assignment session</p>
                        <h2 className="atlas-serif text-[1.75rem] font-semibold leading-tight text-[var(--color-ink)]">Begin the assignment</h2>
                        <p className="max-w-[36rem] text-[0.875rem] leading-6 text-[var(--color-muted)]">{props.brief}</p>
                      </div>
                      <dl className="grid max-w-[36rem] gap-3 py-3 text-[0.75rem] sm:grid-cols-3">
                        <div><dt className="text-[var(--color-faint)]">Time</dt><dd className="mt-0.5 font-medium text-[var(--color-ink)]">{props.durationMinutes} minutes</dd></div>
                        <div><dt className="text-[var(--color-faint)]">Rubric</dt><dd className="mt-0.5 font-medium text-[var(--color-ink)]">{props.criteria.length} criteria</dd></div>
                        <div><dt className="text-[var(--color-faint)]">Transcript</dt><dd className="mt-0.5 font-medium text-[var(--color-ink)]">Part of submission</dd></div>
                      </dl>
                      <Suggestions className="justify-start">
                        <Suggestion suggestion="I'm ready. Begin with the first question." onClick={sendSessionMessage} />
                        <Suggestion suggestion="Review the rubric with me before we start." onClick={sendSessionMessage} />
                      </Suggestions>
                    </div>
                  </ConversationEmptyState>
                ) : (
                  messages.map((message, index) => (
                    <div key={message.id} className="flex flex-col gap-3">
                      <Message
                        id={message.role === "user" ? promptAnchorId(message.id) : undefined}
                        className={message.role === "user" ? "scroll-mt-24" : undefined}
                        from={message.role === "user" ? "user" : "assistant"}
                      >
                        <MessageContent>
                          <MessageParts message={message} streaming={busy && index === messages.length - 1 && message.role === "assistant"} />
                        </MessageContent>
                      </Message>
                      {(seededNotesByTurn.get(turnIndexOf(message.id)) ?? []).map((note) => <SideNoteCardView key={note.id} note={note} />)}
                    </div>
                  ))
                )}
                  {awaitingReply ? <ThinkingIndicator label={`${props.agentName} is responding`} /> : null}
                </ConversationContent>
              </Conversation>
              {promptCheckpoints.length > 0 ? <PromptCheckpointRail checkpoints={promptCheckpoints} /> : null}
            </div>

            <div className="shrink-0 bg-gradient-to-t from-[var(--color-bg)] via-[var(--color-bg)] to-transparent px-3 pb-3 pt-2 md:px-6 md:pb-5">
              <div className="mx-auto w-full max-w-[48rem]">
                {props.submitted ? (
                  <SubmittedControl submittedAt={props.submittedAt} onStartFresh={props.onStartFresh} />
                ) : closing ? (
                  <ClosingControl agentName={props.agentName} />
                ) : (
                  <>
                    {error ? <p className="mb-2 text-[0.78125rem] text-[var(--color-danger)]">{error.message || "The session could not finish that turn. Your message is saved."}</p> : null}
                    {steerQueue.length > 0 ? <p className="mb-2 text-[0.71875rem] text-[var(--color-muted)]" role="status">Steer queued · {steerQueue[0]}</p> : null}
                    <PromptInput
                      className="min-h-[3.25rem] flex-row items-end overflow-hidden shadow-[var(--shadow-floating)]"
                      onSubmit={(message, event) => {
                        const text = message.text.trim();
                        if (!text) return;
                        if (busy) {
                          const nextQueue = [...steerQueueRef.current, text];
                          steerQueueRef.current = nextQueue;
                          setSteerQueue(nextQueue);
                        } else {
                          sendSessionMessage(text);
                        }
                        const form = event.currentTarget;
                        form.reset();
                        const field = form.querySelector("textarea");
                        if (field) field.style.height = "auto";
                      }}
                    >
                      <PromptInputTextarea aria-label="Assignment response" className="min-h-[3.125rem] w-auto min-w-0 flex-1 px-3 py-[0.8125rem]" placeholder={busy ? `Steer ${props.agentName}...` : started ? "Continue your reasoning..." : "Begin the assignment..."} autoFocus />
                      <PromptInputToolbar className="shrink-0 justify-end gap-0.5 px-1.5 py-1.5">
                        <PromptInputTools><span className="px-1.5 text-[0.6875rem] text-[var(--color-faint)]">Assignment session</span></PromptInputTools>
                        <PromptInputSubmit status={status} allowSubmitWhileBusy className="rounded-full" />
                      </PromptInputToolbar>
                    </PromptInput>
                  </>
                )}
              </div>
            </div>
          </div>

          {inspectorOpen ? <button type="button" aria-label="Close assignment details" className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setInspectorOpen(false)} /> : null}
          <aside
            id="assignment-details-panel"
            aria-hidden={!inspectorOpen}
            inert={!inspectorOpen}
            className={cn(
              "fixed inset-y-0 right-0 z-40 flex w-[min(22rem,92vw)] flex-col overflow-hidden border-l bg-[var(--color-surface)] shadow-[var(--shadow-floating)] transition-[transform,opacity,width,border-color] lg:static lg:z-auto lg:translate-x-0 lg:shadow-none",
              inspectorOpen
                ? "translate-x-0 border-[var(--color-border)] opacity-100 lg:w-[21rem]"
                : "pointer-events-none translate-x-full border-transparent opacity-0 lg:w-0 lg:translate-x-0"
            )}
          >
            <div className="flex h-14 w-[min(21rem,92vw)] shrink-0 items-center justify-between border-b border-[var(--color-border)] px-4">
              <p className="text-[0.8125rem] font-semibold text-[var(--color-ink)]">Assignment details</p>
              <button type="button" onClick={() => setInspectorOpen(false)} aria-label="Close assignment details" className="inline-flex size-8 items-center justify-center rounded-control text-[var(--color-muted)] transition hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]"><PanelRightClose size={15} aria-hidden /></button>
            </div>
            <div className="min-h-0 w-[min(21rem,92vw)] flex-1 overflow-y-auto">
              <AssignmentDetails {...props} deadlineAt={deadlineAt} started={started} />
              <div className="px-4 py-4"><ArtifactPanel revisions={revisions} plain /></div>
              <div className="px-4 py-4"><RubricPanel criteria={props.criteria} plain /></div>
              {props.report ? <div className="px-4 py-4"><JourneyReportPanel report={props.report} assignmentId={props.assignmentId} compact /></div> : null}
              {props.gradingPending ? <div className="px-4 py-4"><h2 className="text-[0.8125rem] font-semibold text-[var(--color-ink)]">Grade pending</h2><p className="mt-1 text-[0.75rem] leading-5 text-[var(--color-muted)]">Your submission is saved and waiting for grading.</p></div> : null}
            </div>
            {!props.submitted && started ? <div className="shrink-0 border-t border-[var(--color-border)] p-4"><SubmitSessionControl assignmentId={props.assignmentId} /></div> : null}
          </aside>
        </div>
      </section>
    </div>
  );
}

function MessageParts({ message, streaming }: { message: UIMessage; streaming: boolean }) {
  const parts = message.parts ?? [];
  const rendered: ReactNode[] = [];

  parts.forEach((part, index) => {
    const type = String(part.type ?? "");
    if (type === "text" && "text" in part && typeof part.text === "string") {
      rendered.push(<Response key={index} streaming={streaming && index === parts.length - 1}>{part.text}</Response>);
      return;
    }
    if (isArtifactToolPartType(type)) {
      rendered.push(<p key={index} className="flex items-center gap-1.5 text-[0.75rem] font-medium text-[var(--color-accent-strong)]"><CheckCircle2 size={13} aria-hidden />Submission draft updated</p>);
      return;
    }
    if (type === "data-side-note") {
      const notes = sideNotesFromParts([part]);
      for (const note of notes) rendered.push(<SideNoteCardView key={`${index}-${note.id}`} note={note} />);
    }
  });

  return <>{rendered}</>;
}

function turnIndexOf(messageId: string): number {
  const match = TURN_ID_PATTERN.exec(messageId);
  return match ? Number(match[1]) : -1;
}

function formatStamp(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function AssignmentDetails(props: SessionRoomProps & { started: boolean }) {
  return (
    <section aria-label="Assignment" className="px-4 py-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[0.8125rem] font-semibold text-[var(--color-ink)]">Assignment</h2>
        <SessionTimer deadlineAt={props.deadlineAt} durationMinutes={props.durationMinutes} running={props.started && !props.submitted} />
      </div>
      <p className="mt-2 text-[0.78125rem] leading-5 text-[var(--color-muted)]">{props.brief}</p>
      <dl className="mt-3 space-y-1 text-[0.71875rem] leading-5">
        {props.groundingScope.length > 0 ? <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2 py-2"><dt className="text-[var(--color-faint)]">Course material</dt><dd className="text-[var(--color-muted)]">{props.groundingScope.join(", ")}</dd></div> : null}
        <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2 py-2"><dt className="text-[var(--color-faint)]">Transcript</dt><dd className="text-[var(--color-muted)]">Available to your instructor</dd></div>
      </dl>
    </section>
  );
}

function SessionTimer({
  deadlineAt,
  durationMinutes,
  running,
  onElapsed,
}: {
  deadlineAt: string | null;
  durationMinutes: number;
  running: boolean;
  onElapsed?: () => void;
}) {
  const [now, setNow] = useState<number | null>(null);
  const elapsedRef = useRef(false);

  useEffect(() => {
    if (!running) return;
    const tick = () => setNow(Date.now());
    const frame = requestAnimationFrame(tick);
    const timer = setInterval(tick, 1000);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(timer);
    };
  }, [running]);

  const deadlineMs = deadlineAt ? Date.parse(deadlineAt) : null;

  useEffect(() => {
    if (!running || deadlineMs === null || now === null || deadlineMs > now || elapsedRef.current) return;
    elapsedRef.current = true;
    onElapsed?.();
  }, [deadlineMs, now, onElapsed, running]);

  if (!running || deadlineMs === null || now === null) {
    return <span className="flex items-center gap-1 text-[0.71875rem] text-[var(--color-faint)]"><Clock3 size={11.5} aria-hidden />{durationMinutes} min</span>;
  }

  const remaining = Math.max(0, Math.ceil((deadlineMs - now) / 1000));
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const low = remaining <= 300;

  return (
    <span
      className={cn("flex items-center gap-1 text-[0.71875rem] tabular-nums", low ? "text-[var(--color-warn)]" : "text-[var(--color-muted)]")}
      aria-label={remaining === 0 ? "Time is up" : `${minutes} minutes ${seconds} seconds left`}
    >
      <Clock3 size={11.5} aria-hidden />
      {remaining === 0 ? "Time is up" : `${minutes}:${String(seconds).padStart(2, "0")}`}
    </span>
  );
}

function ClosingControl({ agentName }: { agentName: string }) {
  return (
    <div className="rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-3 shadow-[var(--shadow-panel)]" role="status" aria-live="polite">
      <ThinkingIndicator label={`${agentName} is concluding the session`} />
      <p className="mt-1 text-[0.71875rem] leading-5 text-[var(--color-muted)]">Time is up. Your final response is being saved, the assignment will submit automatically, and a reviewable draft grade will follow.</p>
    </div>
  );
}

function SubmittedControl({ submittedAt, onStartFresh }: { submittedAt: string | null; onStartFresh?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-3 shadow-[var(--shadow-panel)]">
      <div className="min-w-0">
        <p className="text-[0.8125rem] font-medium text-[var(--color-ink)]">Session submitted</p>
        <p className="mt-0.5 truncate text-[0.71875rem] text-[var(--color-muted)]">{submittedAt ? `Submitted ${formatStamp(submittedAt)}` : "Transcript and submission draft saved"}</p>
      </div>
      {onStartFresh ? <button type="button" onClick={onStartFresh} className="shrink-0 rounded-control border border-[var(--color-border-strong)] px-2.5 py-1.5 text-[0.75rem] font-medium text-[var(--color-muted)] transition hover:text-[var(--color-ink)]">New attempt</button> : null}
    </div>
  );
}

function SubmitSessionControl({ assignmentId }: { assignmentId: string }) {
  const [armed, setArmed] = useState(false);
  if (!armed) {
    return <button type="button" onClick={() => setArmed(true)} className="w-full rounded-control bg-[var(--color-ink)] px-3.5 py-2 text-[0.8125rem] font-medium text-[var(--color-bg)] transition hover:bg-[var(--color-accent-strong)]">Submit assignment</button>;
  }
  return (
    <form action={submitSession} className="space-y-2">
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <p className="text-[0.75rem] leading-5 text-[var(--color-muted)]">Submit this session? You cannot add more turns afterward.</p>
      <div className="flex gap-2"><ConfirmSubmitButton /><button type="button" onClick={() => setArmed(false)} className="rounded-control border border-[var(--color-border)] px-2.5 py-1.5 text-[0.75rem] font-medium text-[var(--color-muted)]">Continue</button></div>
    </form>
  );
}

function ConfirmSubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="rounded-control bg-[var(--color-ink)] px-2.5 py-1.5 text-[0.75rem] font-medium text-[var(--color-bg)] transition hover:bg-[var(--color-accent-strong)] disabled:opacity-50">{pending ? "Submitting" : "Confirm"}</button>;
}
