import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { auth } from "@/lib/auth";
import { resolvePlatformModel } from "@/lib/ai/platform-model";
import { persistSessionTurn } from "@/lib/agent/session-store";
import {
  createStudentAtlasSession,
  guardStudentAtlasInput,
  loadStudentAtlasSession,
  studentAtlasTurnsSince,
  titleStudentAtlasSessionFromIntent,
} from "@/lib/agent/student-atlas";
import { loadActiveOrgAgentPolicy } from "@/lib/agent/org-policy";
import { workflowStreamResponse } from "@/lib/agent/workflow-stream";
import { activateAgentRun, claimActiveAgentRun, releaseAgentRunClaim } from "@/lib/agent/run-claims";
import { studentAtlasTurnWorkflow } from "@/workflows/agent-session";
import { loadPersonalThreadAttachments } from "@/lib/course/documents";

export const maxDuration = 120;

const MAX_CHAT_TURNS = 400;
const MAX_TURN_CHARACTERS = 4000;
const MAX_REQUEST_BYTES = 64 * 1024;
const RATE_WINDOW_MINUTES = 10;
const MAX_TURNS_PER_WINDOW = 30;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type IncomingMessage = { parts?: Array<{ type?: string; text?: string; data?: unknown }>; text?: string };

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

export async function POST(request: Request) {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || !user.orgId) {
    return NextResponse.json({ error: "Sign in to use Atlas." }, { status: 401 });
  }
  if (user.role !== "student") {
    return NextResponse.json({ error: "This Atlas belongs to students." }, { status: 403 });
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

  const inputGuard = guardStudentAtlasInput(userText);
  if (!inputGuard.allowed) {
    return NextResponse.json({ error: inputGuard.reason }, { status: 400 });
  }

  // The university policy layer can switch the student agent off.
  const orgPolicy = await loadActiveOrgAgentPolicy(user.orgId);
  if (!orgPolicy.policy.studentAgentEnabled) {
    return NextResponse.json(
      { error: `${orgPolicy.policy.authorityLabel} has not enabled Atlas for students.` },
      { status: 403 }
    );
  }

  const scope = { orgId: user.orgId, studentId: user.id };

  const rateWindow = new Date(Date.now() - RATE_WINDOW_MINUTES * 60_000);
  if ((await studentAtlasTurnsSince(scope, rateWindow)) >= MAX_TURNS_PER_WINDOW) {
    return NextResponse.json(
      { error: "Atlas has reached the short-term turn limit. Try again in a few minutes." },
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

  const requestedId = typeof body.sessionId === "string" ? body.sessionId : "new";
  if (requestedId !== "new" && requestedId !== "" && !UUID_PATTERN.test(requestedId)) {
    return NextResponse.json({ error: "Malformed chat id." }, { status: 400 });
  }
  const thread =
    requestedId === "new" || requestedId === ""
      ? await createStudentAtlasSession(scope)
      : await loadStudentAtlasSession(scope, requestedId);
  if (!thread) {
    return NextResponse.json({ error: "That chat is not yours." }, { status: 404 });
  }
  if (thread.totalTurns >= MAX_CHAT_TURNS) {
    return NextResponse.json({ error: "This chat is full. Start a new one." }, { status: 409 });
  }
  let attachedDocuments;
  try {
    attachedDocuments = await loadPersonalThreadAttachments({
      actor: { id: user.id, orgId: user.orgId, role: user.role },
      sessionId: thread.id,
      fileIds: documentFileIds,
    });
  } catch {
    return NextResponse.json({ error: "One or more documents do not belong to this personal Atlas thread." }, { status: 404 });
  }
  const runClaimId = await claimActiveAgentRun(thread.id);
  if (!runClaimId) {
    return NextResponse.json(
      { error: "Atlas is still working in this chat. Your next message can steer it when this response lands." },
      { status: 409 }
    );
  }

  let run: Awaited<ReturnType<typeof start>> | null = null;
  try {
    await titleStudentAtlasSessionFromIntent(thread, userText);
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

    run = await start(studentAtlasTurnWorkflow, [{
      orgId: user.orgId,
      studentId: user.id,
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
    throw error;
  }

  return workflowStreamResponse(run.readable, { "x-workflow-run-id": run.runId });
}
