import { and, asc, eq, isNull, lt } from "drizzle-orm";
import type { ModelMessage } from "ai";
import { db } from "@/lib/db";
import { agentSteeringNotes, agentTurns } from "@/lib/db/schema";

/**
 * Steering, mid-run redirection of a response that is already streaming.
 *
 * A queued message is not steering. Queueing waits for the whole run to end
 * and then starts a second turn, so the work the professor wanted redirected
 * has already happened by the time the note is read. Steering has to reach
 * the model inside the run that is in flight.
 *
 * The AI SDK exposes exactly one seam for that: `prepareStep`, which runs at
 * every step boundary of a multi-step generation and may replace the messages
 * sent to the model for the coming step. So a note typed during a run is
 * persisted against that run id, and the run drains it at its next boundary
 * and appends it as a user message before the model's next step. The model
 * sees the redirection alongside the tool results it just produced and
 * changes course; no synthetic turn is invented and the stored turn order
 * stays user, assistant, user, assistant.
 *
 * Two properties fall out of keeping the queue in Postgres rather than in the
 * browser. The durable run owns the turn, so a refresh or a second tab cannot
 * lose a note that was already accepted. And a note that arrives after the
 * last boundary, which is the single-step case with nothing left to redirect,
 * is simply never consumed: the client then sends it as an ordinary next turn,
 * so nothing is silently dropped.
 */

/** One steering note may not exceed a normal turn's budget. */
export const MAX_STEERING_CHARACTERS = 2000;
/** A run cannot be redirected without limit inside a single response. */
export const MAX_STEERING_NOTES_PER_RUN = 8;
/** Notes older than this are treated as abandoned and never injected. */
const STEERING_NOTE_TTL_MS = 30 * 60_000;

export type SteeringScope = {
  orgId: string;
  sessionId: string;
  userId: string;
  runId: string;
};

export type AcceptSteeringResult =
  | { ok: true; noteId: string; pending: number }
  | { ok: false; reason: "empty" | "too_long" | "too_many" };

/**
 * Record a note aimed at a run that is currently streaming. Returns a
 * structured refusal rather than throwing so the route can answer with a
 * status the composer can render.
 */
export async function acceptSteeringNote(
  scope: SteeringScope,
  rawText: string
): Promise<AcceptSteeringResult> {
  const text = rawText.trim();
  if (!text) return { ok: false, reason: "empty" };
  if (text.length > MAX_STEERING_CHARACTERS) return { ok: false, reason: "too_long" };

  const existing = await db
    .select({ id: agentSteeringNotes.id })
    .from(agentSteeringNotes)
    .where(and(eq(agentSteeringNotes.sessionId, scope.sessionId), eq(agentSteeringNotes.runId, scope.runId)));
  if (existing.length >= MAX_STEERING_NOTES_PER_RUN) return { ok: false, reason: "too_many" };

  const [note] = await db
    .insert(agentSteeringNotes)
    .values({
      orgId: scope.orgId,
      sessionId: scope.sessionId,
      runId: scope.runId,
      userId: scope.userId,
      text,
    })
    .returning({ id: agentSteeringNotes.id });

  const pending = await countPendingSteeringNotes(scope);
  return { ok: true, noteId: note.id, pending };
}

export async function countPendingSteeringNotes(scope: Pick<SteeringScope, "sessionId" | "runId">): Promise<number> {
  const rows = await db
    .select({ id: agentSteeringNotes.id })
    .from(agentSteeringNotes)
    .where(
      and(
        eq(agentSteeringNotes.sessionId, scope.sessionId),
        eq(agentSteeringNotes.runId, scope.runId),
        isNull(agentSteeringNotes.consumedAt)
      )
    );
  return rows.length;
}

export type DrainedSteeringNote = { id: string; text: string };

/**
 * Take every unconsumed note for this run and mark it consumed at the given
 * step. Claiming and reading are one statement so two concurrent boundaries
 * cannot inject the same note twice.
 */
export async function drainSteeringNotes(
  scope: Pick<SteeringScope, "sessionId" | "runId">,
  stepNumber: number
): Promise<DrainedSteeringNote[]> {
  const claimed = await db
    .update(agentSteeringNotes)
    .set({ consumedAt: new Date(), consumedAtStep: stepNumber })
    .where(
      and(
        eq(agentSteeringNotes.sessionId, scope.sessionId),
        eq(agentSteeringNotes.runId, scope.runId),
        isNull(agentSteeringNotes.consumedAt)
      )
    )
    .returning({ id: agentSteeringNotes.id, text: agentSteeringNotes.text, createdAt: agentSteeringNotes.createdAt });

  return claimed
    .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
    .map((row) => ({ id: row.id, text: row.text }));
}

/** Notes a run never reached, so the client can send them as the next turn. */
export async function pendingSteeringNotes(
  scope: Pick<SteeringScope, "sessionId" | "runId">
): Promise<DrainedSteeringNote[]> {
  const rows = await db
    .select({ id: agentSteeringNotes.id, text: agentSteeringNotes.text })
    .from(agentSteeringNotes)
    .where(
      and(
        eq(agentSteeringNotes.sessionId, scope.sessionId),
        eq(agentSteeringNotes.runId, scope.runId),
        isNull(agentSteeringNotes.consumedAt)
      )
    )
    .orderBy(asc(agentSteeringNotes.createdAt));
  return rows;
}

