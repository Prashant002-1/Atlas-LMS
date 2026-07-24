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
import { courseAgentConfigurationTool } from "@/lib/agent/course-agent-tool";
import { personalMemoryTool } from "@/lib/agent/memories";
import type { AtlasMessageMetadata } from "@/lib/agent/ui-message";
import { loadReadyThreadDocumentContext } from "@/lib/course/documents";
import { governedWebSearchTools } from "@/lib/agent/web-search";

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
  "run-context": {
    sessionId: string;
    builtAt: string;
    tokenEstimate: number;
    tools: number;
    skills: string[];
  };
};

export type ProfessorUIMessage = UIMessage<AtlasMessageMetadata, ProfessorDataParts>;

function stripDataParts(messages: UIMessage[]): UIMessage[] {
  return messages.map((message) => ({
    ...message,
    parts: message.parts.filter((part) => !String(part.type).startsWith("data-")),
  }));
}

export async function runProfessorTurn(args: {
  session: AgentSession;
  scope: ProfessorScope;
  model: LanguageModel;
  userText: string;
  /** The route persists input before it starts a durable workflow run. */
  userTurnPersisted?: boolean;
}): Promise<Response> {
  const { session, scope } = args;

  if (!args.userTurnPersisted) {
    await titleCommandSessionFromIntent(session, args.userText);
    await persistSessionTurn(session, "user", [{ type: "text" as const, text: args.userText }]);
  }

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
  const history = stripDataParts(turnsToUIMessages(storedTurns));
  const conversationMessages = await convertToModelMessages(history);
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

      const result = streamText({
        model: args.model,
        instructions,
        messages: modelMessages,
        tools,
        stopWhen: isStepCount(16),
        onStepEnd: ({ usage }) => {
          if (usage.inputTokens !== undefined) {
            peakInputTokens = Math.max(peakInputTokens ?? 0, usage.inputTokens);
          }
        },
      });
      const createdAt = new Date().toISOString();
      writer.merge(toUIMessageStream({
        stream: result.stream,
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
      await persistSessionTurn(session, "assistant", parts);
      await compactIfNeeded(session, { model: args.model, inputTokens: peakInputTokens });
    },
  });

  return createUIMessageStreamResponse({ stream });
}
