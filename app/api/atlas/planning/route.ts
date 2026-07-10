import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isInstructorLike } from "@/lib/auth/session";
import { resolveModelForOrg } from "@/lib/agent/keys";
import { runProfessorTurn } from "@/lib/agent/professor-runtime";
import { createCommandSession, loadCommandSession } from "@/lib/agent/session";
import { resolveScope } from "@/lib/workspace/scope";

/**
 * The planning turn endpoint, the professor profile's one door. The client
 * sends only its latest message plus the thread it is in ("new" on a first
 * message); the server owns history, context, tools, and persistence. Every
 * check fails closed: wrong role, no course in view, someone else's thread,
 * or a missing model key all refuse before a token is generated.
 */

export const maxDuration = 120;

/** A thread that runs away past this many stored turns refuses new ones. */
const MAX_THREAD_TURNS = 400;

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

export async function POST(request: Request) {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || !user.orgId) {
    return NextResponse.json({ error: "Sign in to plan with Atlas." }, { status: 401 });
  }
  if (!isInstructorLike(user.role)) {
    return NextResponse.json({ error: "Planning threads belong to instructors." }, { status: 403 });
  }

  let body: { sessionId?: unknown; message?: IncomingMessage; text?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  const userText = textFromIncoming(body.message, body.text);
  if (!userText) {
    return NextResponse.json({ error: "Say something to Atlas." }, { status: 400 });
  }
  if (userText.length > 4000) {
    return NextResponse.json({ error: "Keep a turn under 4000 characters." }, { status: 400 });
  }

  const scope = await resolveScope({ orgId: user.orgId, userId: user.id, role: user.role, teachingOnly: true });
  if (!scope.course) {
    return NextResponse.json({ error: "No course is in view for this semester." }, { status: 404 });
  }

  const resolved = await resolveModelForOrg(user.orgId);
  if (!resolved) {
    return NextResponse.json(
      { error: "No model key is configured for this organization. Connect one in Settings." },
      { status: 503 }
    );
  }

  const threadScope = { orgId: user.orgId, userId: user.id, courseId: scope.course.id };
  const requestedId = typeof body.sessionId === "string" ? body.sessionId : "new";
  const thread =
    requestedId === "new" || requestedId === ""
      ? await createCommandSession(threadScope)
      : await loadCommandSession(threadScope, requestedId);
  if (!thread) {
    return NextResponse.json({ error: "That planning thread is not yours in this course." }, { status: 404 });
  }
  if (thread.totalTurns >= MAX_THREAD_TURNS) {
    return NextResponse.json({ error: "This thread has hit its turn limit. Start a new one." }, { status: 409 });
  }

  return runProfessorTurn({
    session: thread,
    scope: { orgId: user.orgId, instructorId: user.id, courseId: scope.course.id },
    model: resolved.model,
    userText,
  });
}
