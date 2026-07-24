import { NextResponse } from "next/server";
import { and, eq, gte, sql } from "drizzle-orm";
import { start } from "workflow/api";
import { auth } from "@/lib/auth";
import { isInstructorLike } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { agentSessions, agentTurns } from "@/lib/db/schema";
import { guardProfessorInput } from "@/lib/agent/atlas-harness";
import { resolvePlatformModel } from "@/lib/ai/platform-model";
import { persistSessionTurn } from "@/lib/agent/session-store";
import { createCommandSession, loadCommandSession, titleCommandSessionFromIntent } from "@/lib/agent/session";
import { workflowStreamResponse } from "@/lib/agent/workflow-stream";
import { activateAgentRun, claimActiveAgentRun, releaseAgentRunClaim } from "@/lib/agent/run-claims";
import { resolveScope } from "@/lib/workspace/scope";
import { professorTurnWorkflow } from "@/workflows/agent-session";
import { attachCourseFilesToThread } from "@/lib/course/documents";

export const maxDuration = 120;

const MAX_CHAT_TURNS = 400;
const MAX_TURN_CHARACTERS = 4000;
const MAX_REQUEST_BYTES = 64 * 1024;
const RATE_WINDOW_MINUTES = 10;
const MAX_TURNS_PER_WINDOW = 30;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type IncomingMessage = {
  parts?: Array<{ type?: string; text?: string; data?: unknown }>;
  text?: string;
};

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

function documentFileIdsFromIncoming(message: IncomingMessage | null | undefined): string[] | null {
  if (!Array.isArray(message?.parts)) return [];
  const dataParts = message.parts.filter((part) => part?.type === "data-document-attachments");
  const raw = dataParts.flatMap((part) => {
    if (!part.data || typeof part.data !== "object" || Array.isArray(part.data)) return [];
    const attachments = (part.data as { attachments?: unknown }).attachments;
    return Array.isArray(attachments) ? attachments : [];
  });
  if (raw.length > 5) return null;
  const fileIds = raw.map((attachment) =>
    attachment && typeof attachment === "object" && !Array.isArray(attachment)
      ? (attachment as { fileId?: unknown }).fileId
      : null
  );
  if (fileIds.some((fileId) => typeof fileId !== "string" || !UUID_PATTERN.test(fileId))) return null;
  return [...new Set(fileIds as string[])];
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
    return NextResponse.json({ error: "Professor Atlas chats belong to instructors." }, { status: 403 });
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
  const documentFileIds = documentFileIdsFromIncoming(body.message);
  if (!documentFileIds) return NextResponse.json({ error: "One or more document attachments are malformed." }, { status: 400 });
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

  const resolved = resolvePlatformModel();
  if (!resolved) {
    return NextResponse.json(
      { error: "Atlas's model runtime is temporarily unavailable. Please try again later." },
      { status: 503 }
    );
  }

  const threadScope = { orgId: user.orgId, userId: user.id, courseId: scope.course.id };
  const requestedId = typeof body.sessionId === "string" ? body.sessionId : "new";
  if (requestedId !== "new" && requestedId !== "" && !UUID_PATTERN.test(requestedId)) {
    return NextResponse.json({ error: "Malformed chat id." }, { status: 400 });
  }
  const thread =
    requestedId === "new" || requestedId === ""
      ? await createCommandSession(threadScope)
      : await loadCommandSession(threadScope, requestedId);
  if (!thread) {
    return NextResponse.json({ error: "That chat is not yours in this course." }, { status: 404 });
  }
  if (thread.totalTurns >= MAX_CHAT_TURNS) {
    return NextResponse.json({ error: "This chat is full. Start a new one." }, { status: 409 });
  }
  const runClaimId = await claimActiveAgentRun(thread.id);
  if (!runClaimId) {
    /*
     * A run already owns this chat, so a second turn is the wrong shape: the
     * composer redirects the response in flight through /api/atlas/steer
     * instead of lining a message up behind it.
     */
    return NextResponse.json(
      { error: "Atlas is already working in this chat. Your message redirects the response in flight." },
      { status: 409 }
    );
  }

  let run: Awaited<ReturnType<typeof start>> | null = null;
  let attachmentsAttached = false;
  try {
    const attachedDocuments = await attachCourseFilesToThread({
      actor: { id: user.id, orgId: user.orgId, role: user.role },
      courseId: scope.course.id,
      sessionId: thread.id,
      fileIds: documentFileIds,
    });
    attachmentsAttached = true;
    await titleCommandSessionFromIntent(thread, userText);
    await persistSessionTurn(thread, "user", [
      { type: "text" as const, text: userText },
      ...(attachedDocuments.length > 0
        ? [{
            type: "data-document-attachments" as const,
            data: {
              attachments: attachedDocuments.map((document) => ({
                attachmentId: document.attachmentId,
                fileId: document.fileId,
                displayName: document.displayName,
                filename: document.filename,
                processingStatus: document.processingStatus,
              })),
            },
          }]
        : []),
    ]);

    run = await start(professorTurnWorkflow, [{
      orgId: user.orgId,
      instructorId: user.id,
      courseId: scope.course.id,
      sessionId: thread.id,
      userText,
      runClaimId,
    }]);
    if (!(await activateAgentRun(thread.id, runClaimId, run.runId))) {
      await run.cancel();
      return NextResponse.json({ error: "Another Atlas run already owns this chat." }, { status: 409 });
    }
  } catch (error) {
    if (!run) await releaseAgentRunClaim(thread.id, runClaimId);
    if (!attachmentsAttached) {
      const message = error instanceof Error && (
        error.message === "One or more attached documents are not in this course." ||
        error.message === "That Atlas thread is not yours in this course."
      )
        ? error.message
        : "Atlas could not attach those documents.";
      return NextResponse.json(
        { error: message },
        { status: 400 }
      );
    }
    throw error;
  }

  return workflowStreamResponse(run.readable, { "x-workflow-run-id": run.runId });
}
