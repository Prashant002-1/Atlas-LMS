"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { type UIMessage } from "ai";
import { WorkflowChatTransport } from "@ai-sdk/workflow";
import { Archive, CheckCircle2, FileText, History, PanelRightClose, PanelRightOpen, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageTimestamp } from "@/components/ai-elements/message";
import { AtlasMessageParts, type AtlasLoosePart } from "@/components/agent/message-parts";
import { ChatThreadRow } from "@/components/agent/chat-thread-row";
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
import { SteeringPending } from "@/components/ai-elements/steering";
import { useSteering } from "@/components/ai-elements/use-steering";
import { AtlasMark } from "@/components/atlas/primitives";
import { archiveStudentAtlasChat, archiveStudentAtlasChatFromList } from "@/lib/agent/chat-actions";
import { atlasMessageMetadataNow, type AtlasMessageMetadata } from "@/lib/agent/ui-message";
import { uploadStudentAtlasDocument } from "@/lib/student/document-actions";
import { atlasChatTitleFromIntent, firstUserTextFromParts, isDefaultAtlasChatTitle } from "@/lib/agent/chat-title";

type StudentAtlasChatMessage = UIMessage<AtlasMessageMetadata>;

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
  initialMessages: StudentAtlasChatMessage[];
  activeRunId: string | null;
  threads: StudentThreadRef[];
  firstCourse: { id: string; code: string } | null;
};

type LoosePart = AtlasLoosePart;

type StudentDocumentAttachment = {
  attachmentId: string;
  fileId: string;
  displayName: string;
  filename: string | null;
  processingStatus: "queued" | "processing" | "ready" | "failed";
};

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

const TOOL_TITLES: Record<string, string> = {
  "tool-inspect_record": "Checking your record",
  "tool-search_course": "Searching the course",
  "tool-read_page": "Reading the material",
  "tool-remember": "Noting",
};

