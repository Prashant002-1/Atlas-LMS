import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
  type LanguageModel,
  type UIMessage,
} from "ai";
import type { AgentSession } from "@/lib/db/schema";
import { compactIfNeeded, loadActiveTurns, titleCommandSessionFromIntent, turnsToUIMessages } from "@/lib/agent/session";
import { persistSessionTurn } from "@/lib/agent/session-store";
import { loadAtlasHarness } from "@/lib/agent/atlas-harness";
import {
  buildProfessorInstructions,
  buildProfessorPack,
  buildProfessorReference,
  type ProfessorScope,
} from "@/lib/agent/professor-context";
import { professorOperatorTools } from "@/lib/agent/lms-operator";
import { courseAgentConfigurationTool, courseGuidanceTools } from "@/lib/agent/course-agent-tool";
import { personalMemoryTool } from "@/lib/agent/memories";
import type { AtlasMessageMetadata } from "@/lib/agent/ui-message";
import { loadReadyThreadDocumentContext } from "@/lib/course/documents";
import { governedWebSearchTools } from "@/lib/agent/web-search";
import { foldConsumedSteeringIntoTurn, steeringPrepareStep } from "@/lib/agent/steering";

/**
 * One professor turn on the durable AI SDK seam. The professor's input is a row
 * before generation, the current course snapshot is rebuilt for every turn,
 * tool and draft parts persist with the assistant response, and compaction runs
 * only after a complete response.
 */

export type ProfessorDocumentAttachment = {
  attachmentId: string;
  fileId: string;
  displayName: string;
  filename: string | null;
  processingStatus: "queued" | "processing" | "ready" | "failed";
};

export type ProfessorDataParts = {
  "planning-ref": { sessionId: string };
  "document-attachments": { attachments: ProfessorDocumentAttachment[] };
  "proposal-context": { proposalId: string; summary: string };
  /** Where a mid-run redirection actually reached the model. */
  "steering-applied": { notes: string[]; stepNumber: number };
  "run-context": {
    sessionId: string;
    builtAt: string;
    tokenEstimate: number;
    tools: number;
    skills: string[];
  };
};

export type ProfessorUIMessage = UIMessage<AtlasMessageMetadata, ProfessorDataParts>;

