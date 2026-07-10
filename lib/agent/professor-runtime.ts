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
import { buildProfessorInstructions, buildProfessorPack, type ProfessorScope } from "@/lib/agent/professor-context";
import { professorTools } from "@/lib/agent/professor-tools";

/**
 * The professor profile's runtime, one planning turn end to end, on the same
 * durability seam as the student session (ADR-0010): turns persist to
 * Postgres around a plain AI SDK 7 stream, so a refresh rehydrates the whole
 * thread from rows and a crash costs at most the reply that was streaming.
 *
 * Order of operations per turn:
 *   1. title the thread from the first intent (before any turn is stored);
 *   2. persist the professor's turn, before any generation;
 *   3. rebuild the professor pack from the record and stream the reply with
 *      the profile's closed tool set (read_page, propose_rubric,
 *      propose_records), draft writes landing behind Review inside the
 *      tool calls themselves;
 *   4. on end, persist the assistant turn (text + tool parts) and compact
 *      the thread when it outgrows the verbatim budget.
 */

/** Data parts the planning stream carries alongside the model's own parts. */
export type ProfessorDataParts = {
  /** Tells a fresh client which stored thread its turns are landing in. */
  "planning-ref": { sessionId: string };
};

export type ProfessorUIMessage = UIMessage<never, ProfessorDataParts>;

/** Strip data-* parts before model conversion; they are UI/record-facing. */
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

  // 1. First intent names the thread (the guard inside only fires on turn 0).
  await titleCommandSessionFromIntent(session, args.userText);

  // 2. The professor's turn is durable before anything else happens.
  const userParts = [{ type: "text" as const, text: args.userText }];
  await persistSessionTurn(session, "user", userParts);

  // 3. Context pack + instructions, rebuilt per turn from the record.
  const professorPack = await buildProfessorPack(scope);
  const instructions = [
    buildProfessorInstructions({ professorPack }),
    session.summary ? `\nEARLIER IN THIS THREAD (compacted):\n${session.summary}` : "",
  ].join("\n");

  const storedTurns = await loadActiveTurns(session);
  const history = stripDataParts(turnsToUIMessages(storedTurns));
  const modelMessages = await convertToModelMessages(history);

  const tools = professorTools({ scope, sessionId: session.id });

  const stream = createUIMessageStream<ProfessorUIMessage>({
    execute: ({ writer }) => {
      writer.write({ type: "data-planning-ref", id: session.id, data: { sessionId: session.id } });

      const result = streamText({
        model: args.model,
        instructions,
        messages: modelMessages,
        tools,
        stopWhen: isStepCount(6),
      });

      writer.merge(toUIMessageStream({ stream: result.stream }));
    },
    onError: (error) => {
      console.error("planning turn failed", error);
      return "The thread hit a model error. Everything said so far is saved; send that again.";
    },
    onEnd: async ({ responseMessage }) => {
      // 4. The assistant turn (text + tool parts) becomes rows.
      const parts = responseMessage?.parts ?? [];
      if (parts.length === 0) return;
      await persistSessionTurn(session, "assistant", parts);
      await compactIfNeeded(session);
    },
  });

  return createUIMessageStreamResponse({ stream });
}