function toolLabel(part: LoosePart): string {
  const type = String(part.type ?? "");
  return TOOL_TITLES[type] ?? "Working";
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
  const router = useRouter();
  const [railOpen, setRailOpen] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceTranscriptionState>("idle");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState(props.threadId);
  const [selectedDocuments, setSelectedDocuments] = useState<StudentDocumentAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [uploadPending, startUploadTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resumedRunIdRef = useRef<string | null>(null);

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

  const runStorageKey = `atlas-active-run:student:${activeSessionId}`;
  const settleSteeringRef = useRef<() => void>(() => {});
  const transport = useMemo(() => new WorkflowChatTransport<StudentAtlasChatMessage>({
    api: "/api/atlas/student",
    prepareSendMessagesRequest: ({ messages: outgoing }) => ({
      body: {
        sessionId: threadIdFromMessages(outgoing) ?? activeSessionId,
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
  }), [activeSessionId, runStorageKey]);

  useEffect(() => {
    if (props.activeRunId) window.localStorage.setItem(runStorageKey, props.activeRunId);
    else window.localStorage.removeItem(runStorageKey);
  }, [props.activeRunId, runStorageKey]);

  const { messages, sendMessage, resumeStream, addToolApprovalResponse, status, error } = useChat<StudentAtlasChatMessage>({
    id: `student-atlas-${props.threadId}`,
    messages: props.initialMessages,
    transport,
    onError: (chatError) => console.error("student Atlas stream failed", chatError),
    onFinish: ({ isAbort, isDisconnect }) => {
      if (isAbort || isDisconnect) return;
      /* Anything the run never reached is sent as the next turn instead. */
      settleSteeringRef.current();
      router.refresh();
    },
  });

  useEffect(() => {
    if (!props.activeRunId || resumedRunIdRef.current === props.activeRunId) return;
    resumedRunIdRef.current = props.activeRunId;
    void resumeStream();
  }, [props.activeRunId, resumeStream]);

  const sendStudentMessage = (text: string) => {
    const attachments = selectedDocuments;
    const message = attachments.length > 0
      ? {
          metadata: atlasMessageMetadataNow(),
          parts: [
            { type: "text" as const, text },
            { type: "data-document-attachments" as const, data: { attachments } },
          ],
        }
      : { text, metadata: atlasMessageMetadataNow() };
    void sendMessage(message as Parameters<typeof sendMessage>[0]);
    setSelectedDocuments([]);
    setAttachmentError(null);
  };

  function uploadDocument(file: File | undefined) {
    if (!file || selectedDocuments.length >= 5) return;
    setAttachmentError(null);
    startUploadTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("file", file);
        formData.set("sessionId", activeSessionId);
        const uploaded = await uploadStudentAtlasDocument(formData);
        setActiveSessionId(uploaded.sessionId);
        if (props.threadId === "new") {
          window.history.replaceState(null, "", `/student/atlas?thread=${uploaded.sessionId}`);
        }
        setSelectedDocuments((current) => current.some((item) => item.fileId === uploaded.fileId)
          ? current
          : [...current, uploaded]);
      } catch (uploadError) {
        setAttachmentError(uploadError instanceof Error ? uploadError.message : "Atlas could not upload that document.");
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    });
  }

  const promptCheckpoints = useMemo(
    () => messages
      .filter((message) => message.role === "user")
      .map((message, index) => ({ id: message.id, label: promptCheckpointLabel(message, index) })),
    [messages]
  );

  const learnedThreadId = useMemo(
    () => threadIdFromMessages(messages) ?? (activeSessionId === "new" ? null : activeSessionId),
    [activeSessionId, messages]
  );
  const visibleThreads = useMemo(() => {
    if (!learnedThreadId) return props.threads;
    const firstUserMessage = messages.find((message) => message.role === "user");
    const firstText = firstUserTextFromParts(firstUserMessage?.parts) ?? "";
    const title = atlasChatTitleFromIntent(firstText, "New chat");
    const existing = props.threads.find((thread) => thread.id === learnedThreadId);
    if (existing) {
      return isDefaultAtlasChatTitle(existing.title) && firstText
        ? props.threads.map((thread) => thread.id === learnedThreadId ? { ...thread, title } : thread)
        : props.threads;
    }
    return [
      { id: learnedThreadId, title, userTurnCount: 1, updatedAt: new Date().toISOString() },
      ...props.threads,
    ];
  }, [learnedThreadId, messages, props.threads]);

  useEffect(() => {
    if (!learnedThreadId || props.threadId !== "new") return;
    window.history.replaceState(null, "", `/student/atlas?thread=${learnedThreadId}`);
  }, [learnedThreadId, props.threadId]);

  /*
   * Steering redirects the response in flight rather than queueing behind it.
   * A fresh chat learns its id mid-stream, so the note aims at whichever id
   * the thread has by the time it is typed.
   */
  const steering = useSteering({
    threadId: learnedThreadId ?? (activeSessionId === "new" ? null : activeSessionId),
    messages,
    sendAsTurn: sendStudentMessage,
  });
  useEffect(() => {
    settleSteeringRef.current = steering.settleAfterRun;
  }, [steering.settleAfterRun]);

  const activeThreadTitle =
    visibleThreads.find((thread) => thread.id === (learnedThreadId ?? props.threadId))?.title ?? props.threadTitle;
  const busy = status === "submitted" || status === "streaming";
  const activeChatId = learnedThreadId ?? props.threadId;
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
            {activeChatId !== "new" ? (
              <form action={archiveStudentAtlasChat}>
                <input type="hidden" name="chatId" value={activeChatId} />
                <button type="submit" disabled={busy} aria-label="Archive chat" title="Archive chat" className="inline-flex size-8 items-center justify-center rounded-control text-[var(--color-muted)] transition hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)]">
                  <Archive size={15} aria-hidden />
                </button>
              </form>
            ) : null}
            <Link href="/student/atlas?thread=new" aria-label="New chat" title="New chat" className="inline-flex size-8 items-center justify-center rounded-control text-[var(--color-muted)] transition hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)]">
              <Plus size={16} aria-hidden />
            </Link>
            <button type="button" onClick={() => updateRail(!railOpen)} aria-label={railOpen ? "Close chats" : "Open chats"} aria-expanded={railOpen} title={railOpen ? "Close chats" : "Chats"} className="inline-flex size-8 items-center justify-center rounded-control text-[var(--color-muted)] transition hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)]">
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
                      <Suggestion suggestion="What is due this week?" onClick={sendStudentMessage} />
                      {props.firstCourse ? (
                        <Suggestion suggestion={`Where am I losing points in ${props.firstCourse.code}?`} onClick={sendStudentMessage} />
                      ) : null}
                      <Suggestion suggestion="Plan my studying for the next two weeks." onClick={sendStudentMessage} />
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
                      <StudentMessageParts
                        message={message}
                        streaming={busy && index === messages.length - 1 && message.role === "assistant"}
                        onToolApproval={({ id, approved }) => void addToolApprovalResponse({ id, approved })}
                      />
                    </MessageContent>
                    {/* No clock on an answer still being written. */}
                    <MessageTimestamp
                      createdAt={message.metadata?.createdAt}
                      pending={busy && index === messages.length - 1 && message.role === "assistant"}
                    />
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
            {attachmentError ? <p role="alert" className="mb-2 text-[0.78125rem] leading-5 text-[var(--color-danger)]">{attachmentError}</p> : null}
            {steering.error ? <p role="alert" className="mb-2 text-[0.78125rem] leading-5 text-[var(--color-danger)]">{steering.error}</p> : null}
            <SteeringPending notes={steering.notes} />
            {selectedDocuments.length > 0 ? (
              <ul className="mb-2 flex flex-wrap gap-1.5" aria-label="Documents for this message">
                {selectedDocuments.map((document) => (
                  <li key={document.fileId} className="inline-flex max-w-full items-center gap-1.5 rounded-control border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-[0.71875rem] text-[var(--color-muted)]">
                    <FileText size={12} aria-hidden className="shrink-0" />
                    <span className="max-w-[16rem] truncate">{document.displayName}</span>
                    <span className="text-[var(--color-faint)]">{statusLabelForDocument(document.processingStatus)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <input
              ref={fileInputRef}
              type="file"
              accept={documentAccept}
              className="sr-only"
              onChange={(event) => uploadDocument(event.currentTarget.files?.[0])}
            />
            <PromptInput className="min-h-[3.25rem] flex-row items-end overflow-hidden shadow-[var(--shadow-floating)]" onSubmit={(message, event) => {
              const text = message.text.trim();
              if (!text) return;
              if (busy) {
                /* Redirect the response in flight rather than lining up behind it. */
                void steering.steer(text);
              } else {
                sendStudentMessage(text);
              }
              const form = event.currentTarget;
              form.reset();
              const field = form.querySelector("textarea");
              if (field) field.style.height = "auto";
            }}>
              <PromptInputButton
                disabled={busy || uploadPending || selectedDocuments.length >= 5}
                onClick={() => fileInputRef.current?.click()}
                aria-label="Attach document"
                aria-busy={uploadPending}
                title={selectedDocuments.length >= 5 ? "Five documents maximum" : uploadPending ? "Uploading document" : "Attach document"}
                className="mb-1.5 ml-1.5 size-9 shrink-0 justify-center rounded-full px-0 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus size={16} aria-hidden />
              </PromptInputButton>
              <PromptInputTextarea className="min-h-[3.125rem] w-auto min-w-0 flex-1 px-1.5 py-[0.8125rem]" placeholder={busy ? "Redirect Atlas..." : "Ask Atlas..."} autoFocus />
              <PromptInputToolbar className="shrink-0 justify-end gap-0.5 px-1.5 py-1.5">
                <PromptInputTools>
                  <VoiceTranscriptionButton onError={setVoiceError} onStateChange={setVoiceState} />
                </PromptInputTools>
                <PromptInputSubmit disabled={voiceState !== "idle" || uploadPending} status={status} allowSubmitWhileBusy className="rounded-full" />
              </PromptInputToolbar>
            </PromptInput>
          </div>
        </div>
      </section>

      {railOpen ? <button type="button" aria-label="Close chats" className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => updateRail(false)} /> : null}
      <aside aria-hidden={!railOpen} inert={!railOpen} className={cn("fixed inset-y-0 right-0 z-40 flex w-[min(22rem,92vw)] flex-col overflow-hidden border-l bg-[var(--color-surface)] shadow-[var(--shadow-floating)] transition-[transform,opacity,width,border-color] duration-[220ms] ease-out lg:static lg:z-auto lg:translate-x-0 lg:shadow-none", railOpen ? "translate-x-0 border-[var(--color-border)] opacity-100 lg:w-[21rem]" : "pointer-events-none translate-x-full border-transparent opacity-0 lg:w-0 lg:translate-x-0")}>
        <div className="flex h-14 w-[min(21rem,92vw)] shrink-0 items-center justify-between border-b border-[var(--color-border)] px-3">
          <p className="px-2 text-[0.75rem] font-medium text-[var(--color-ink)]">Chats</p>
          <button type="button" onClick={() => updateRail(false)} aria-label="Close chats" className="inline-flex size-8 items-center justify-center rounded-control text-[var(--color-muted)] transition hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]"><PanelRightClose size={15} aria-hidden /></button>
        </div>
        <div className="min-h-0 w-[min(21rem,92vw)] flex-1 overflow-y-auto px-3 py-3">
          <ThreadsPanel threads={visibleThreads} activeId={learnedThreadId ?? props.threadId} busy={busy} />
        </div>
      </aside>
    </div>
  );
}

function StudentMessageParts({
  message,
  streaming,
  onToolApproval,
}: {
  message: UIMessage;
  streaming: boolean;
  onToolApproval: (approval: { id: string; approved: boolean }) => void;
}) {
  const renderDataPart = (part: LoosePart, { index }: { index: number }) => {
    const type = String(part.type ?? "");
    if (type === "data-document-attachments") {
      const data = part.data as { attachments?: StudentDocumentAttachment[] } | undefined;
      const attachments = Array.isArray(data?.attachments) ? data.attachments : [];
      return attachments.length > 0 ? <MessageDocumentAttachments key={`documents-${index}`} attachments={attachments} /> : null;
    }
    return undefined;
  };

  const renderToolResult = (part: LoosePart, { index }: { index: number }) => {
    if (isActionResult(part) && part.state === "output-available") {
      const summary = actionSummary(part);
      return summary ? <ActionReceipt key={`action-${index}`} summary={summary} /> : null;
    }
    return undefined;
  };

  return (
    <AtlasMessageParts
      message={message}
      streaming={streaming}
      toolTitle={toolLabel}
      renderDataPart={renderDataPart}
      renderToolResult={renderToolResult}
      onToolApproval={onToolApproval}
    />
  );
}

function MessageDocumentAttachments({ attachments }: { attachments: StudentDocumentAttachment[] }) {
  return (
    <ul className="flex max-w-[42rem] flex-wrap gap-1.5">
      {attachments.map((document) => (
        <li key={document.attachmentId}>
          <Link href={`/student/documents/${document.fileId}`} className="inline-flex max-w-[20rem] items-center gap-1.5 rounded-control border border-[var(--color-border)] px-2 py-1 text-[0.71875rem] text-[var(--color-muted)] transition hover:border-[var(--color-border-strong)] hover:text-[var(--color-ink)]">
            <FileText size={12} aria-hidden className="shrink-0" />
            <span className="truncate">{document.displayName}</span>
            <span className="text-[var(--color-faint)]">{statusLabelForDocument(document.processingStatus)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function statusLabelForDocument(status: StudentDocumentAttachment["processingStatus"]) {
  return { queued: "Queued", processing: "Processing", ready: "Ready", failed: "Failed" }[status];
}

function ActionReceipt({ summary }: { summary: string }) {
  return (
    <div className="flex max-w-[42rem] items-start gap-2 border-l-2 border-[var(--color-good)] py-1 pl-3 text-[0.78125rem] leading-5 text-[var(--color-muted)]">
      <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-[var(--color-good)]" aria-hidden />
      <span>{summary}</span>
    </div>
  );
}

function ThreadsPanel({ threads, activeId, busy }: { threads: StudentThreadRef[]; activeId: string; busy: boolean }) {
  if (threads.length === 0) {
    return (
      <div className="px-2 py-8 text-center">
        <History size={18} className="mx-auto text-[var(--color-faint)]" aria-hidden />
        <p className="mt-2 text-[0.75rem] text-[var(--color-muted)]">No chats.</p>
      </div>
    );
  }
  return (
    <ul className="space-y-0.5">
      {threads.map((thread) => {
        const active = thread.id === activeId;
        return (
          <ChatThreadRow
            key={thread.id}
            id={thread.id}
            title={thread.title}
            href={`/student/atlas?thread=${thread.id}`}
            active={active}
            archiveAction={archiveStudentAtlasChatFromList}
            activeChatId={activeId}
            archiveDisabled={active && busy}
          />
        );
      })}
    </ul>
  );
}

const documentAccept = ".pdf,.doc,.docx,.docm,.ppt,.pps,.pot,.pptx,.pptm,.ppsx,.ppsm,.xls,.xlsx,.xlsm,.xlsb,.odt,.ods,.odp,.rtf,.epub,.csv,.txt,.md,.xml,.json,.jsonl,.yaml,.yml,.html,.css,.js,.jsx,.ts,.tsx,.mjs,.cjs,.py,.java,.c,.cc,.cpp,.h,.hpp,.go,.rs,.rb,.php,.swift,.kt,.kts,.sql,.sh,.zsh,.bash";
