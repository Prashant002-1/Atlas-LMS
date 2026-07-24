import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { start } from "workflow/api";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { agentSessions } from "@/lib/db/schema";
import { resolvePlatformModel } from "@/lib/ai/platform-model";
import { persistSessionTurn } from "@/lib/agent/session-store";
import { workflowStreamResponse } from "@/lib/agent/workflow-stream";
import {
  activateAgentRun,
  activateDeadlineRun,
  claimActiveAgentRun,
  claimDeadlineRun,
  releaseAgentRunClaim,
  releaseDeadlineRunClaim,
} from "@/lib/agent/run-claims";
import {
  activeStudentEnrollment,
  getSessionSubmission,
  loadSessionAssignmentBundle,
  resumeOrCreateLiveSession,
  studentDisplayName,
} from "@/lib/agent/session-store";
import { sessionDeadlineWorkflow, studentTurnWorkflow } from "@/workflows/agent-session";

/**
 * The live session turn endpoint. The client sends only its latest message;
 * the server owns history, policy, side notes, and persistence. Every check
 * here fails closed before a token is generated.
 */

export const maxDuration = 120;
const MAX_SESSION_TURNS = 400;

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

export async function POST(request: Request, { params }: { params: Promise<{ assignmentId: string }> }) {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || !user.orgId) {
    return NextResponse.json({ error: "Sign in to take this assignment session." }, { status: 401 });
  }
  if (user.role !== "student") {
    return NextResponse.json({ error: "Sessions are taken by students." }, { status: 403 });
  }

  const { assignmentId } = await params;

  let body: { message?: IncomingMessage; text?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  const userText = textFromIncoming(body.message, body.text);
  if (!userText) {
    return NextResponse.json({ error: "Say something to the session." }, { status: 400 });
  }
  if (userText.length > 4000) {
    return NextResponse.json({ error: "Keep a turn under 4000 characters." }, { status: 400 });
  }

  const bundle = await loadSessionAssignmentBundle(user.orgId, assignmentId);
  if (!bundle) {
    return NextResponse.json({ error: "This assignment is not an AI assignment." }, { status: 404 });
  }

  const enrollment = await activeStudentEnrollment(user.orgId, bundle.assignment.courseId, user.id);
  if (!enrollment) {
    return NextResponse.json({ error: "You are not enrolled in this course." }, { status: 404 });
  }

  const resolved = resolvePlatformModel();
  if (!resolved) {
    return NextResponse.json(
      { error: "Atlas's model runtime is temporarily unavailable. Please try again later." },
      { status: 503 }
    );
  }

  const studentName = await studentDisplayName(user.orgId, user.id);
  const liveSession = await resumeOrCreateLiveSession({
    orgId: user.orgId,
    userId: user.id,
    courseId: bundle.assignment.courseId,
    assignmentId: bundle.assignment.id,
    title: `${bundle.assignment.name} - ${studentName}`,
  });

  const submission = await getSessionSubmission(user.orgId, liveSession.id);
  if (submission) {
    return NextResponse.json({ error: "This session is submitted and read-only." }, { status: 409 });
  }
  if (liveSession.totalTurns >= MAX_SESSION_TURNS) {
    return NextResponse.json({ error: "This session has hit its turn limit. Submit it." }, { status: 409 });
  }
  let deadlineAt = liveSession.deadlineAt;
  if (!deadlineAt) {
    const proposedDeadline = new Date(Date.now() + bundle.config.durationMinutes * 60_000);
    const [claimed] = await db
      .update(agentSessions)
      .set({ deadlineAt: proposedDeadline, updatedAt: new Date() })
      .where(and(eq(agentSessions.id, liveSession.id), isNull(agentSessions.deadlineAt)))
      .returning({ deadlineAt: agentSessions.deadlineAt });
    if (claimed?.deadlineAt) {
      deadlineAt = claimed.deadlineAt;
    } else {
      const [existing] = await db
        .select({ deadlineAt: agentSessions.deadlineAt })
        .from(agentSessions)
        .where(eq(agentSessions.id, liveSession.id))
        .limit(1);
      deadlineAt = existing?.deadlineAt ?? proposedDeadline;
    }
  }

  const deadlineClaimId = await claimDeadlineRun(liveSession.id);
  if (deadlineClaimId) {
    let deadlineRun: Awaited<ReturnType<typeof start>> | null = null;
    try {
      deadlineRun = await start(sessionDeadlineWorkflow, [{
        orgId: user.orgId,
        sessionId: liveSession.id,
        deadlineAt: deadlineAt.toISOString(),
        runClaimId: deadlineClaimId,
      }]);
      if (!(await activateDeadlineRun(liveSession.id, deadlineClaimId, deadlineRun.runId))) {
        await deadlineRun.cancel();
        return NextResponse.json({ error: "The session timer could not be scheduled. Try again." }, { status: 503 });
      }
    } catch (error) {
      if (!deadlineRun) await releaseDeadlineRunClaim(liveSession.id, deadlineClaimId);
      console.error("session deadline workflow failed to start", error);
      return NextResponse.json({ error: "The session timer could not be scheduled. Try again." }, { status: 503 });
    }
  }

  if (Date.now() >= deadlineAt.getTime()) {
    return NextResponse.json({ error: "Time is up. Atlas is closing and submitting this session." }, { status: 409 });
  }

  const runClaimId = await claimActiveAgentRun(liveSession.id);
  if (!runClaimId) {
    return NextResponse.json({ error: "Atlas is still responding. Your next message can steer it when this response lands." }, { status: 409 });
  }

  let run: Awaited<ReturnType<typeof start>> | null = null;
  try {
    const userTurnIndex = await persistSessionTurn(liveSession, "user", [{ type: "text" as const, text: userText }]);
    run = await start(studentTurnWorkflow, [{
      orgId: user.orgId,
      courseId: bundle.assignment.courseId,
      sessionId: liveSession.id,
      assignmentId: bundle.assignment.id,
      userText,
      userTurnIndex,
      runClaimId,
    }]);
    if (!(await activateAgentRun(liveSession.id, runClaimId, run.runId))) {
      await run.cancel();
      return NextResponse.json({ error: "Another Atlas run already owns this session." }, { status: 409 });
    }
  } catch (error) {
    if (!run) await releaseAgentRunClaim(liveSession.id, runClaimId);
    throw error;
  }

  return workflowStreamResponse(run.readable, {
    "x-workflow-run-id": run.runId,
    "x-session-deadline-at": deadlineAt.toISOString(),
  });
}
