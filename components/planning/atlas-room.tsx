"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { type UIMessage } from "ai";
import { WorkflowChatTransport } from "@ai-sdk/workflow";
import {
  CheckCircle2,
  Archive,
  FileCheck2,
  FileText,
  History,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageTimestamp } from "@/components/ai-elements/message";
import { AtlasMessageParts, type AtlasLoosePart } from "@/components/agent/message-parts";
import { Markdown } from "@/components/agent/markdown";
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
import { SteeringMark, SteeringPending } from "@/components/ai-elements/steering";
import { useSteering } from "@/components/ai-elements/use-steering";
import { AtlasMark, StatusBadge, TextLink } from "@/components/atlas/primitives";
import { RubricCard } from "@/components/planning/rubric-card";
import type { RubricCriterion } from "@/lib/agent/session-parts";
import { archiveProfessorAtlasChat, archiveProfessorAtlasChatFromList } from "@/lib/agent/chat-actions";
import { atlasMessageMetadataNow, type AtlasMessageMetadata } from "@/lib/agent/ui-message";
import type { ProfessorDocumentAttachment } from "@/lib/agent/professor-runtime";
import { uploadProfessorChatDocument } from "@/lib/instructor/document-actions";
import { decideCourseProposalInline, loadCourseProposalDetailsInline } from "@/lib/instructor/actions";
import type { Block } from "@/lib/agent/blocks";
import { atlasChatTitleFromIntent, firstUserTextFromParts, isDefaultAtlasChatTitle } from "@/lib/agent/chat-title";

type PlanningChatMessage = UIMessage<AtlasMessageMetadata>;

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
  status: "pending" | "approved" | "rejected" | "applied" | "superseded";
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
  initialMessages: PlanningChatMessage[];
  activeRunId: string | null;
  threads: PlanningThreadRef[];
  drafts: PlanningDraftRef[];
  work: PlanningWorkRef[];
  pendingProposals: number;
  /** Optional composer seed from a direct course workflow. Never auto-submitted. */
  initialInput?: string;
};

const STATUS_TONE = { pending: "accent", approved: "good", rejected: "neutral", applied: "good", superseded: "neutral" } as const;
const STATUS_LABEL = { pending: "Ready", approved: "Approved", rejected: "Dismissed", applied: "Applied", superseded: "Superseded" } as const;

type LoosePart = AtlasLoosePart;


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
  revision?: number;
};

type CourseDraftOutput = {
  ok: true;
  proposalId: string;
  summary: string;
  revision?: number;
  records: Array<{ type: string; title: string }>;
};

type AiAssignmentDraftOutput = {
  ok: true;
  proposalId: string;
  assignmentId: string;
  assignmentName: string;
  instructions: string;
  durationMinutes: number;
  criteria: RubricCriterion[];
  usedStandardFrame: boolean;
  note: string | null;
  revision?: number;
};

type CourseAgentDraftOutput = {
  ok: true;
  proposalId: string;
  revision: number;
  name: string;
  changeSummary: string;
  studentDisclosure: string;
  voice: string;
  approach: string;
};

type CourseGuidanceDraftOutput = {
  ok: true;
  proposalId: string;
  revision: number;
  summary: string;
  directives: Array<{
    key: string;
    title: string;
    instruction: string;
    effect: string;
    selectors: { audiences: string[]; surfaces: string[]; assignmentIds: string[]; tags: string[] };
    enabled: boolean;
  }>;
};

type ProposalDetail =
  | { kind: "rubric"; draft: RubricDraftOutput }
  | { kind: "ai_assignment"; draft: AiAssignmentDraftOutput }
  | { kind: "course"; draft: CourseDraftOutput }
  | { kind: "course_agent"; draft: CourseAgentDraftOutput }
  | { kind: "course_guidance"; draft: CourseGuidanceDraftOutput };

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

function courseAgentOutputFrom(part: LoosePart): CourseAgentDraftOutput | { ok: false; error: string } | null {
  const output = outputObject(part);
  if (!output) return null;
  if (output.ok === false && typeof output.error === "string") return { ok: false, error: output.error };
  if (output.ok === true && typeof output.proposalId === "string" && typeof output.changeSummary === "string") {
    return output as unknown as CourseAgentDraftOutput;
  }
  return null;
}

