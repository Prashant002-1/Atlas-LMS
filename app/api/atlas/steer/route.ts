import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { isInstructorLike } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { agentSessions } from "@/lib/db/schema";
import { guardProfessorInput } from "@/lib/agent/atlas-harness";
import { publicWorkflowRunId } from "@/lib/agent/run-claims";
import {
  acceptSteeringNote,
  expireAbandonedSteeringNotes,
  MAX_STEERING_CHARACTERS,
} from "@/lib/agent/steering";

/**
 * Steer the response that is streaming right now.
 *
 * This is deliberately not the chat route. Posting to the chat route would
 * start a second turn, which is the queueing behavior steering exists to
 * replace. Here the note is recorded against the chat's active run, and that
 * run picks it up at its next step boundary, so the answer already being
 * written changes course.
 *
 * Ownership is re-read from the session row rather than trusted from the body:
 * only the person who owns this chat may redirect it, only on their own
 * surface, and only while a run is actually addressable.
 */

const MAX_REQUEST_BYTES = 8 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || !user.orgId) {
    return NextResponse.json({ error: "Sign in to use Atlas." }, { status: 401 });
  }

  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader) {
    const contentLength = Number(contentLengthHeader);
    if (!Number.isFinite(contentLength) || contentLength < 0 || contentLength > MAX_REQUEST_BYTES) {
      return NextResponse.json({ error: "That request is too large." }, { status: 413 });
    }
  }

  let body: { sessionId?: unknown; text?: unknown };
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BYTES) {
      return NextResponse.json({ error: "That request is too large." }, { status: 413 });
    }
    const parsed = JSON.parse(rawBody) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json({ error: "Malformed request." }, { status: 400 });
    }
    body = parsed as typeof body;
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  if (!UUID_PATTERN.test(sessionId)) {
    return NextResponse.json({ error: "Malformed chat id." }, { status: 400 });
  }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return NextResponse.json({ error: "Say what Atlas should do instead." }, { status: 400 });
  if (text.length > MAX_STEERING_CHARACTERS) {
    return NextResponse.json({ error: `Keep a redirection under ${MAX_STEERING_CHARACTERS} characters.` }, { status: 400 });
  }

  /* The same guard an ordinary turn passes: steering is not a side channel. */
  const inputGuard = guardProfessorInput(text);
  if (!inputGuard.allowed) {
    return NextResponse.json({ error: inputGuard.reason }, { status: 400 });
  }

  const [chat] = await db
    .select({
      id: agentSessions.id,
      userId: agentSessions.userId,
      surface: agentSessions.surface,
      activeRunId: agentSessions.activeRunId,
    })
    .from(agentSessions)
    .where(and(eq(agentSessions.id, sessionId), eq(agentSessions.orgId, user.orgId), isNull(agentSessions.archivedAt)))
    .limit(1);
  if (!chat || chat.userId !== user.id) {
    return NextResponse.json({ error: "That chat is not yours." }, { status: 404 });
  }

  /*
   * Only the two conversational surfaces are steerable, and each only by the
   * role that owns it. An assessed session is not steerable at all: its turn
   * count is the graded record, so a redirection that skipped the counter
   * would be a way around the limit.
   */
  const professorChat = chat.surface === "command";
  const personalChat = chat.surface === "personal";
  if (!professorChat && !personalChat) {
    return NextResponse.json({ error: "This session cannot be redirected mid response." }, { status: 403 });
  }
  if (professorChat && !isInstructorLike(user.role)) {
    return NextResponse.json({ error: "Professor Atlas chats belong to instructors." }, { status: 403 });
  }

  await expireAbandonedSteeringNotes(chat.id);

  /*
   * A private claim token is not addressable and no run at all means there is
   * nothing to redirect. Both answer 409 so the client sends the text as an
   * ordinary next turn instead of losing it.
   */
  const runId = publicWorkflowRunId(chat.activeRunId);
  if (!runId) {
    return NextResponse.json({ error: "Atlas is not working in this chat right now." }, { status: 409 });
  }

  const accepted = await acceptSteeringNote(
    { orgId: user.orgId, sessionId: chat.id, userId: user.id, runId },
    text
  );
  if (!accepted.ok) {
    if (accepted.reason === "too_many") {
      return NextResponse.json(
        { error: "Atlas has taken enough redirections for this response. Wait for it to land." },
        { status: 429 }
      );
    }
    const message =
      accepted.reason === "too_long"
        ? `Keep a redirection under ${MAX_STEERING_CHARACTERS} characters.`
        : "Say what Atlas should do instead.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, runId, pending: accepted.pending });
}
