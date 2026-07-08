import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
  tool,
  type LanguageModel,
  type UIMessage,
} from "ai";
import type { AgentSession, CourseAiPolicy } from "@/lib/db/schema";
import { compactIfNeeded, loadActiveTurns, turnsToUIMessages } from "@/lib/agent/session";
import { buildSessionInstructions, buildSessionPack } from "@/lib/agent/session-context";
import { fireSideNoteForTurn } from "@/lib/agent/side-notes";
import {
  artifactUpdatesFromParts,
  updateArtifactInputSchema,
  type SessionUIMessage,
} from "@/lib/agent/session-parts";
import {
  listArtifactStates,
  persistArtifactStates,
  persistSessionTurn,
  type SessionAssignmentBundle,
} from "@/lib/agent/session-store";

/**
 * Session runtime, one student turn end to end. This module is the durability
 * seam the runtime decision (ADR-0010) isolates: turns are persisted to
 * Postgres around a plain AI SDK 7 stream, so a refresh rehydrates the whole
 * transcript from rows. If a workflow-backed runtime is adopted later, it
 * replaces this file, nothing above or below it.
 *
 * Order of operations per turn:
 *   1. persist the student's turn (before any generation, it can never be lost);
 *   2. evaluate the deterministic side-note trigger on that turn; a fired card
 *      is persisted, then streamed ahead of the model's reply;
 *   3. stream the tutor turn (update_artifact is the only tool);
 *   4. on end, persist the assistant turn (text + tool parts + data parts)
 *      and snapshot every validated artifact update at that turn index.
 */

/** Strip data-* parts before model conversion; they are UI/record-facing. */
function stripDataParts(messages: UIMessage[]): UIMessage[] {
  return messages.map((message) => ({
    ...message,
    parts: message.parts.filter((part) => !String(part.type).startsWith("data-")),
  }));
}

export async function runSessionTurn(args: {
  session: AgentSession;
  bundle: SessionAssignmentBundle;
  policy: CourseAiPolicy | null;
  model: LanguageModel;
  userText: string;
}): Promise<Response> {
  const { session, bundle } = args;

  // 1. The student's turn is durable before anything else happens.
  const userParts = [{ type: "text" as const, text: args.userText }];
  const userTurnIndex = await persistSessionTurn(session, "user", userParts);

  // 2. Deterministic side-note evaluation on the stored turn.
  const sideNote = await fireSideNoteForTurn({
    session,
    config: bundle.config,
    turnText: args.userText,
    turnIndex: userTurnIndex,
  });

  // 3. Context pack + instructions, rebuilt per turn from the record.
  const sessionPack = await buildSessionPack({
    orgId: session.orgId,
    courseId: session.courseId,
    studentId: session.userId,
    bundle,
  });
  const instructions = [
    buildSessionInstructions({ sessionPack, bundle, policy: args.policy }),
    session.summary ? `\nEARLIER IN THIS SESSION (compacted):\n${session.summary}` : "",
  ].join("\n");

  // History: verbatim tail after the compaction mark, including the turn just stored.
  const storedTurns = await loadActiveTurns(session);
  const history = stripDataParts(turnsToUIMessages(storedTurns));

  const priorArtifacts = await listArtifactStates(session.orgId, session.id);
  let revision = priorArtifacts.length;

  const updateArtifact = tool({
    description:
      "Snapshot the student's CURRENT deliverable state whenever they propose or revise it. Record their decisions verbatim; include revisionNote on every revision after the first.",
    inputSchema: updateArtifactInputSchema,
    execute: async () => {
      revision += 1;
      return { ok: true as const, revision };
    },
  });

  const modelMessages = await convertToModelMessages(history);

  const stream = createUIMessageStream<SessionUIMessage>({
    execute: ({ writer }) => {
      if (sideNote) {
        writer.write({ type: "data-side-note", id: sideNote.id, data: sideNote });
      }

      const result = streamText({
        model: args.model,
        instructions,
        messages: modelMessages,
        tools: { update_artifact: updateArtifact },
        stopWhen: isStepCount(4),
      });

      writer.merge(toUIMessageStream({ stream: result.stream }));
    },
    onError: (error) => {
      console.error("session turn failed", error);
      return "The session hit a model error. Your transcript is saved; try sending that again.";
    },
    onEnd: async ({ responseMessage }) => {
      // 4. The assistant turn (text, tool parts, side-note data part) becomes rows.
      const parts = responseMessage?.parts ?? [];
      if (parts.length === 0) return;
      const assistantTurnIndex = await persistSessionTurn(session, "assistant", parts);
      await persistArtifactStates(session, assistantTurnIndex, artifactUpdatesFromParts(parts));
      await compactIfNeeded(session);
    },
  });

  return createUIMessageStreamResponse({ stream });
}
