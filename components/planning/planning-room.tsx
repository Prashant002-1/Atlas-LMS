"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import Link from "next/link";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import { BookOpenText, FileCheck2 } from "lucide-react";
import { cn } from "@/lib/utils";
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
import { StatusBadge, TextLink } from "@/components/atlas/primitives";
import { RubricCard } from "@/components/planning/rubric-card";
import type { RubricCriterion } from "@/lib/agent/session-parts";

/**
 * The planning room, the professor's working thread with Atlas, and the whole
 * of the Atlas surface: the agent IS the page. Left: the conversation, where
 * drafts land as the records they will become (a rubric renders as the
 * rubric, compared against the version it replaces), never as walls of text.
 * Right: only what is conversation-native, this thread's drafts with today's
 * status and the thread list. Records live on their own tabs; the harness
 * stays a conversation as the course scales.
 *
 * All conversation state is server-owned: the thread hydrates from rows, the
 * client sends only its latest message, and a refresh mid-reply costs at
 * most the reply that was streaming.
 */

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
  threadId: string; // "new" for a fresh room; the first message creates the row
  initialMessages: UIMessage[];
  threads: PlanningThreadRef[];
  drafts: PlanningDraftRef[];
  work: PlanningWorkRef[];
  pendingProposals: number;
};

const STATUS_TONE = { pending: "accent", approved: "good", rejected: "neutral", applied: "good" } as const;
const STATUS_LABEL = { pending: "Ready", approved: "Approved", rejected: "Dismissed", applied: "Applied" } as const;

type LoosePart = { type?: unknown } & Record<string, unknown>;

/** The propose_rubric tool's output as it arrives in a message part. */
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

type RecordsDraftOutput = {
  ok: true;
  proposalId: string;
  summary: string;
  records: Array<{ type: string; title: string }>;
};

function rubricOutputFrom(part: LoosePart): RubricDraftOutput | { ok: false; error: string } | null {
  const output = part.output as Record<string, unknown> | undefined;
  if (!output || typeof output !== "object") return null;
  if (output.ok === false && typeof output.error === "string") return { ok: false, error: output.error };
  if (output.ok === true && Array.isArray(output.criteria) && typeof output.proposalId === "string") {
    return output as unknown as RubricDraftOutput;
  }
  return null;
}

function recordsOutputFrom(part: LoosePart): RecordsDraftOutput | { ok: false; error: string } | null {
  const output = part.output as Record<string, unknown> | undefined;
  if (!output || typeof output !== "object") return null;
  if (output.ok === false && typeof output.error === "string") return { ok: false, error: output.error };
  if (output.ok === true && Array.isArray(output.records) && typeof output.proposalId === "string") {
    return output as unknown as RecordsDraftOutput;
  }
  return null;
}

/** The stored thread id the stream reported, read straight from the parts. */
function threadIdFromMessages(messages: UIMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    for (const part of messages[i].parts as LoosePart[]) {
      if (part.type === "data-planning-ref") {
        const data = part.data as { sessionId?: string } | undefined;
        if (data?.sessionId) return data.sessionId;
      }
    }
  }
  return null;
}

