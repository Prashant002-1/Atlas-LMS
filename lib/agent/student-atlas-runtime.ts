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
import { compactIfNeeded, loadActiveTurns, turnsToUIMessages } from "@/lib/agent/session";
import { persistSessionTurn } from "@/lib/agent/session-store";
import {
  buildStudentAtlasInstructions,
  buildStudentAtlasPack,
  buildStudentAtlasReference,
  applicableStudentSearchCourseIds,
  titleStudentAtlasSessionFromIntent,
  type StudentAtlasScope,
} from "@/lib/agent/student-atlas";
import { studentAtlasTools } from "@/lib/agent/student-atlas-tools";
import { loadActiveOrgAgentPolicy } from "@/lib/agent/org-policy";
import type { AtlasMessageMetadata } from "@/lib/agent/ui-message";
import { loadReadyPersonalThreadDocumentContext } from "@/lib/course/documents";
import { governedWebSearchTools } from "@/lib/agent/web-search";

/**
 * One student personal turn on the durable AI SDK seam (ADR-0010, ADR-0016).
 * The student's input is a row before generation, the record snapshot is
 * rebuilt for every turn, tool parts persist with the assistant response, and
 * compaction runs only after a complete response. Same shape as the professor
 * runtime; different profile, different scope, different tools.
 */

export type StudentAtlasDataParts = {
  "atlas-ref": { sessionId: string };
  "document-attachments": {
    attachments: Array<{
      attachmentId: string;
      fileId: string;
      displayName: string;
      filename: string | null;
      processingStatus: "queued" | "processing" | "ready" | "failed";
    }>;
  };
  "run-context": {
    sessionId: string;
    builtAt: string;
    tokenEstimate: number;
    tools: number;
  };
};

export type StudentAtlasUIMessage = UIMessage<AtlasMessageMetadata, StudentAtlasDataParts>;

function stripDataParts(messages: UIMessage[]): UIMessage[] {
  return messages.map((message) => ({
    ...message,
    parts: message.parts.filter((part) => !String(part.type).startsWith("data-")),
  }));
}

export async function runStudentAtlasTurn(args: {
  session: AgentSession;
  scope: StudentAtlasScope;
  studentName: string;
  institutionName: string;
  model: LanguageModel;
  userText: string;
  /** The route persists input before it starts a durable workflow run. */
  userTurnPersisted?: boolean;
}): Promise<Response> {
  const { session, scope } = args;

  if (!args.userTurnPersisted) {
    await titleStudentAtlasSessionFromIntent(session, args.userText);
    await persistSessionTurn(session, "user", [{ type: "text" as const, text: args.userText }]);
  }

  const [pack, orgPolicy, attachedDocuments] = await Promise.all([
    buildStudentAtlasPack(scope),
    loadActiveOrgAgentPolicy(scope.orgId),
    loadReadyPersonalThreadDocumentContext({
      orgId: scope.orgId,
      userId: scope.studentId,
      sessionId: session.id,
    }),
  ]);
  const instructions = buildStudentAtlasInstructions({
    studentName: args.studentName,
    institutionName: args.institutionName,
    orgPolicy,
    pack,
  });

  const storedTurns = await loadActiveTurns(session);
  const history = stripDataParts(turnsToUIMessages(storedTurns));
  const conversationMessages = await convertToModelMessages(history);
  const currentMessage = conversationMessages.at(-1);
  const priorMessages = conversationMessages.slice(0, -1);
  const referenceMessage = {
    role: "user" as const,
    content: buildStudentAtlasReference({ pack, threadSummary: session.summary, attachedDocuments }),
  };
  const modelMessages = currentMessage
    ? [...priorMessages, referenceMessage, currentMessage]
    : [referenceMessage];
  const applicableCourseIds = applicableStudentSearchCourseIds(args.userText, pack.enrolledCourses);
  const coursePolicies = applicableCourseIds.flatMap((courseId) => {
    const config = pack.courseAgents.get(courseId);
    return config ? [config.configuration.externalSearch] : [];
  });
  const webSearch = governedWebSearchTools({
    policies: [orgPolicy.policy.externalSearch, ...coursePolicies],
  });
  const tools = {
    ...studentAtlasTools({ scope, sessionId: session.id }),
    ...webSearch.tools,
  };
  let peakInputTokens: number | undefined;

  const stream = createUIMessageStream<StudentAtlasUIMessage>({
    execute: ({ writer }) => {
      writer.write({ type: "data-atlas-ref", id: session.id, data: { sessionId: session.id } });
      writer.write({
        type: "data-run-context",
        id: `${session.id}:${session.totalTurns}`,
        data: {
          sessionId: session.id,
          builtAt: pack.builtAt,
          tokenEstimate: pack.tokenEstimate,
          tools: Object.keys(tools).length,
        },
      });

      const result = streamText({
        model: args.model,
        instructions,
        messages: modelMessages,
        tools,
        stopWhen: isStepCount(10),
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
      console.error("student atlas turn failed", error);
      return "Atlas could not finish that turn. Your message is saved; try again.";
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
