import { stepCountIs, streamText, type ModelMessage } from "ai";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { changeProposals, enrollments } from "@/lib/db/schema";
import { requireTenant, isInstructorLike, UnauthorizedError, ForbiddenError } from "@/lib/auth/session";
import { buildContextPack } from "@/lib/agent/context";
import {
  loadCommandSession,
  resumeLatestCommandSession,
  titleCommandSessionFromIntent,
  loadActiveTurns,
  appendTurn,
  turnsToModelMessages,
  compactIfNeeded,
} from "@/lib/agent/session";
import { commandSystemPrompt, createCommandTools, type CommandRunState } from "@/lib/agent/runtime";
import { resolveModelForOrg } from "@/lib/agent/keys";

export const maxDuration = 120;

/**
 * The professor's command surface. One POST = one agent run = at most one
 * proposal. The response streams text + tool parts (block emissions) the client
 * renders live; the durable output is the proposal in Review.
 */
export async function POST(req: Request) {
  let tenant;
  try {
    tenant = await requireTenant();
  } catch (e) {
    const status = e instanceof UnauthorizedError ? 401 : e instanceof ForbiddenError ? 403 : 500;
    return Response.json({ error: (e as Error).message }, { status });
  }
  if (!isInstructorLike(tenant.role)) {
    return Response.json({ error: "Instructor access required." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const courseId = typeof body?.courseId === "string" ? body.courseId : null;
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId : null;
  const intent = typeof body?.intent === "string" ? body.intent.trim() : "";
  if (!courseId) return Response.json({ error: "courseId is required." }, { status: 400 });
  if (intent.length < 4) return Response.json({ error: "Say what you want drafted." }, { status: 400 });
  if (intent.length > 4000) return Response.json({ error: "Command is too long." }, { status: 400 });

  // Must actually teach this course (admins pass).
  if (tenant.role === "instructor" || tenant.role === "ta") {
    const [teaching] = await db
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.orgId, tenant.orgId),
          eq(enrollments.courseId, courseId),
          eq(enrollments.userId, tenant.userId),
          eq(enrollments.role, "instructor")
        )
      )
      .limit(1);
    if (!teaching) return Response.json({ error: "You do not teach this course." }, { status: 403 });
  }

  const resolved = await resolveModelForOrg(tenant.orgId);
  if (!resolved) {
    return Response.json(
      { error: "No model key is configured. Add your provider key in Course settings → Model access." },
      { status: 409 }
    );
  }

  const pack = await buildContextPack({ orgId: tenant.orgId, courseId, audience: "instructor", userId: tenant.userId });
  if (!pack.content) return Response.json({ error: "Course not found." }, { status: 404 });

  const sessionScope = {
    orgId: tenant.orgId,
    userId: tenant.userId,
    courseId,
  };
  const session = sessionId
    ? await loadCommandSession(sessionScope, sessionId)
    : await resumeLatestCommandSession(sessionScope);
  if (!session) return Response.json({ error: "Command session not found." }, { status: 404 });

  const history = turnsToModelMessages(await loadActiveTurns(session));
  await titleCommandSessionFromIntent(session, intent);
  await appendTurn(session, "user", [{ type: "text", text: intent }]);

  const state: CommandRunState = {
    orgId: tenant.orgId,
    userId: tenant.userId,
    courseId,
    sessionId: session.id,
    intent,
    proposalId: null,
    position: 0,
  };

  const messages: ModelMessage[] = [
    ...(session.summary ? [{ role: "user" as const, content: `Session so far (compacted): ${session.summary}` }] : []),
    ...history,
    { role: "user" as const, content: intent },
  ];

  const result = streamText({
    model: resolved.model,
    system: commandSystemPrompt(pack),
    messages,
    tools: createCommandTools(state),
    stopWhen: stepCountIs(12),
    onFinish: async ({ content }) => {
      await appendTurn(session, "assistant", content);
      // Title the proposal off the model's own one-line summary when present.
      if (state.proposalId) {
        const lastText = [...content].reverse().find((p) => p.type === "text");
        if (lastText && "text" in lastText && lastText.text.trim()) {
          await db
            .update(changeProposals)
            .set({ summary: lastText.text.trim().slice(0, 280) })
            .where(eq(changeProposals.id, state.proposalId));
        }
      }
      await compactIfNeeded(session);
    },
  });

  return result.toUIMessageStreamResponse({
    messageMetadata: () => ({ sessionId: session.id, proposalId: state.proposalId }),
  });
}