export function PlanningRoom(props: PlanningRoomProps) {
  const initialThreadId = props.threadId;

  const { messages, sendMessage, status, error } = useChat({
    id: `planning-${props.threadId}`,
    messages: props.initialMessages,
    transport: new DefaultChatTransport({
      api: "/api/atlas/planning",
      // A fresh room's first request says "new"; every later request carries
      // the stored id the stream reported, read from the messages themselves.
      prepareSendMessagesRequest: ({ messages: outgoing }) => ({
        body: {
          sessionId: threadIdFromMessages(outgoing) ?? initialThreadId,
          message: outgoing[outgoing.length - 1],
        },
      }),
    }),
  });

  /* A fresh room learns its stored thread id from the stream's first part. */
  const learnedThreadId = useMemo(() => threadIdFromMessages(messages), [messages]);

  useEffect(() => {
    if (!learnedThreadId || props.threadId !== "new") return;
    window.history.replaceState(null, "", `/teach/atlas?thread=${learnedThreadId}`);
  }, [learnedThreadId, props.threadId]);

  const statusByProposal = useMemo(() => {
    const map = new Map<string, PlanningDraftRef["status"]>();
    for (const draft of props.drafts) map.set(draft.proposalId, draft.status);
    return map;
  }, [props.drafts]);

  const busy = status === "submitted" || status === "streaming";
  const lastMessage = messages[messages.length - 1];
  const awaitingReply = busy && (!lastMessage || lastMessage.role === "user");
  const firstWork = props.work[0] ?? null;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section
        aria-label="Planning conversation"
        className="flex min-h-[30rem] flex-col overflow-hidden rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-panel)] lg:h-[calc(100dvh-190px)]"
      >
        <Conversation className="flex-1">
          <ConversationContent>
            {messages.length === 0 ? (
              <ConversationEmptyState>
                <div className="max-w-md space-y-4">
                  <div className="space-y-1">
                    <h3 className="text-[0.875rem] font-medium text-[var(--color-ink)]">A planning thread on the record</h3>
                    <p className="text-[0.8125rem] leading-6 text-[var(--color-muted)]">
                      Atlas works from the course record and prepares changes as drafts behind Review. Ask for the
                      record as it stands, or ask for a draft: rubrics, modules, work, pages, announcements,
                      practice sets. Nothing goes live from here.
                    </p>
                  </div>
                  <Suggestions className="justify-center">
                    {firstWork ? (
                      <Suggestion
                        suggestion={`Revise the rubric for ${firstWork.name}.`}
                        onClick={(s) => sendMessage({ text: s })}
                      />
                    ) : null}
                    <Suggestion suggestion="Draft a practice set on where the class is weakest." onClick={(s) => sendMessage({ text: s })} />
                    <Suggestion suggestion="What is on the course record for next week?" onClick={(s) => sendMessage({ text: s })} />
                  </Suggestions>
                </div>
              </ConversationEmptyState>
            ) : (
              messages.map((message, index) => (
                <Message key={message.id} from={message.role === "user" ? "user" : "assistant"}>
                  <MessageContent>
                    <PlanningMessageParts
                      message={message}
                      streaming={busy && index === messages.length - 1 && message.role === "assistant"}
                      statusByProposal={statusByProposal}
                    />
                  </MessageContent>
                </Message>
              ))
            )}
            {awaitingReply ? (
              <div className="flex items-center gap-2 text-[0.78125rem] text-[var(--color-muted)]">
                <Loader size={14} />
                Reading the course
              </div>
            ) : null}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <div className="border-t border-[var(--color-border)] p-3">
          {error ? (
            <p className="mb-2 text-[0.78125rem] text-[var(--color-danger)]">
              {error.message || "The thread hit an error. Everything said so far is saved; try again."}
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
            <PromptInputTextarea placeholder="Ask for a draft, a revision, or a read of the record." disabled={busy} autoFocus />
            <PromptInputToolbar>
              <PromptInputTools>
                <span className="px-1.5 text-[0.71875rem] text-[var(--color-faint)]">
                  Drafts land in Review. Nothing goes live from this thread.
                </span>
              </PromptInputTools>
              <PromptInputSubmit status={status} disabled={busy} />
            </PromptInputToolbar>
          </PromptInput>
        </div>
      </section>

      <div className="flex w-full flex-col gap-4 self-start lg:sticky lg:top-4">
        <ThreadDraftsPanel drafts={props.drafts} pendingProposals={props.pendingProposals} />
        <ThreadsPanel threads={props.threads} activeId={props.threadId} />
      </div>
    </div>
  );
}

/* ── message part rendering ─────────────────────────────────── */

function PlanningMessageParts({
  message,
  streaming,
  statusByProposal,
}: {
  message: UIMessage;
  streaming: boolean;
  statusByProposal: Map<string, PlanningDraftRef["status"]>;
}) {
  const parts = (message.parts ?? []) as LoosePart[];
  const rendered: ReactNode[] = [];

  parts.forEach((part, index) => {
    const type = String(part.type ?? "");

    if (type === "text" && typeof part.text === "string") {
      rendered.push(
        <Response key={index} streaming={streaming && index === parts.length - 1}>
          {part.text}
        </Response>
      );
      return;
    }

    if (type === "tool-read_page") {
      const output = part.output as { ok?: boolean; title?: string } | undefined;
      rendered.push(
        <p
          key={index}
          className="atlas-mono flex items-center gap-1.5 text-[0.6875rem] uppercase tracking-[0.07em] text-[var(--color-faint)]"
        >
          <BookOpenText size={11} aria-hidden />
          {output?.ok && output.title ? `Read: ${output.title}` : "Reading a page"}
        </p>
      );
      return;
    }

    if (type === "tool-propose_rubric") {
      const output = rubricOutputFrom(part);
      if (!output) {
        rendered.push(<DraftingLine key={index} label="Drafting the rubric" />);
      } else if (!output.ok) {
        rendered.push(<DraftProblemLine key={index} error={output.error} />);
      } else {
        rendered.push(
          <RubricDraftCard key={index} draft={output} status={statusByProposal.get(output.proposalId) ?? "pending"} />
        );
      }
      return;
    }

    if (type === "tool-propose_records") {
      const output = recordsOutputFrom(part);
      if (!output) {
        rendered.push(<DraftingLine key={index} label="Preparing the drafts" />);
      } else if (!output.ok) {
        rendered.push(<DraftProblemLine key={index} error={output.error} />);
      } else {
        rendered.push(
          <RecordsDraftCard key={index} draft={output} status={statusByProposal.get(output.proposalId) ?? "pending"} />
        );
      }
      return;
    }
  });

  return <>{rendered}</>;
}

function DraftingLine({ label }: { label: string }) {
  return (
    <p className="flex items-center gap-2 text-[0.78125rem] text-[var(--color-muted)]">
      <Loader size={13} />
      {label}
    </p>
  );
}

function DraftProblemLine({ error }: { error: string }) {
  return <p className="text-[0.78125rem] leading-5 text-[var(--color-warn)]">{error}</p>;
}

/* ── draft cards (the record the draft will become) ─────────── */

function DraftFrame({
  eyebrow,
  status,
  children,
  reviewNote,
}: {
  eyebrow: string;
  status: PlanningDraftRef["status"];
  children: ReactNode;
  reviewNote: string;
}) {
  return (
    <section className="my-1 w-full max-w-2xl">
      <div className="flex items-center justify-between gap-3 pb-1.5">
        <p className="atlas-mono flex items-center gap-1.5 text-[0.6875rem] uppercase tracking-[0.08em] text-[var(--color-faint)]">
          <FileCheck2 size={11} aria-hidden />
          {eyebrow}
        </p>
        <StatusBadge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</StatusBadge>
      </div>
      {children}
      <p className="mt-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-[0.71875rem] leading-4 text-[var(--color-faint)]">
        <span>{reviewNote}</span>
        {status === "pending" ? <TextLink href="/teach/review" className="text-[0.71875rem]">Decide in Review</TextLink> : null}
      </p>
    </section>
  );
}

function RubricDraftCard({ draft, status }: { draft: RubricDraftOutput; status: PlanningDraftRef["status"] }) {
  return (
    <DraftFrame
      eyebrow={`Rubric draft · ${draft.assignmentName}`}
      status={status}
      reviewNote={
        status === "applied"
          ? "Applied: the AI assignment now grades against this rubric."
          : `Applying replaces rubric v${draft.replacesVersion}; grades already given stay pinned.`
      }
    >
      <RubricCard
        title={draft.title}
        criteria={draft.criteria}
        compare={{ version: draft.replacesVersion, criteria: draft.replacesCriteria }}
      />
      {draft.note ? <p className="mt-1.5 text-[0.75rem] leading-5 text-[var(--color-muted)]">{draft.note}</p> : null}
    </DraftFrame>
  );
}

function RecordsDraftCard({ draft, status }: { draft: RecordsDraftOutput; status: PlanningDraftRef["status"] }) {
  return (
    <DraftFrame
      eyebrow="Course drafts"
      status={status}
      reviewNote={status === "applied" ? "Applied to the course record." : "Nothing touches the course until applied."}
    >
      <div className="overflow-hidden rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)]">
        <p className="border-b border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3.5 py-2.5 text-[0.8125rem] font-medium text-[var(--color-ink)]">
          {draft.summary}
        </p>
        <ul className="divide-y divide-[var(--color-border)]">
          {draft.records.map((record, index) => (
            <li key={index} className="flex items-baseline justify-between gap-3 px-3.5 py-2 text-[0.78125rem]">
              <span className="min-w-0 text-[var(--color-ink)]">{record.title}</span>
              <span className="atlas-mono shrink-0 text-[0.65625rem] uppercase tracking-[0.07em] text-[var(--color-faint)]">
                {record.type.replaceAll("_", " ")}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </DraftFrame>
  );
}

/* ── the rail: this thread's drafts, then the thread list ───── */

function ThreadDraftsPanel({ drafts, pendingProposals }: { drafts: PlanningDraftRef[]; pendingProposals: number }) {
  return (
    <section
      aria-label="Drafts from this thread"
      className="rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-panel)]"
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="atlas-mono text-[0.6875rem] uppercase tracking-[0.08em] text-[var(--color-faint)]">Drafts from this thread</p>
        {pendingProposals > 0 ? (
          <TextLink href="/teach/review" className="text-[0.71875rem]">
            {pendingProposals} in Review
          </TextLink>
        ) : null}
      </div>
      {drafts.length === 0 ? (
        <p className="mt-2 text-[0.75rem] leading-5 text-[var(--color-muted)]">
          None yet. Drafts you ask for land here and in Review.
        </p>
      ) : (
        <ul className="mt-2.5 space-y-2">
          {drafts.map((draft) => (
            <li key={draft.proposalId} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-[0.75rem] leading-5 text-[var(--color-muted)]">{draft.summary}</span>
              <StatusBadge tone={STATUS_TONE[draft.status]}>{STATUS_LABEL[draft.status]}</StatusBadge>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ThreadsPanel({ threads, activeId }: { threads: PlanningThreadRef[]; activeId: string }) {
  return (
    <section
      aria-label="Planning threads"
      className="rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-panel)]"
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="atlas-mono text-[0.6875rem] uppercase tracking-[0.08em] text-[var(--color-faint)]">Threads</p>
        <TextLink href="/teach/atlas?thread=new" className="text-[0.71875rem]">
          New thread
        </TextLink>
      </div>
      {threads.length === 0 ? (
        <p className="mt-2 text-[0.75rem] leading-5 text-[var(--color-muted)]">This is the course&apos;s first.</p>
      ) : (
        <ul className="mt-2 space-y-0.5">
          {threads.slice(0, 8).map((thread) => {
            const active = thread.id === activeId;
            return (
              <li key={thread.id}>
                <Link
                  href={`/teach/atlas?thread=${thread.id}`}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "block rounded-row px-2 py-1.5 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-accent-strong)]",
                    active ? "bg-[var(--color-surface-muted)]" : "hover:bg-[var(--color-surface-muted)]"
                  )}
                >
                  <span className={cn("block truncate text-[0.78125rem]", active ? "font-medium text-[var(--color-ink)]" : "text-[var(--color-muted)]")}>
                    {thread.title}
                  </span>
                  <span className="atlas-mono mt-0.5 block text-[0.625rem] uppercase tracking-[0.07em] text-[var(--color-faint)]">
                    {new Date(thread.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    {thread.draftCount > 0 ? ` · ${thread.draftCount} open draft${thread.draftCount === 1 ? "" : "s"}` : ""}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
