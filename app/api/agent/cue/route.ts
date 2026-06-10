import { stepCountIs, streamText, type ModelMessage } from "ai";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { cueEvents, enrollments, learningObjectives, contentAlignments } from "@/lib/db/schema";
import { requireTenant, UnauthorizedError, ForbiddenError } from "@/lib/auth/session";
import { buildContextPack } from "@/lib/agent/context";
import { resumeOrCreateSession, loadActiveTurns, appendTurn, turnsToModelMessages, compactIfNeeded } from "@/lib/agent/session";
import { cueSystemPrompt, createCueTools, type CueKind } from "@/lib/agent/runtime";
import { resolveModelForOrg } from "@/lib/agent/keys";

export const maxDuration = 60;

const CUE_KINDS: ReadonlySet<string> = new Set(["explain", "practice", "question"]);
const TARGET_TYPES: ReadonlySet<string> = new Set(["assignment", "module", "page", "course"]);

/**
 * The student cue surface. A cue is a button press anchored to a course record —
 * Explain this work, Practice this, one quick question. Whether the cue exists,
 * how deep it goes, and what voice it speaks in are the professor's policy.
 */
export async function POST(req: Request) {
  let tenant;
  try {
    tenant = await requireTenant();
  } catch (e) {
    const status = e instanceof UnauthorizedError ? 401 : e instanceof ForbiddenError ? 403 : 500;
    return Response.json({ error: (e as Error).message }, { status });
  }

  const body = await req.json().catch(() => null);
  const courseId = typeof body?.courseId === "string" ? body.courseId : null;
  const kind = typeof body?.kind === "string" && CUE_KINDS.has(body.kind) ? (body.kind as CueKind) : null;
  const targetType =
    typeof body?.targetType === "string" && TARGET_TYPES.has(body.targetType)
      ? (body.targetType as "assignment" | "module" | "page" | "course")
      : "course";
  const targetId = typeof body?.targetId === "string" ? body.targetId : null;
  const question = typeof body?.question === "string" ? body.question.trim().slice(0, 1200) : "";

  if (!courseId || !kind) return Response.json({ error: "courseId and kind are required." }, { status: 400 });
  if (kind === "question" && question.length < 4) {
    return Response.json({ error: "Type the question first." }, { status: 400 });
  }

  // Must be enrolled as a student in this course.
  const [enrollment] = await db
    .select({ id: enrollments.id, aiShareOptIn: enrollments.aiShareOptIn })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.orgId, tenant.orgId),
        eq(enrollments.courseId, courseId),
        eq(enrollments.userId, tenant.userId),
        eq(enrollments.role, "student"),
        eq(enrollments.state, "active")
      )
    )
    .limit(1);
  if (!enrollment) return Response.json({ error: "You are not enrolled in this course." }, { status: 403 });

  const pack = await buildContextPack({
    orgId: tenant.orgId,
    courseId,
    audience: "student",
    userId: tenant.userId,
    anchor: targetId && targetType !== "course" ? { type: targetType, id: targetId } : null,
  });
  if (!pack.content) return Response.json({ error: "Course not found." }, { status: 404 });

  /* The professor's policy gates everything. */
  const policy = pack.policy;
  const allowed =
    kind === "explain" ? policy?.allowExplain !== false : kind === "practice" ? policy?.allowPractice !== false : policy?.allowQuestions !== false;
  if (!allowed) {
    return Response.json({ error: "Your professor has turned this off for this course." }, { status: 403 });
  }

  const dailyLimit = policy?.studentDailyLimit ?? 40;
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const [{ used }] = await db
    .select({ used: sql<number>`count(*)::int` })
    .from(cueEvents)
    .where(
      and(
        eq(cueEvents.orgId, tenant.orgId),
        eq(cueEvents.courseId, courseId),
        eq(cueEvents.userId, tenant.userId),
        gte(cueEvents.createdAt, dayStart)
      )
    );
  if (used >= dailyLimit) {
    return Response.json({ error: "You have reached today's limit for this course. It resets tomorrow." }, { status: 429 });
  }

  const resolved = await resolveModelForOrg(tenant.orgId);
  if (!resolved) {
    return Response.json({ error: "Atlas is not connected to a model yet. Ask your professor." }, { status: 409 });
  }

  const session = await resumeOrCreateSession({
    orgId: tenant.orgId,
    userId: tenant.userId,
    courseId,
    surface: "cue",
    anchor: { type: targetType, id: targetType === "course" ? null : targetId },
  });

  /* Objective codes on the target — recorded for the (opt-in) struggle signal. */
  let objectiveCodes: string[] = [];
  if (targetId && targetType !== "course" && targetType !== "page") {
    const rows = await db
      .select({ code: learningObjectives.code })
      .from(contentAlignments)
      .innerJoin(learningObjectives, eq(contentAlignments.objectiveId, learningObjectives.id))
      .where(and(eq(contentAlignments.orgId, tenant.orgId), eq(contentAlignments.itemId, targetId)));
    objectiveCodes = rows.map((r) => r.code).sort();
  }

  await db.insert(cueEvents).values({
    orgId: tenant.orgId,
    courseId,
    userId: tenant.userId,
    sessionId: session.id,
    kind,
    targetType,
    targetId: targetType === "course" ? null : targetId,
    objectiveCodes,
    shared: Boolean(policy?.shareStruggleSignal && enrollment.aiShareOptIn),
  });

  const userText =
    kind === "question"
      ? question
      : kind === "explain"
        ? "Explain the focused record."
        : "Build me practice for the focused record.";

  const history = turnsToModelMessages(await loadActiveTurns(session));
  await appendTurn(session, "user", [{ type: "text", text: userText }]);

  const messages: ModelMessage[] = [
    ...(session.summary ? [{ role: "user" as const, content: `Earlier in this thread (compacted): ${session.summary}` }] : []),
    ...history,
    { role: "user" as const, content: userText },
  ];

  const result = streamText({
    model: resolved.model,
    system: cueSystemPrompt(pack, kind, policy),
    messages,
    tools: createCueTools(kind),
    stopWhen: stepCountIs(3),
    onFinish: async ({ content }) => {
      await appendTurn(session, "assistant", content);
      await compactIfNeeded(session);
    },
  });

  return result.toUIMessageStreamResponse();
}