export async function runProfessorTurn(args: {
  session: AgentSession;
  scope: ProfessorScope;
  model: LanguageModel;
  userText: string;
  /** The route persists input before it starts a durable workflow run. */
  userTurnPersisted?: boolean;
  /**
   * The durable run this turn belongs to. Steering notes are recorded against
   * it, so the redirection reaches this response and cannot leak into a later
   * one.
   */
  runId?: string;
  focusedProposalId?: string;
}): Promise<Response> {
  const { session, scope } = args;

  if (!args.userTurnPersisted) {
    await titleCommandSessionFromIntent(session, args.userText);
    await persistSessionTurn(session, "user", [{ type: "text" as const, text: args.userText }]);
  }
  /*
   * The user turn that opened this run. Persisting mutates session.totalTurns
   * in place, and the route persists before starting the workflow, so this is
   * that turn's index on both paths. Steering notes fold back onto it.
   */
  const userTurnIndex = session.totalTurns;

  const [professorPack, harness, attachedDocuments] = await Promise.all([
    buildProfessorPack(scope),
    loadAtlasHarness(),
    loadReadyThreadDocumentContext({
      orgId: scope.orgId,
      courseId: scope.courseId,
      sessionId: session.id,
      userId: scope.instructorId,
    }),
  ]);
  const webSearch = governedWebSearchTools({
    policies: [professorPack.courseAgentConfig.configuration.externalSearch],
  });
  const instructions = buildProfessorInstructions({ harness });

  const storedTurns = await loadActiveTurns(session);
  const rawHistory = turnsToUIMessages(storedTurns) as ProfessorUIMessage[];
  const history = rawHistory.map((message, index) => index === rawHistory.length - 1
    ? message
    : { ...message, parts: message.parts.filter((part) => part.type !== "data-proposal-context") });
  const conversationMessages = await convertToModelMessages(history, {
    convertDataPart: (part) => {
      if (part.type !== "data-proposal-context") return undefined;
      const data = part.data as ProfessorDataParts["proposal-context"];
      if (!data || data.proposalId !== args.focusedProposalId) return undefined;
      const summary = data.summary.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
      return {
        type: "text" as const,
        text: `\n<focused_proposal id="${data.proposalId}">${summary}</focused_proposal>\nRevise this open draft. Pass its id as revisesProposalId to the matching draft tool.`,
      };
    },
  });
  const currentMessage = conversationMessages.at(-1);
  const priorMessages = conversationMessages.slice(0, -1);
  const referenceMessage = {
    role: "user" as const,
    content: buildProfessorReference({ professorPack, threadSummary: session.summary, attachedDocuments }),
  };
  const modelMessages = currentMessage
    ? [...priorMessages, referenceMessage, currentMessage]
    : [referenceMessage];
  const tools = {
    ...professorOperatorTools({ scope, sessionId: session.id, model: args.model }),
    configure_agent: courseAgentConfigurationTool({ scope, sessionId: session.id }),
    ...courseGuidanceTools({ scope, sessionId: session.id }),
    remember: personalMemoryTool({
      scope: { orgId: scope.orgId, userId: scope.instructorId, profile: "professor" },
      sessionId: session.id,
    }),
    ...webSearch.tools,
  };
  let peakInputTokens: number | undefined;

  const stream = createUIMessageStream<ProfessorUIMessage>({
    execute: ({ writer }) => {
      writer.write({ type: "data-planning-ref", id: session.id, data: { sessionId: session.id } });
      writer.write({
        type: "data-run-context",
        id: `${session.id}:${session.totalTurns}`,
        data: {
          sessionId: session.id,
          builtAt: professorPack.builtAt,
          tokenEstimate: professorPack.tokenEstimate,
          tools: Object.keys(tools).length,
          skills: harness.skills.map((skill) => skill.id),
        },
      });

      /*
       * Real steering, not a queued follow-up. A note typed while this
       * response streams is drained at the next step boundary and appended to
       * the messages the model is about to see, so the run in flight changes
       * course. Without a run id there is nothing to aim a note at, so the
       * hook is omitted entirely rather than left querying for nothing.
       */
      const steering = args.runId
        ? steeringPrepareStep({
            scope: { sessionId: session.id, runId: args.runId },
            onInjected: ({ notes, stepNumber }) => {
              writer.write({
                type: "data-steering-applied",
                id: `${session.id}:${args.runId}:${stepNumber}`,
                data: { notes: notes.map((note) => note.text), stepNumber },
              });
            },
          })
        : undefined;

      const result = streamText({
        model: args.model,
        instructions,
        messages: modelMessages,
        tools,
        stopWhen: isStepCount(16),
        ...(steering ? { prepareStep: steering } : {}),
        onStepEnd: ({ usage }) => {
          if (usage.inputTokens !== undefined) {
            peakInputTokens = Math.max(peakInputTokens ?? 0, usage.inputTokens);
          }
        },
      });
      const createdAt = new Date().toISOString();
      writer.merge(toUIMessageStream({
        stream: result.stream,
        sendReasoning: false,
        messageMetadata: () => ({ createdAt }),
      }));
    },
    onError: (error) => {
      console.error("professor harness turn failed", error);
      return "Atlas could not finish that run. Your message is saved; try again.";
    },
    onEnd: async ({ responseMessage }) => {
      const parts = responseMessage?.parts ?? [];
      if (parts.length === 0) return;
      /*
       * Fold before persisting the response, so the user turn already carries
       * every redirection by the time the next turn reads history back. Fold
       * before compaction too: a summary that omitted the redirection would
       * describe a request the professor had already changed.
       */
      if (args.runId) {
        await foldConsumedSteeringIntoTurn({
          orgId: scope.orgId,
          sessionId: session.id,
          runId: args.runId,
          userTurnIndex,
        });
      }
      await persistSessionTurn(session, "assistant", parts);
      await compactIfNeeded(session, { model: args.model, inputTokens: peakInputTokens });
    },
  });

  return createUIMessageStreamResponse({ stream });
}
