import { NextResponse } from "next/server";
import { and, eq, gte, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { isInstructorLike } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { agentSessions, agentTurns } from "@/lib/db/schema";
import { guardProfessorInput } from "@/lib/agent/atlas-harness";
import { resolveModelForOrg } from "@/lib/agent/keys";
import { runProfessorTurn } from "@/lib/agent/professor-runtime";
import { createCommandSession, loadCommandSession } from "@/lib/agent/session";
import { resolveScope } from "@/lib/workspace/scope";

export const maxDuration = 120;

const MAX_THREAD_TURNS = 400;
const MAX_TURN_CHARACTERS = 4000;
const MAX_REQUEST_BYTES = 64 * 1024;
const RATE_WINDOW_MINUTES = 10;
const MAX_TURNS_PER_WINDOW = 30;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type IncomingMessage = { parts?: Array<{ type?: string; text?: string }>; text?: string };

function textFromIncoming(message: IncomingMessage | null | undefined, fallback: unknown): string {
  if (typeof fallback === "string" && fallback.trim()) return fallback.trim();
  if (!message) return "";
  if (typeof message.text === "string" && message.text.trim()) return message.text.trim();
  if (Array.isArray(message.parts)) {
    return message.parts
      .filter((part) => part?.type === "text" && typeof part.text === "string")
      .map((part) => String(part.text))
      .join("\n\n")
      .trim();
  }
  return "";
}

async function withinTurnBudget(args: { orgId: string; userId: string; courseId: string }): Promise<boolean> {
  const since = new Date(Date.now() - RATE_WINDOW_MINUTES * 60_000);
  const [usage] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(agentTurns)
    .innerJoin(agentSessions, eq(agentSessions.id, agentTurns.sessionId))
    .where(
      and(
        eq(agentTurns.orgId, args.orgId),
        eq(agentTurns.role, "user"),
        eq(agentSessions.userId, args.userId),
        eq(agentSessions.courseId, args.courseId),
        eq(agentSessions.surface, "command"),
        eq(agentSessions.anchorType, "course"),
        gte(agentTurns.createdAt, since)
      )
    );
  return Number(usage?.count ?? 0) < MAX_TURNS_PER_WINDOW;
}

export async function POST(request: Request) {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || !user.orgId) {
    return NextResponse.json({ error: "Sign in to use Atlas." }, { status: 401 });
  }
  if (!isInstructorLike(user.role)) {
    return NextResponse.json({ error: "Atlas professor threads belong to instructors." }, { status: 403 });
  }

  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader) {
    const contentLength = Number(contentLengthHeader);
    if (!Number.isFinite(contentLength) || contentLength < 0 || contentLength > MAX_REQUEST_BYTES) {
      return NextResponse.json({ error: "That request is too large." }, { status: 413 });
    }
  }

  let body: { sessionId?: unknown; message?: IncomingMessage; text?: unknown };
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

  const userText = textFromIncoming(body.message, body.text);
  if (!userText) return NextResponse.json({ error: "Ask Atlas something." }, { status: 400 });
  if (userText.length > MAX_TURN_CHARACTERS) {
    return NextResponse.json({ error: `Keep a turn under ${MAX_TURN_CHARACTERS} characters.` }, { status: 400 });
  }

  const inputGuard = guardProfessorInput(userText);
  if (!inputGuard.allowed) {
    return NextResponse.json({ error: inputGuard.reason }, { status: 400 });
  }

  const scope = await resolveScope({ orgId: user.orgId, userId: user.id, role: user.role, teachingOnly: true });
  if (!scope.course) {
    return NextResponse.json({ error: "No course is in view for this semester." }, { status: 404 });
  }

  if (!(await withinTurnBudget({ orgId: user.orgId, userId: user.id, courseId: scope.course.id }))) {
    return NextResponse.json(
      { error: "Atlas has reached the short-term turn limit for this course. Try again in a few minutes." },
      { status: 429, headers: { "Retry-After": String(RATE_WINDOW_MINUTES * 60) } }
    );
  }

  const resolved = await resolveModelForOrg(user.orgId);
  if (!resolved) {
    return NextResponse.json({ error: "Connect a model in Settings before using Atlas." }, { status: 503 });
  }

  const threadScope = { orgId: user.orgId, userId: user.id, courseId: scope.course.id };
  const requestedId = typeof body.sessionId === "string" ? body.sessionId : "new";
  if (requestedId !== "new" && requestedId !== "" && !UUID_PATTERN.test(requestedId)) {
    return NextResponse.json({ error: "Malformed thread id." }, { status: 400 });
  }
  const thread =
    requestedId === "new" || requestedId === ""
      ? await createCommandSession(threadScope)
      : await loadCommandSession(threadScope, requestedId);
  if (!thread) {
    return NextResponse.json({ error: "That thread is not yours in this course." }, { status: 404 });
  }
  if (thread.totalTurns >= MAX_THREAD_TURNS) {
    return NextResponse.json({ error: "This thread is full. Start a new one." }, { status: 409 });
  }

  return runProfessorTurn({
    session: thread,
    scope: { orgId: user.orgId, instructorId: user.id, courseId: scope.course.id },
    model: resolved.model,
    userText,
  });
}
