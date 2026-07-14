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
import { professorTools } from "@/lib/agent/professor-tools";

/**
 * One professor turn on the durable AI SDK seam. The professor's input is a row
 * before generation, the current course snapshot is rebuilt for every turn,
 * tool and draft parts persist with the assistant response, and compaction runs
 * only after a complete response.
 */

export type ProfessorDataParts = {
  "planning-ref": { sessionId: string };
  "run-context": {
    sessionId: string;
    builtAt: string;
    tokenEstimate: number;
    tools: number;
    skills: string[];
  };
};

export type ProfessorUIMessage = UIMessage<never, ProfessorDataParts>;

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
}): Promise<Response> {
  const { session, scope } = args;

  await titleCommandSessionFromIntent(session, args.userText);
  await persistSessionTurn(session, "user", [{ type: "text" as const, text: args.userText }]);

  const [professorPack, harness] = await Promise.all([buildProfessorPack(scope), loadAtlasHarness()]);
  const instructions = buildProfessorInstructions({ harness });

  const storedTurns = await loadActiveTurns(session);
  const history = stripDataParts(turnsToUIMessages(storedTurns));
  const conversationMessages = await convertToModelMessages(history);
  const currentMessage = conversationMessages.at(-1);
  const priorMessages = conversationMessages.slice(0, -1);
  const referenceMessage = {
    role: "user" as const,
    content: buildProfessorReference({ professorPack, threadSummary: session.summary }),
  };
  const modelMessages = currentMessage
    ? [...priorMessages, referenceMessage, currentMessage]
    : [referenceMessage];
  const tools = professorTools({ scope, sessionId: session.id });

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
        stopWhen: isStepCount(8),
      });
      writer.merge(toUIMessageStream({ stream: result.stream }));
    },
    onError: (error) => {
      console.error("professor harness turn failed", error);
      return "Atlas could not finish that run. Your message is saved; try again.";
    },
    onEnd: async ({ responseMessage }) => {
      const parts = responseMessage?.parts ?? [];
      if (parts.length === 0) return;
      await persistSessionTurn(session, "assistant", parts);
      await compactIfNeeded(session);
    },
  });

  return createUIMessageStreamResponse({ stream });
}