/** Housekeeping for notes whose run died before any boundary was reached. */
export async function expireAbandonedSteeringNotes(sessionId: string) {
  await db
    .delete(agentSteeringNotes)
    .where(
      and(
        eq(agentSteeringNotes.sessionId, sessionId),
        isNull(agentSteeringNotes.consumedAt),
        lt(agentSteeringNotes.createdAt, new Date(Date.now() - STEERING_NOTE_TTL_MS))
      )
    );
}

/**
 * The message a drained batch becomes. It is an ordinary user message, which
 * is the whole point: the model treats a redirection as the person speaking,
 * not as a system instruction, and the professor's own words carry no more
 * authority than they do in a normal turn.
 */
export function steeringModelMessage(notes: DrainedSteeringNote[]): ModelMessage | null {
  if (notes.length === 0) return null;
  const body = notes.map((note) => note.text).join("\n\n");
  return {
    role: "user",
    content: `New instruction from the professor, sent while you were working. It takes precedence over the earlier request where they conflict:\n\n${body}`,
  };
}

export type SteeringInjection = { notes: DrainedSteeringNote[]; stepNumber: number };

/**
 * Build the `prepareStep` handler that performs the injection. Callers keep
 * their own base messages; this only appends, so context assembly, ordering,
 * and the reference block all stay exactly where the runtime put them.
 *
 * Appending once is enough, and appending twice is impossible. The AI SDK
 * carries a `messages` override forward into later steps, so a note injected at
 * step two is still in context at step five without being re-added. And the
 * drain claims rows in the same statement that reads them, so two boundaries
 * racing cannot both take the same note. Returning an empty object leaves the
 * step untouched, which is the common case once the queue is empty.
 *
 * `onInjected` lets the runtime write a stream part so the transcript can show
 * where the redirection landed.
 */
export function steeringPrepareStep(args: {
  scope: Pick<SteeringScope, "sessionId" | "runId">;
  onInjected?: (injection: SteeringInjection) => void;
}) {
  return async ({ messages, stepNumber }: { messages: ModelMessage[]; stepNumber: number }) => {
    const notes = await drainSteeringNotes(args.scope, stepNumber);
    const injected = steeringModelMessage(notes);
    if (!injected) return {};
    args.onInjected?.({ notes, stepNumber });
    return { messages: [...messages, injected] };
  };
}

/**
 * Fold consumed redirections back into the stored turn that prompted the run.
 *
 * A redirection is something the professor said, so it has to be in history or
 * the next turn re-reads a request that no longer matches what actually
 * happened. It must not become its own row either: turns alternate user then
 * assistant, and inserting a second user turn mid-response would break the
 * ordering every reader depends on. So the note is appended as another text
 * part on the user turn already at the head of this run, which is the same
 * invariant Hermes holds when it appends steer text to an existing message
 * instead of synthesizing a turn.
 *
 * Called once per run after the response is stored, so a note that arrived at
 * step three is in place before the following turn is composed.
 */
export async function foldConsumedSteeringIntoTurn(args: {
  orgId: string;
  sessionId: string;
  runId: string;
  /** The user turn that opened this run. */
  userTurnIndex: number;
}): Promise<number> {
  const consumed = await db
    .select({ text: agentSteeringNotes.text, createdAt: agentSteeringNotes.createdAt })
    .from(agentSteeringNotes)
    .where(and(eq(agentSteeringNotes.sessionId, args.sessionId), eq(agentSteeringNotes.runId, args.runId)))
    .orderBy(asc(agentSteeringNotes.createdAt));
  const applied = consumed.filter((row) => row.text.trim().length > 0);
  if (applied.length === 0) return 0;

  const [turn] = await db
    .select({ id: agentTurns.id, parts: agentTurns.parts })
    .from(agentTurns)
    .where(
      and(
        eq(agentTurns.orgId, args.orgId),
        eq(agentTurns.sessionId, args.sessionId),
        eq(agentTurns.turnIndex, args.userTurnIndex),
        eq(agentTurns.role, "user")
      )
    )
    .limit(1);
  if (!turn) return 0;

  const existing = Array.isArray(turn.parts) ? (turn.parts as Array<Record<string, unknown>>) : [];
  /* Idempotent: a retried fold must not duplicate the same text. */
  const alreadyThere = new Set(
    existing
      .filter((part) => part.type === "text" && typeof part.text === "string")
      .map((part) => String(part.text))
  );
  const additions = applied
    .map((row) => row.text.trim())
    .filter((text) => !alreadyThere.has(text))
    .map((text) => ({ type: "text" as const, text, providerMetadata: { atlas: { steering: true } } }));
  if (additions.length === 0) return 0;

  await db
    .update(agentTurns)
    .set({ parts: [...existing, ...additions] })
    .where(eq(agentTurns.id, turn.id));
  return additions.length;
}