function courseGuidanceOutputFrom(part: LoosePart): CourseGuidanceDraftOutput | { ok: false; error: string } | null {
  const output = outputObject(part);
  if (!output) return null;
  if (output.ok === false && typeof output.error === "string") return { ok: false, error: output.error };
  if (output.ok === true && typeof output.proposalId === "string" && Array.isArray(output.directives)) {
    return output as unknown as CourseGuidanceDraftOutput;
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

const TOOL_TITLES: Record<string, string> = {
  "tool-inspect_lms": "Checking the course",
  "tool-read_gradebook": "Checking the gradebook",
  "tool-search_course": "Searching the course",
  "tool-search_web": "Searching the web",
  "tool-mutate_lms": "Updating the LMS",
  "tool-load_skill": "Loading",
  "tool-draft_ai_assignment": "Preparing the AI assignment",
  "tool-draft_rubric": "Preparing the rubric",
  "tool-draft_course": "Preparing course work",
  "tool-configure_agent": "Preparing the course agent",
  "tool-inspect_course_guidance": "Checking course guidance",
  "tool-propose_course_guidance": "Preparing course guidance",
};

function toolLabel(part: LoosePart): string {
  const type = String(part.type ?? "");
  return TOOL_TITLES[type] ?? "Working";
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
  const router = useRouter();
  const initialThreadId = props.threadId;
  const [railOpen, setRailOpen] = useState(false);
  const [railView, setRailView] = useState<"threads" | "drafts" | "proposal">("threads");
  const [proposalDetail, setProposalDetail] = useState<ProposalDetail | null>(null);
  const [proposalDetailBlocks, setProposalDetailBlocks] = useState<Block[] | null>(null);
  const [proposalDetailError, setProposalDetailError] = useState<string | null>(null);
  const [proposalDetailPending, startProposalDetail] = useTransition();
  const [focusedProposal, setFocusedProposal] = useState<{ proposalId: string; summary: string } | null>(null);
  const [composerValue, setComposerValue] = useState(() => props.initialInput ?? "");
  const [proposalStatuses, setProposalStatuses] = useState<Record<string, PlanningDraftRef["status"]>>({});
  const [proposalError, setProposalError] = useState<string | null>(null);
  const [proposalDecisionPending, startProposalDecision] = useTransition();
  const [voiceState, setVoiceState] = useState<VoiceTranscriptionState>("idle");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [selectedDocuments, setSelectedDocuments] = useState<ProfessorDocumentAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [uploadPending, startUploadTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const resumedRunIdRef = useRef<string | null>(null);

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
  const settleSteeringRef = useRef<() => void>(() => {});
  const transport = useMemo(() => new WorkflowChatTransport<PlanningChatMessage>({
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

  const { messages, sendMessage, resumeStream, addToolApprovalResponse, status, error } = useChat<PlanningChatMessage>({
    id: `planning-${props.threadId}`,
    messages: props.initialMessages,
    transport,
    onError: (chatError) => console.error("Atlas planning stream failed", chatError),
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

  const sendPlanningMessage = (text: string) => {
    const attachments = selectedDocuments;
    const message = {
      metadata: atlasMessageMetadataNow(),
      parts: [
        { type: "text" as const, text },
        ...(attachments.length > 0
          ? [{ type: "data-document-attachments" as const, data: { attachments } }]
          : []),
        ...(focusedProposal
          ? [{ type: "data-proposal-context" as const, data: focusedProposal }]
          : []),
      ],
    };
    void sendMessage(message as Parameters<typeof sendMessage>[0]);
    setSelectedDocuments([]);
    setFocusedProposal(null);
    setComposerValue("");
    setAttachmentError(null);
  };

  function keepEditing(proposalId: string, summary: string) {
    setFocusedProposal({ proposalId, summary });
    setComposerValue("");
    requestAnimationFrame(() => composerRef.current?.focus());
  }

  function showProposalDetails(detail: ProposalDetail) {
    setProposalDetail(detail);
    setProposalDetailBlocks(null);
    setProposalDetailError(null);
    setRailView("proposal");
    updateRail(true);
    startProposalDetail(async () => {
      const result = await loadCourseProposalDetailsInline(detail.draft.proposalId);
      if (!result.ok) {
        setProposalDetailError(result.error);
        return;
      }
      setProposalDetailBlocks(result.blocks);
    });
  }

  function decideProposal(proposalId: string, decision: "approved" | "rejected") {
    setProposalError(null);
    startProposalDecision(async () => {
      const result = await decideCourseProposalInline({ proposalId, decision });
      if (!result.ok) {
        setProposalError(result.error);
        return;
      }
      setProposalStatuses((current) => ({ ...current, [proposalId]: result.status }));
      router.refresh();
    });
  }

  function uploadDocument(file: File | undefined) {
    if (!file || selectedDocuments.length >= 5) return;
    setAttachmentError(null);
    startUploadTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("file", file);
        const uploaded = await uploadProfessorChatDocument(formData);
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

  const learnedThreadId = useMemo(() => threadIdFromMessages(messages), [messages]);
  const visibleThreads = useMemo(() => {
    const firstUserMessage = messages.find((message) => message.role === "user");
    const firstText = firstUserTextFromParts(firstUserMessage?.parts) ?? "";
    const title = atlasChatTitleFromIntent(firstText, "New chat");
    const targetId = learnedThreadId ?? (props.threadId !== "new" ? props.threadId : null);
    if (!targetId) return props.threads;
    const existing = props.threads.find((thread) => thread.id === targetId);
    if (existing) {
      return isDefaultAtlasChatTitle(existing.title) && firstText
        ? props.threads.map((thread) => thread.id === targetId ? { ...thread, title } : thread)
        : props.threads;
    }
    const contextPart = messages.flatMap((message) => message.parts as LoosePart[]).find((part) => part.type === "data-run-context");
    const context = contextPart?.data as RunContext | undefined;
    return [{ id: targetId, title, userTurnCount: 1, draftCount: 0, decidedCount: 0, updatedAt: context?.builtAt ?? new Date(0).toISOString() }, ...props.threads];
  }, [learnedThreadId, messages, props.threadId, props.threads]);

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
        } else if (type === "tool-configure_agent") {
          const output = courseAgentOutputFrom(part);
          if (output?.ok && !byId.has(output.proposalId)) {
            byId.set(output.proposalId, { proposalId: output.proposalId, status: "pending", kind: "course", summary: output.changeSummary, createdAt: context?.builtAt ?? new Date(0).toISOString() });
          }
        } else if (type === "tool-propose_course_guidance") {
          const output = courseGuidanceOutputFrom(part);
          if (output?.ok && !byId.has(output.proposalId)) {
            byId.set(output.proposalId, { proposalId: output.proposalId, status: "pending", kind: "course", summary: output.summary, createdAt: context?.builtAt ?? new Date(0).toISOString() });
          }
        }
      }
    }
    return [...byId.values()]
      .map((draft) => ({ ...draft, status: proposalStatuses[draft.proposalId] ?? draft.status }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [messages, proposalStatuses, props.drafts]);

  useEffect(() => {
    if (!learnedThreadId || props.threadId !== "new") return;
    window.history.replaceState(null, "", `/teach/atlas?thread=${learnedThreadId}`);
  }, [learnedThreadId, props.threadId]);

  /*
   * Steering redirects the response in flight instead of queueing behind it.
   * A fresh chat learns its id mid-stream, so the note is aimed at whichever
   * id the thread has by the time it is typed.
   */
  const steering = useSteering({
    threadId: learnedThreadId ?? (props.threadId === "new" ? null : props.threadId),
    messages,
    sendAsTurn: sendPlanningMessage,
  });
  useEffect(() => {
    settleSteeringRef.current = steering.settleAfterRun;
  }, [steering.settleAfterRun]);

  const statusByProposal = useMemo(() => {
    const map = new Map<string, PlanningDraftRef["status"]>();
    for (const draft of props.drafts) map.set(draft.proposalId, draft.status);
    for (const [proposalId, proposalStatus] of Object.entries(proposalStatuses)) map.set(proposalId, proposalStatus);
    return map;
  }, [proposalStatuses, props.drafts]);

  const activeThreadTitle = visibleThreads.find((thread) => thread.id === (learnedThreadId ?? props.threadId))?.title ?? props.threadTitle;
  const storedDraftIds = new Set(props.drafts.map((draft) => draft.proposalId));
  const pendingReviewCount = props.pendingProposals + visibleDrafts.filter((draft) => draft.status === "pending" && !storedDraftIds.has(draft.proposalId)).length;
  const busy = status === "submitted" || status === "streaming";
  const activeChatId = learnedThreadId ?? props.threadId;
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
              <button type="button" onClick={() => { setRailView("drafts"); updateRail(true); }} className="mr-1 hidden rounded-control px-2 py-1 text-[0.75rem] font-medium text-[var(--color-muted)] transition hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)] sm:inline-flex">
                Drafts {pendingReviewCount}
              </button>
            ) : null}
            {activeChatId !== "new" ? (
              <form action={archiveProfessorAtlasChat}>
                <input type="hidden" name="chatId" value={activeChatId} />
                <button type="submit" disabled={busy} aria-label="Archive chat" title="Archive chat" className="inline-flex size-8 items-center justify-center rounded-control text-[var(--color-muted)] transition hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)]">
                  <Archive size={15} aria-hidden />
                </button>
              </form>
            ) : null}
            <Link href="/teach/atlas?thread=new" aria-label="New chat" title="New chat" className="inline-flex size-8 items-center justify-center rounded-control text-[var(--color-muted)] transition hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)]">
              <Plus size={16} aria-hidden />
            </Link>
            <button type="button" onClick={() => updateRail(!railOpen)} aria-label={railOpen ? "Close Atlas sidebar" : "Open Atlas sidebar"} aria-expanded={railOpen} title={railOpen ? "Close sidebar" : "Chats and drafts"} className="inline-flex size-8 items-center justify-center rounded-control text-[var(--color-muted)] transition hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)]">
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
                      <Suggestion suggestion="What is the grade distribution for this class?" onClick={sendPlanningMessage} />
                      <Suggestion suggestion="How is Aman Dutta doing?" onClick={sendPlanningMessage} />
                      {firstWork ? <Suggestion suggestion={`Revise the rubric for ${firstWork.name}.`} onClick={sendPlanningMessage} /> : null}
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
                      <PlanningMessageParts
                        message={message}
                        streaming={busy && index === messages.length - 1 && message.role === "assistant"}
                        statusByProposal={statusByProposal}
                        onApply={(proposalId) => decideProposal(proposalId, "approved")}
                        onDismiss={(proposalId) => decideProposal(proposalId, "rejected")}
                        onKeepEditing={keepEditing}
                        onDetails={showProposalDetails}
                        decisionPending={proposalDecisionPending || busy}
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
            {proposalError ? <p role="alert" className="mb-2 text-[0.78125rem] leading-5 text-[var(--color-danger)]">{proposalError}</p> : null}
            {steering.error ? <p role="alert" className="mb-2 text-[0.78125rem] leading-5 text-[var(--color-danger)]">{steering.error}</p> : null}
            <SteeringPending notes={steering.notes} />
            {focusedProposal ? (
              <div className="mb-2 inline-flex max-w-full items-center gap-2 rounded-control border border-[var(--color-accent-soft)] bg-[var(--color-surface)] px-2.5 py-1.5 text-[0.75rem] text-[var(--color-muted)]">
                <span className="truncate"><span className="font-medium text-[var(--color-ink)]">Editing:</span> {focusedProposal.summary}</span>
                <button type="button" onClick={() => setFocusedProposal(null)} aria-label="Stop editing this draft" className="inline-flex size-5 shrink-0 items-center justify-center rounded-full hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]"><X size={11} aria-hidden /></button>
              </div>
            ) : null}
            {selectedDocuments.length > 0 ? (
              <ul className="mb-2 flex flex-wrap gap-1.5" aria-label="Documents for this message">
                {selectedDocuments.map((document) => (
                  <li key={document.fileId} className="inline-flex max-w-full items-center gap-1.5 rounded-control border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-[0.71875rem] text-[var(--color-muted)]">
                    <FileText size={12} aria-hidden className="shrink-0" />
                    <span className="max-w-[16rem] truncate">{document.displayName}</span>
                    <span className="text-[var(--color-faint)]">{statusLabelForDocument(document.processingStatus)}</span>
                    <button type="button" onClick={() => setSelectedDocuments((current) => current.filter((item) => item.fileId !== document.fileId))} aria-label={`Remove ${document.displayName}`} className="inline-flex size-5 items-center justify-center rounded-full hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]">
                      <X size={11} aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.docm,.ppt,.pps,.pot,.pptx,.pptm,.ppsx,.ppsm,.xls,.xlsx,.xlsm,.xlsb,.odt,.ods,.odp,.rtf,.epub,.csv,.txt,.md,.xml,.json,.jsonl,.yaml,.yml,.html,.css,.js,.jsx,.ts,.tsx,.mjs,.cjs,.py,.java,.c,.cc,.cpp,.h,.hpp,.go,.rs,.rb,.php,.swift,.kt,.kts,.sql,.sh,.zsh,.bash"
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
                sendPlanningMessage(text);
              }
              setComposerValue("");
              event.currentTarget.reset();
              if (composerRef.current) composerRef.current.style.height = "auto";
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
              <PromptInputTextarea ref={composerRef} value={composerValue} onChange={(event) => setComposerValue(event.currentTarget.value)} className="min-h-[3.125rem] w-auto min-w-0 flex-1 px-1.5 py-[0.8125rem]" placeholder={busy ? "Redirect Atlas..." : focusedProposal ? "Tell Atlas what to change..." : "Ask Atlas..."} autoFocus />
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

      {railOpen ? <button type="button" aria-label="Close Atlas sidebar" className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => updateRail(false)} /> : null}
      <aside aria-hidden={!railOpen} inert={!railOpen} className={cn("fixed inset-y-0 right-0 z-40 flex w-[min(22rem,92vw)] flex-col overflow-hidden border-l bg-[var(--color-surface)] shadow-[var(--shadow-floating)] transition-[transform,opacity,width,border-color] duration-[220ms] ease-out lg:static lg:z-auto lg:translate-x-0 lg:shadow-none", railOpen ? "translate-x-0 border-[var(--color-border)] opacity-100 lg:w-[21rem]" : "pointer-events-none translate-x-full border-transparent opacity-0 lg:w-0 lg:translate-x-0")}>
        <div className="flex h-14 w-[min(21rem,92vw)] shrink-0 items-center justify-between border-b border-[var(--color-border)] px-3">
          <div className="flex items-center gap-1">
            {railView === "proposal" ? (
              <button type="button" onClick={() => setRailView("drafts")} className="rounded-control px-2.5 py-1.5 text-[0.75rem] font-medium text-[var(--color-muted)] transition hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]">Back to drafts</button>
            ) : (
              <>
                <button type="button" onClick={() => setRailView("threads")} className={cn("rounded-control px-2.5 py-1.5 text-[0.75rem] font-medium transition", railView === "threads" ? "bg-[var(--color-surface-muted)] text-[var(--color-ink)]" : "text-[var(--color-muted)] hover:text-[var(--color-ink)]")}>Chats</button>
                <button type="button" onClick={() => setRailView("drafts")} className={cn("rounded-control px-2.5 py-1.5 text-[0.75rem] font-medium transition", railView === "drafts" ? "bg-[var(--color-surface-muted)] text-[var(--color-ink)]" : "text-[var(--color-muted)] hover:text-[var(--color-ink)]")}>Drafts{visibleDrafts.length > 0 ? ` ${visibleDrafts.length}` : ""}</button>
              </>
            )}
          </div>
          <button type="button" onClick={() => updateRail(false)} aria-label="Close Atlas sidebar" className="inline-flex size-8 items-center justify-center rounded-control text-[var(--color-muted)] transition hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]"><PanelRightClose size={15} aria-hidden /></button>
        </div>
        <div className="min-h-0 w-[min(21rem,92vw)] flex-1 overflow-y-auto px-3 py-3">
          {railView === "threads" ? (
            <ThreadsPanel threads={visibleThreads} activeId={learnedThreadId ?? props.threadId} busy={busy} />
          ) : railView === "proposal" && proposalDetail ? (
            <ProposalDetails detail={proposalDetail} blocks={proposalDetailBlocks} pending={proposalDetailPending} error={proposalDetailError} />
          ) : (
            <ThreadDraftsPanel drafts={visibleDrafts} pendingProposals={pendingReviewCount} />
          )}
        </div>
      </aside>
    </div>
  );
}

function PlanningMessageParts({
  message,
  streaming,
  statusByProposal,
  onApply,
  onDismiss,
  onKeepEditing,
  onDetails,
  decisionPending,
  onToolApproval,
}: {
  message: UIMessage;
  streaming: boolean;
  statusByProposal: Map<string, PlanningDraftRef["status"]>;
  onApply: (proposalId: string) => void;
  onDismiss: (proposalId: string) => void;
  onKeepEditing: (proposalId: string, summary: string) => void;
  onDetails: (detail: ProposalDetail) => void;
  decisionPending: boolean;
  onToolApproval: (approval: { id: string; approved: boolean }) => void;
}) {
  const renderDataPart = (part: LoosePart, { index }: { index: number }) => {
    const type = String(part.type ?? "");
    if (type === "data-document-attachments") {
      const data = part.data as { attachments?: ProfessorDocumentAttachment[] } | undefined;
      const attachments = Array.isArray(data?.attachments) ? data.attachments : [];
      return attachments.length > 0 ? <MessageDocumentAttachments key={`documents-${index}`} attachments={attachments} /> : null;
    }
    if (type === "data-proposal-context") return null;
    /* Show the redirection where it landed, so the change of course is legible. */
    if (type === "data-steering-applied") {
      const data = part.data as { notes?: unknown } | undefined;
      const notes = Array.isArray(data?.notes) ? data.notes.filter((note): note is string => typeof note === "string") : [];
      return notes.length > 0 ? <SteeringMark key={`steering-${index}`} notes={notes} /> : null;
    }
    return undefined;
  };

  const renderToolResult = (part: LoosePart, { index }: { index: number }) => {
    if (isActionResult(part) && part.state === "output-available") {
      const summary = actionSummary(part);
      return summary ? <ActionReceipt key={`action-${index}`} summary={summary} /> : null;
    }

    const type = String(part.type ?? "");
    if (type === "tool-draft_ai_assignment") {
      const output = aiAssignmentOutputFrom(part);
      return output?.ok ? <AiAssignmentDraftCard key={`draft-${index}`} draft={output} status={statusByProposal.get(output.proposalId) ?? "pending"} onApply={onApply} onDismiss={onDismiss} onKeepEditing={onKeepEditing} onDetails={onDetails} decisionPending={decisionPending} /> : null;
    }

    if (type === "tool-draft_rubric") {
      const output = rubricOutputFrom(part);
      return output?.ok ? <RubricDraftCard key={`draft-${index}`} draft={output} status={statusByProposal.get(output.proposalId) ?? "pending"} onApply={onApply} onDismiss={onDismiss} onKeepEditing={onKeepEditing} onDetails={onDetails} decisionPending={decisionPending} /> : null;
    }

    if (type === "tool-draft_course") {
      const output = courseDraftOutputFrom(part);
      return output?.ok ? <CourseDraftCard key={`draft-${index}`} draft={output} status={statusByProposal.get(output.proposalId) ?? "pending"} onApply={onApply} onDismiss={onDismiss} onKeepEditing={onKeepEditing} onDetails={onDetails} decisionPending={decisionPending} /> : null;
    }
    if (type === "tool-configure_agent") {
      const output = courseAgentOutputFrom(part);
      return output?.ok ? <CourseAgentDraftCard key={`draft-${index}`} draft={output} status={statusByProposal.get(output.proposalId) ?? "pending"} onApply={onApply} onDismiss={onDismiss} onKeepEditing={onKeepEditing} onDetails={onDetails} decisionPending={decisionPending} /> : null;
    }
    if (type === "tool-propose_course_guidance") {
      const output = courseGuidanceOutputFrom(part);
      return output?.ok ? <CourseGuidanceDraftCard key={`draft-${index}`} draft={output} status={statusByProposal.get(output.proposalId) ?? "pending"} onApply={onApply} onDismiss={onDismiss} onKeepEditing={onKeepEditing} onDetails={onDetails} decisionPending={decisionPending} /> : null;
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

function MessageDocumentAttachments({ attachments }: { attachments: ProfessorDocumentAttachment[] }) {
  return (
    <ul className="flex max-w-[42rem] flex-wrap gap-1.5">
      {attachments.map((document) => (
        <li key={document.attachmentId}>
          <Link href={`/teach/documents/${document.fileId}`} className="inline-flex max-w-[20rem] items-center gap-1.5 rounded-control border border-[var(--color-border)] px-2 py-1 text-[0.71875rem] text-[var(--color-muted)] transition hover:border-[var(--color-border-strong)] hover:text-[var(--color-ink)]">
            <FileText size={12} aria-hidden className="shrink-0" />
            <span className="truncate">{document.displayName}</span>
            <span className="text-[var(--color-faint)]">{statusLabelForDocument(document.processingStatus)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function statusLabelForDocument(status: ProfessorDocumentAttachment["processingStatus"]) {
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

type DraftActions = {
  status: PlanningDraftRef["status"];
  onApply: (proposalId: string) => void;
  onDismiss: (proposalId: string) => void;
  onKeepEditing: (proposalId: string, summary: string) => void;
  onDetails: (detail: ProposalDetail) => void;
  decisionPending: boolean;
};

function DraftFrame({
  eyebrow,
  title,
  summary,
  facts,
  proposalId,
  detail,
  status,
  onApply,
  onDismiss,
  onKeepEditing,
  onDetails,
  decisionPending,
}: DraftActions & {
  eyebrow: string;
  title: string;
  summary: string;
  facts: string[];
  proposalId: string;
  detail: ProposalDetail;
}) {
  return (
    <section className="my-1 w-full max-w-[42rem] overflow-hidden rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-3.5 py-2.5">
        <p className="atlas-mono flex items-center gap-1.5 text-[0.65625rem] uppercase tracking-[0.08em] text-[var(--color-faint)]"><FileCheck2 size={11} aria-hidden />{eyebrow}</p>
        <div className="shrink-0">
          <StatusBadge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</StatusBadge>
        </div>
      </div>
      <div className="px-3.5 py-3">
        <h3 className="text-[0.84375rem] font-semibold leading-5 text-[var(--color-ink)]">{title}</h3>
        <p className="mt-1 line-clamp-2 text-[0.78125rem] leading-5 text-[var(--color-muted)]">{summary}</p>
        {facts.length > 0 ? <p className="atlas-mono mt-2 text-[0.65625rem] uppercase tracking-[0.06em] text-[var(--color-faint)]">{facts.join(" / ")}</p> : null}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 border-t border-[var(--color-border)] px-3 py-2.5">
        {status === "pending" ? (
          <>
            <button type="button" disabled={decisionPending} onClick={() => onApply(proposalId)} className="rounded-control bg-[var(--color-ink)] px-2.5 py-1.5 text-[0.71875rem] font-medium text-[var(--color-surface)] transition hover:opacity-85 disabled:opacity-50">Apply</button>
            <button type="button" disabled={decisionPending} onClick={() => onKeepEditing(proposalId, title)} className="rounded-control px-2.5 py-1.5 text-[0.71875rem] font-medium text-[var(--color-muted)] transition hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)] disabled:opacity-50">Keep editing</button>
            <button type="button" disabled={decisionPending} onClick={() => onDismiss(proposalId)} className="rounded-control px-2.5 py-1.5 text-[0.71875rem] font-medium text-[var(--color-muted)] transition hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-danger)] disabled:opacity-50">Dismiss</button>
          </>
        ) : null}
        <button type="button" onClick={() => onDetails(detail)} className="ml-auto rounded-control px-2.5 py-1.5 text-[0.71875rem] font-medium text-[var(--color-muted)] transition hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]">Details</button>
      </div>
    </section>
  );
}

function RubricDraftCard({ draft, ...actions }: { draft: RubricDraftOutput } & DraftActions) {
  return <DraftFrame {...actions} eyebrow="Rubric draft" title={`${draft.assignmentName}: ${draft.title}`} summary={draft.note || "A revised grading rubric is ready."} facts={[`${draft.criteria.length} criteria`, `replaces v${draft.replacesVersion}`, ...(draft.revision ? [`draft v${draft.revision}`] : [])]} proposalId={draft.proposalId} detail={{ kind: "rubric", draft }} />;
}

function AiAssignmentDraftCard({ draft, ...actions }: { draft: AiAssignmentDraftOutput } & DraftActions) {
  return <DraftFrame {...actions} eyebrow="AI assignment draft" title={draft.assignmentName} summary={draft.instructions} facts={[`${draft.durationMinutes} min`, `${draft.criteria.length} rubric criteria`, ...(draft.revision ? [`draft v${draft.revision}`] : [])]} proposalId={draft.proposalId} detail={{ kind: "ai_assignment", draft }} />;
}

function CourseDraftCard({ draft, ...actions }: { draft: CourseDraftOutput } & DraftActions) {
  return <DraftFrame {...actions} eyebrow="Course draft" title={draft.summary} summary={draft.records.slice(0, 3).map((record) => record.title).join(" · ")} facts={[`${draft.records.length} ${draft.records.length === 1 ? "record" : "records"}`, ...(draft.revision ? [`draft v${draft.revision}`] : [])]} proposalId={draft.proposalId} detail={{ kind: "course", draft }} />;
}

function CourseAgentDraftCard({ draft, ...actions }: { draft: CourseAgentDraftOutput } & DraftActions) {
  return <DraftFrame {...actions} eyebrow="Course agent draft" title={draft.changeSummary} summary={`${draft.name} will be ${draft.voice.toLocaleLowerCase("en-US")}. ${draft.approach}`} facts={[`draft v${draft.revision}`]} proposalId={draft.proposalId} detail={{ kind: "course_agent", draft }} />;
}

function CourseGuidanceDraftCard({ draft, ...actions }: { draft: CourseGuidanceDraftOutput } & DraftActions) {
  return <DraftFrame {...actions} eyebrow="Course guidance draft" title={draft.summary} summary={draft.directives.slice(0, 2).map((directive) => directive.title).join(" · ")} facts={[`${draft.directives.length} ${draft.directives.length === 1 ? "rule" : "rules"}`, `draft v${draft.revision}`]} proposalId={draft.proposalId} detail={{ kind: "course_guidance", draft }} />;
}

function ProposalDetails({ detail, blocks, pending, error }: { detail: ProposalDetail; blocks: Block[] | null; pending: boolean; error: string | null }) {
  if (pending) return <p className="px-1 py-6 text-[0.78125rem] text-[var(--color-muted)]">Loading draft details...</p>;
  if (error) return <p role="alert" className="px-1 py-6 text-[0.78125rem] leading-5 text-[var(--color-danger)]">{error}</p>;
  if (blocks) {
    return <div className="divide-y divide-[var(--color-border)]">{blocks.map((block, index) => <ProposalBlockDetails key={`${block.type}-${index}`} block={block} />)}</div>;
  }
  if (detail.kind === "rubric") {
    return <div className="space-y-3"><DetailHeading title={detail.draft.title} description={detail.draft.assignmentName} /><RubricCard criteria={detail.draft.criteria} compare={{ version: detail.draft.replacesVersion, criteria: detail.draft.replacesCriteria }} />{detail.draft.note ? <p className="text-[0.75rem] leading-5 text-[var(--color-muted)]">{detail.draft.note}</p> : null}</div>;
  }
  if (detail.kind === "ai_assignment") {
    return <div className="space-y-4"><DetailHeading title={detail.draft.assignmentName} description={`${detail.draft.durationMinutes} minute AI assignment`} /><p className="text-[0.8125rem] leading-6 text-[var(--color-muted)]">{detail.draft.instructions}</p><RubricCard title={detail.draft.usedStandardFrame ? "Rubric · standard frame" : "Rubric"} criteria={detail.draft.criteria} /></div>;
  }
  if (detail.kind === "course") {
    return <div><DetailHeading title={detail.draft.summary} description={`${detail.draft.records.length} proposed records`} /><ul className="mt-4 divide-y divide-[var(--color-border)]">{detail.draft.records.map((record, index) => <li key={`${record.type}-${index}`} className="py-3"><p className="text-[0.8125rem] font-medium text-[var(--color-ink)]">{record.title}</p><p className="mt-1 text-[0.6875rem] uppercase tracking-[0.06em] text-[var(--color-faint)]">{record.type.replaceAll("_", " ")}</p></li>)}</ul></div>;
  }
  if (detail.kind === "course_agent") {
    return <div><DetailHeading title={detail.draft.changeSummary} description={detail.draft.name} /><dl className="mt-4 space-y-4"><DetailFact label="Voice" value={detail.draft.voice} /><DetailFact label="Teaching approach" value={detail.draft.approach} /><DetailFact label="What students see" value={detail.draft.studentDisclosure} /></dl></div>;
  }
  return <div><DetailHeading title={detail.draft.summary} description={`${detail.draft.directives.length} standing guidance changes`} /><ul className="mt-4 divide-y divide-[var(--color-border)]">{detail.draft.directives.map((directive) => <li key={directive.key} className="py-4"><div className="flex items-baseline justify-between gap-2"><p className="text-[0.8125rem] font-medium text-[var(--color-ink)]">{directive.title}</p><span className="text-[0.65625rem] uppercase text-[var(--color-faint)]">{directive.effect}</span></div><p className="mt-1 text-[0.6875rem] text-[var(--color-faint)]">{directive.key}</p><p className="mt-2 text-[0.78125rem] leading-5 text-[var(--color-muted)]">{directive.instruction}</p></li>)}</ul></div>;
}

function ProposalBlockDetails({ block }: { block: Block }) {
  if (block.type === "course_agent_configuration") {
    return <section className="py-4"><DetailHeading title={block.changeSummary} description={`Course agent version ${block.expectedVersion + 1}`} /><dl className="mt-4 space-y-4"><DetailFact label="Name and role" value={`${block.configuration.identity.name}. ${block.configuration.identity.role}`} /><DetailFact label="Voice" value={block.configuration.identity.voice} /><DetailFact label="Teaching approach" value={block.configuration.teaching.approach} /><DetailFact label="Direct answers" value={block.configuration.teaching.directAnswers.replaceAll("_", " ")} /><DetailFact label="Supports" value={block.configuration.boundaries.supports.join(" · ") || "None"} /><DetailFact label="Avoids" value={block.configuration.boundaries.avoids.join(" · ") || "None"} /><DetailFact label="Escalates when" value={block.configuration.boundaries.escalatesWhen.join(" · ") || "None"} /><DetailFact label="What students see" value={block.studentDisclosure} /></dl></section>;
  }
  if (block.type === "course_guidance") {
    const scope = [...block.selectors.audiences, ...block.selectors.surfaces, ...block.selectors.tags].join(" · ") || "All applicable course contexts";
    return <section className="py-4"><DetailHeading title={block.title} description={`${block.key} · revision ${block.expectedRevision + 1}`} /><p className="mt-3 text-[0.8125rem] leading-6 text-[var(--color-muted)]">{block.instruction}</p><dl className="mt-4 space-y-3"><DetailFact label="Effect" value={block.effect} /><DetailFact label="Scope" value={scope} /><DetailFact label="State" value={block.enabled ? "Active" : "Off"} /></dl></section>;
  }
  if (block.type === "ai_assignment") {
    return <section className="py-4"><DetailHeading title={block.title} description={`${block.durationMinutes} minute AI assignment`} /><p className="mt-3 text-[0.8125rem] leading-6 text-[var(--color-muted)]">{block.instructions}</p><RubricCard title="Rubric" criteria={block.criteria} className="mt-4" /></section>;
  }
  if (block.type === "session_rubric") return <section className="py-4"><DetailHeading title={block.title} description={`${block.criteria.length} rubric criteria`} /><RubricCard criteria={block.criteria} className="mt-4" /></section>;
  if (block.type === "rubric") return <section className="py-4"><DetailHeading title={block.title} description={`${block.criteria.length} rubric criteria`} /><div className="mt-3 space-y-3">{block.criteria.map((criterion) => <div key={criterion.name}><p className="text-[0.78125rem] font-medium text-[var(--color-ink)]">{criterion.name} · {Math.round(criterion.weight * 100)}%</p><p className="mt-1 text-[0.75rem] leading-5 text-[var(--color-muted)]">{criterion.levels.map((level) => `${level.label}: ${level.description}`).join(" · ")}</p></div>)}</div></section>;
  if (block.type === "practice_set") return <section className="py-4"><DetailHeading title={block.title} description={`${block.questions.length} practice questions`} /><p className="mt-3 text-[0.78125rem] leading-5 text-[var(--color-muted)]">{block.base}</p><ol className="mt-3 list-decimal space-y-3 pl-5 text-[0.78125rem] leading-5 text-[var(--color-ink)]">{block.questions.map((question, index) => <li key={index}>{question.prompt}<p className="mt-1 text-[0.75rem] text-[var(--color-muted)]">Answer: {question.answer}</p></li>)}</ol></section>;
  if (block.type === "objective") return <section className="py-4"><DetailHeading title={`${block.code}: ${block.description}`} description={`${block.bloomLevel} · ${Math.round(block.assessmentWeight * 100)}% assessment weight`} /></section>;

  const title = block.type === "module" || block.type === "assignment" ? block.name : block.type === "explanation" ? block.headline : block.type === "answer" ? "Draft response" : block.title;
  const body = block.type === "announcement" ? block.messageMd : block.type === "page" ? block.bodyMd : block.type === "module" ? block.summaryMd : block.type === "assignment" ? block.descriptionMd : block.bodyMd;
  return <section className="py-4"><DetailHeading title={title} description={block.type.replaceAll("_", " ")} /><Markdown className="mt-3 text-[0.78125rem] leading-6">{body}</Markdown></section>;
}

function DetailHeading({ title, description }: { title: string; description: string }) {
  return <header><h2 className="text-[1rem] font-semibold leading-6 text-[var(--color-ink)]">{title}</h2><p className="mt-1 text-[0.75rem] text-[var(--color-muted)]">{description}</p></header>;
}

function DetailFact({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-[0.6875rem] text-[var(--color-faint)]">{label}</dt><dd className="mt-1 text-[0.78125rem] leading-5 text-[var(--color-muted)]">{value}</dd></div>;
}

function ThreadDraftsPanel({ drafts, pendingProposals }: { drafts: PlanningDraftRef[]; pendingProposals: number }) {
  if (drafts.length === 0) return <div className="px-2 py-8 text-center"><FileCheck2 size={18} className="mx-auto text-[var(--color-faint)]" aria-hidden /><p className="mt-2 text-[0.75rem] text-[var(--color-muted)]">No drafts in this chat.</p></div>;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between px-2"><p className="text-[0.6875rem] text-[var(--color-faint)]">This chat</p>{pendingProposals > 0 ? <TextLink href="/teach/review" className="text-[0.6875rem]">All course drafts</TextLink> : null}</div>
      <ul className="space-y-1">
        {drafts.map((draft) => <li key={draft.proposalId} className="flex items-start justify-between gap-3 px-2 py-3"><div className="min-w-0"><p className="text-[0.78125rem] leading-5 text-[var(--color-ink)]">{draft.summary}</p><p className="mt-0.5 text-[0.65625rem] text-[var(--color-faint)]">{new Date(draft.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p></div><StatusBadge tone={STATUS_TONE[draft.status]}>{STATUS_LABEL[draft.status]}</StatusBadge></li>)}
      </ul>
    </div>
  );
}

function ThreadsPanel({ threads, activeId, busy }: { threads: PlanningThreadRef[]; activeId: string; busy: boolean }) {
  if (threads.length === 0) return <div className="px-2 py-8 text-center"><History size={18} className="mx-auto text-[var(--color-faint)]" aria-hidden /><p className="mt-2 text-[0.75rem] text-[var(--color-muted)]">No chats.</p></div>;
  return (
    <ul className="space-y-0.5">
      {threads.map((thread) => {
        const active = thread.id === activeId;
        return (
          <ChatThreadRow
            key={thread.id}
            id={thread.id}
            title={thread.title}
            href={`/teach/atlas?thread=${thread.id}`}
            active={active}
            secondary={thread.draftCount > 0 ? `${thread.draftCount} draft${thread.draftCount === 1 ? "" : "s"}` : undefined}
            archiveAction={archiveProfessorAtlasChatFromList}
            activeChatId={activeId}
            archiveDisabled={active && busy}
          />
        );
      })}
    </ul>
  );
}
