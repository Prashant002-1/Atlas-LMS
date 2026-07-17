import { NextResponse } from "next/server";
import { and, eq, gte, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { agentSessions, agentTurns } from "@/lib/db/schema";
import { resolveModelForOrg } from "@/lib/agent/keys";
import { loadActiveCourseAgentConfig } from "@/lib/agent/course-agent-config";
import { runSessionTurn } from "@/lib/agent/session-runtime";
import {
  activeStudentEnrollment,
  getSessionSubmission,
  loadSessionAssignmentBundle,
  resumeOrCreateLiveSession,
  studentDisplayName,
} from "@/lib/agent/session-store";

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

async function withinStudentDailyTurnLimit(args: {
  orgId: string;
  courseId: string;
  studentId: string;
  limit: number;
}) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [usage] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(agentTurns)
    .innerJoin(agentSessions, eq(agentSessions.id, agentTurns.sessionId))
    .where(
      and(
        eq(agentTurns.orgId, args.orgId),
        eq(agentTurns.role, "user"),
        eq(agentSessions.orgId, args.orgId),
        eq(agentSessions.courseId, args.courseId),
        eq(agentSessions.userId, args.studentId),
        eq(agentSessions.surface, "cue"),
        gte(agentTurns.createdAt, since)
      )
    );
  return Number(usage?.count ?? 0) < args.limit;
}

export async function POST(request: Request, { params }: { params: Promise<{ assignmentId: string }> }) {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || !user.orgId) {
    return NextResponse.json({ error: "Sign in to work a session." }, { status: 401 });
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

  const courseAgent = await loadActiveCourseAgentConfig(user.orgId, bundle.assignment.courseId);
  if (
    !(await withinStudentDailyTurnLimit({
      orgId: user.orgId,
      courseId: bundle.assignment.courseId,
      studentId: user.id,
      limit: courseAgent.configuration.limits.studentDailyTurns,
    }))
  ) {
    return NextResponse.json(
      { error: "You have reached the course agent turn limit for the last 24 hours." },
      { status: 429, headers: { "Retry-After": "3600" } }
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

  const resolved = await resolveModelForOrg(user.orgId);
  if (!resolved) {
    return NextResponse.json(
      { error: "Atlas is temporarily unavailable for this institution. Contact your administrator." },
      { status: 503 }
    );
  }

  return runSessionTurn({
    session: liveSession,
    bundle,
    courseAgent,
    model: resolved.model,
    userText,
  });
}
