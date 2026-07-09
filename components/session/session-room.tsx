"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import { CheckCircle2, Clock3, ShieldCheck, Sparkle } from "lucide-react";
import { cn } from "@/lib/utils";
import { submitSession } from "@/lib/student/actions";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import { Response } from "@/components/ai-elements/response";
import { Loader } from "@/components/ai-elements/loader";
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
  pricingArtifactSchema,
  sideNotesFromParts,
  type RubricCriterion,
  type SideNoteCard,
} from "@/lib/agent/session-parts";
import { ArtifactPanel, type ArtifactRevision } from "@/components/session/artifact-panel";
import { RubricPanel } from "@/components/session/rubric-panel";
import { SideNoteCardView } from "@/components/session/side-note-card";

/**
 * Session room, the student's assessed work session. Left: the conversation,
 * where side-note cards land in the flow as flagged margin annotations.
 * Right: the live contract (timer, grounding, transcript policy), the
 * evolving artifact with revision diffs, the rubric, and Submit.
 *
 * All conversation state is server-owned: the transcript hydrates from rows,
 * the client sends only its latest message, and a refresh mid-session costs
 * at most the reply that was streaming.
 */

export type SessionRoomProps = {
  assignmentId: string;
  assignmentName: string;
  brief: string;
  durationMinutes: number;
  groundingScope: string[];
  transcriptPolicy: string;
  personalRecordSideNotes: boolean;
  criteria: RubricCriterion[];
  initialMessages: UIMessage[];
  initialArtifacts: Array<{ turnIndex: number; artifactType: string; state: unknown }>;
  initialSideNotes: SideNoteCard[];
  sessionStartedAt: string | null;
  submitted: boolean;
  submittedAt: string | null;
};

const TURN_ID_PATTERN = /^turn-(\d+)$/;

/**
 * Wrapper handling the fresh-run affordance: a submitted session is a frozen
 * record, but the student may start a new run on the same assignment. The
 * server already scopes turns to the newest UNSUBMITTED session, so a fresh
 * run is just the room remounted empty; the first message creates the new
 * session row.
 */
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
      submitted={false}
      submittedAt={null}
    />
  );
}

function SessionRoomInner(props: SessionRoomProps & { onStartFresh?: () => void; chatIdSuffix?: string }) {
  const { messages, sendMessage, status, error } = useChat({
    id: `session-${props.assignmentId}${props.chatIdSuffix ?? ""}`,
    messages: props.initialMessages,
    transport: new DefaultChatTransport({
      api: `/api/session/${props.assignmentId}`,
      prepareSendMessagesRequest: ({ messages: outgoing }) => ({
        body: { message: outgoing[outgoing.length - 1] },
      }),
    }),
  });

  const busy = status === "submitted" || status === "streaming";
  const started = messages.length > 0;

  /* Artifact revisions: live tool parts first, seeded rows as the fallback. */
  const liveRevisions = useMemo(() => {
    const out: ArtifactRevision[] = [];
    for (const message of messages) {
      if (message.role !== "assistant") continue;
      for (const update of artifactUpdatesFromParts(message.parts)) {
        out.push({ state: update.state });
      }
    }
    return out;
  }, [messages]);

  const seededRevisions = useMemo(() => {
    const out: ArtifactRevision[] = [];
    for (const row of props.initialArtifacts) {
      const parsed = pricingArtifactSchema.safeParse(row.state);
      if (parsed.success) out.push({ state: parsed.data });
    }
    return out;
  }, [props.initialArtifacts]);

  const revisions = liveRevisions.length > 0 ? liveRevisions : seededRevisions;

  /* Side notes carried in message parts render in-flow; stored rows that are
     not in any part (seeded sessions) attach after their turn's message. */
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
  const awaitingReply = busy && (!lastMessage || lastMessage.role === "user");

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section
        aria-label="Session conversation"
        className="flex min-h-[480px] flex-col overflow-hidden rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-panel)] lg:h-[calc(100dvh-190px)]"
      >
        <Conversation className="flex-1">
          <ConversationContent>
            {messages.length === 0 ? (
              <ConversationEmptyState title="This session is the assignment" description={props.brief}>
                <div className="max-w-md space-y-4">
                  <p className="text-[14px] font-medium leading-6 text-[var(--color-ink)]">{props.brief}</p>
                  <p className="text-[13px] leading-6 text-[var(--color-muted)]">
                    Work it out loud with Atlas. Your reasoning is what gets assessed, and the rubric on the right
                    is open the whole time.
                  </p>
                  <Suggestions className="justify-center">
                    <Suggestion suggestion="I'm ready to start." onClick={(s) => sendMessage({ text: s })} />
                    <Suggestion suggestion="What does doing well look like here?" onClick={(s) => sendMessage({ text: s })} />
                  </Suggestions>
                </div>
              </ConversationEmptyState>
            ) : (
              messages.map((message, index) => (
                <div key={message.id} className="flex flex-col gap-3">
                  <Message from={message.role === "user" ? "user" : "assistant"}>
                    <MessageContent>
                      <MessageParts
                        message={message}
                        streaming={busy && index === messages.length - 1 && message.role === "assistant"}
                      />
                    </MessageContent>
                  </Message>
                  {(seededNotesByTurn.get(turnIndexOf(message.id)) ?? []).map((note) => (
                    <SideNoteCardView key={note.id} note={note} />
                  ))}
                </div>
              ))
            )}
            {awaitingReply ? (
              <div className="flex items-center gap-2 text-[12.5px] text-[var(--color-muted)]">
                <Loader size={14} />
                Reading the course record
              </div>
            ) : null}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <div className="border-t border-[var(--color-border)] p-3">
          {props.submitted ? (
            <div className="flex items-start gap-2.5 rounded-panel bg-[var(--color-surface-muted)] px-3.5 py-3">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[var(--color-accent-strong)]" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-medium text-[var(--color-ink)]">Session submitted</p>
                <p className="mt-0.5 text-[12.5px] leading-5 text-[var(--color-muted)]">
                  {props.submittedAt ? `Frozen ${formatStamp(props.submittedAt)}. ` : ""}
                  The transcript and your final design are on your record; grading reads the journey next.
                </p>
                {props.onStartFresh ? (
                  <button
                    type="button"
                    onClick={props.onStartFresh}
                    className="mt-2 rounded-control border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-1.5 text-[12.5px] font-medium text-[var(--color-ink)] transition hover:border-[var(--color-ink)]"
                  >
                    Start a fresh run
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <>
              {error ? (
                <p className="mb-2 text-[12.5px] text-[var(--color-danger)]">
                  {error.message || "The session hit an error. Your transcript is saved; try again."}
                </p>
              ) : null}
              <PromptInput
                onSubmit={(message, event) => {
                  const text = message.text.trim();
                  if (!text || busy) return;
                  sendMessage({ text });
                  const form = event.currentTarget;
                  form.reset();
                  const field = form.querySelector("textarea");
                  if (field) field.style.height = "auto";
                }}
              >
                <PromptInputTextarea
                  placeholder={started ? "Make your next move." : "Frame the problem to begin."}
                  disabled={busy}
                  autoFocus
                />
                <PromptInputToolbar>
                  <PromptInputTools>
                    <span className="px-1.5 text-[11.5px] text-[var(--color-faint)]">
                      Assessed session. Your moves are the deliverable.
                    </span>
                  </PromptInputTools>
                  <PromptInputSubmit status={status} disabled={busy} />
                </PromptInputToolbar>
              </PromptInput>
            </>
          )}
        </div>
      </section>

      <div className="flex w-full flex-col gap-4 self-start lg:sticky lg:top-4">
        <SessionContractCard {...props} started={started} />
        <ArtifactPanel revisions={revisions} />
        <RubricPanel criteria={props.criteria} />
        {!props.submitted && started ? <SubmitSessionControl assignmentId={props.assignmentId} /> : null}
      </div>
    </div>
  );
}

/* ── message part rendering ─────────────────────────────────── */

function MessageParts({ message, streaming }: { message: UIMessage; streaming: boolean }) {
  const parts = message.parts ?? [];
  const rendered: ReactNode[] = [];

  parts.forEach((part, index) => {
    const type = String(part.type ?? "");
    if (type === "text" && "text" in part && typeof part.text === "string") {
      rendered.push(
        <Response key={index} streaming={streaming && index === parts.length - 1}>
          {part.text}
        </Response>
      );
      return;
    }
    if (type === "tool-update_artifact") {
      rendered.push(
        <p key={index} className="atlas-mono flex items-center gap-1.5 text-[11px] uppercase tracking-[0.07em] text-[var(--color-accent-strong)]">
          <Sparkle size={11} aria-hidden />
          Design captured to the panel
        </p>
      );
      return;
    }
    if (type === "data-side-note") {
      const notes = sideNotesFromParts([part]);
      for (const note of notes) {
        rendered.push(<SideNoteCardView key={`${index}-${note.id}`} note={note} />);
      }
    }
  });

  return <>{rendered}</>;
}

function turnIndexOf(messageId: string): number {
  const match = TURN_ID_PATTERN.exec(messageId);
  return match ? Number(match[1]) : -1;
}

function formatStamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/* ── the session contract card (timer + policy transparency) ── */

function SessionContractCard(props: SessionRoomProps & { started: boolean }) {
  return (
    <section
      aria-label="Session contract"
      className="rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-panel)]"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="atlas-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-faint)]">Session</p>
        <SessionTimer
          startedAt={props.sessionStartedAt}
          durationMinutes={props.durationMinutes}
          running={props.started && !props.submitted}
        />
      </div>
      <p className="mt-2 text-[13px] leading-6 text-[var(--color-muted)]">{props.brief}</p>
      <dl className="mt-3 space-y-1.5 text-[12px] leading-5">
        {props.groundingScope.length > 0 ? (
          <div className="flex gap-2">
            <dt className="atlas-mono shrink-0 text-[10.5px] uppercase tracking-[0.07em] text-[var(--color-faint)]">Grounded on</dt>
            <dd className="text-[var(--color-muted)]">{props.groundingScope.join(", ")}</dd>
          </div>
        ) : null}
        <div className="flex gap-2">
          <dt className="atlas-mono shrink-0 text-[10.5px] uppercase tracking-[0.07em] text-[var(--color-faint)]">Transcript</dt>
          <dd className="text-[var(--color-muted)]">{props.transcriptPolicy}</dd>
        </div>
        {props.personalRecordSideNotes ? (
          <div className="flex items-center gap-1.5 pt-0.5 text-[var(--color-muted)]">
            <ShieldCheck size={12} className="text-[var(--color-accent-strong)]" aria-hidden />
            Personal-record side notes are on, approved by your professor.
          </div>
        ) : null}
      </dl>
    </section>
  );
}

function SessionTimer({
  startedAt,
  durationMinutes,
  running,
}: {
  startedAt: string | null;
  durationMinutes: number;
  running: boolean;
}) {
  // The clock lives entirely in interval callbacks: the first tick both
  // establishes the local start (when the server has none yet) and starts
  // the readout, keeping render pure.
  const [now, setNow] = useState<number | null>(null);
  const [localStart, setLocalStart] = useState<number | null>(null);

  useEffect(() => {
    if (!running) return;
    const tick = () => {
      setNow(Date.now());
      if (!startedAt) setLocalStart((prev) => prev ?? Date.now());
    };
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [running, startedAt]);

  const startMs = startedAt ? Date.parse(startedAt) : localStart;
  const total = durationMinutes * 60;

  if (!running || startMs === null || now === null) {
    return (
      <span className="atlas-mono flex items-center gap-1 text-[11.5px] text-[var(--color-faint)]">
        <Clock3 size={11.5} aria-hidden />
        {durationMinutes} min
      </span>
    );
  }

  const remaining = Math.max(0, total - Math.floor((now - startMs) / 1000));
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const low = remaining <= 300;

  return (
    <span
      className={cn(
        "atlas-mono flex items-center gap-1 text-[11.5px] tabular-nums",
        low ? "text-[var(--color-warn)]" : "text-[var(--color-muted)]"
      )}
      aria-label={remaining === 0 ? "Time is up" : `${minutes} minutes ${seconds} seconds left`}
    >
      <Clock3 size={11.5} aria-hidden />
      {remaining === 0 ? "Time - wrap up and submit" : `${minutes}:${String(seconds).padStart(2, "0")}`}
    </span>
  );
}

/* ── submit ─────────────────────────────────────────────────── */

function SubmitSessionControl({ assignmentId }: { assignmentId: string }) {
  const [armed, setArmed] = useState(false);

  return (
    <section
      aria-label="Submit session"
      className="rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-panel)]"
    >
      {!armed ? (
        <>
          <button
            type="button"
            onClick={() => setArmed(true)}
            className="w-full rounded-control border border-[var(--color-ink)] bg-[var(--color-ink)] px-3.5 py-2 text-[13.5px] font-medium text-[var(--color-bg)] transition hover:border-[var(--color-accent-strong)] hover:bg-[var(--color-accent-strong)]"
          >
            Submit session
          </button>
          <p className="mt-2 text-[11.5px] leading-4 text-[var(--color-faint)]">
            Submitting freezes the transcript and your final design as the record your grade reads from.
          </p>
        </>
      ) : (
        <form action={submitSession} className="space-y-2">
          <input type="hidden" name="assignmentId" value={assignmentId} />
          <p className="text-[12.5px] leading-5 text-[var(--color-muted)]">
            Submit and freeze this session? You will not be able to add turns afterward.
          </p>
          <div className="flex gap-2">
            <ConfirmSubmitButton />
            <button
              type="button"
              onClick={() => setArmed(false)}
              className="rounded-control border border-[var(--color-border)] px-3 py-1.5 text-[12.5px] font-medium text-[var(--color-muted)] transition hover:text-[var(--color-ink)]"
            >
              Keep working
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function ConfirmSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-control border border-[var(--color-ink)] bg-[var(--color-ink)] px-3 py-1.5 text-[12.5px] font-medium text-[var(--color-bg)] transition hover:border-[var(--color-accent-strong)] hover:bg-[var(--color-accent-strong)] disabled:opacity-50"
    >
      {pending ? "Submitting" : "Confirm submit"}
    </button>
  );
}
