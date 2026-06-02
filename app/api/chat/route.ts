import {
  convertToModelMessages,
  createIdGenerator,
  stepCountIs,
  streamText,
  validateUIMessages,
  type UIMessage,
} from "ai";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { chatSessions } from "@/lib/db/schema";
import { primaryModel, fallbackModel, isRetryableError } from "@/lib/ai/provider";
import { requireTenant, isInstructorLike, UnauthorizedError, ForbiddenError } from "@/lib/auth/session";
import { createStudentTools } from "@/lib/ai/tools/student-tools";
import { createInstructorTools } from "@/lib/ai/tools/instructor-tools";
import type { ChatToolContext } from "@/lib/ai/tools/shared";
import type { WorkspacePersona } from "@/lib/workspace/contracts";

export const maxDuration = 60;

const messageIdGenerator = createIdGenerator({ prefix: "msg", size: 16 });

function studentSystemPrompt(context: string | null) {
  return `You are Atlas, an AI tutor that lives inside the student's course.
Operate the student's study workspace. Before updating it, call setWorkspaceDecision with goal, focus, view, panels, actions, reason, and evidence.

Student views: todayDesk (what to do now), weekMap (week workload), assignmentFocus (one assignment), coursePulse (course risk), searchResults, studySession (grounded tutoring), objectiveCoverage (am I aligned to the syllabus?).

Ground every answer in the student's real course data via tools — never invent grades, deadlines, or content. When tutoring, teach from the course's own materials and cite them; prefer Socratic guidance over just handing over answers. Surface objective coverage so the student is never surprised by what's assessed.

Context: ${context ?? "none"}`;
}

function instructorSystemPrompt(context: string | null) {
  return `You are Atlas, an AI instructional designer working alongside a professor.
You build and refine courses so the professor curates instead of constructs. Before updating the workspace, call setWorkspaceDecision with goal, focus, view, panels, actions, reason, and evidence.

Instructor views: courseBuilder, syllabusComposer, assessmentBuilder, gradingDesk, classInsights, objectiveMap.

Every change you make is a PROPOSAL the professor reviews and approves — never claim something is live until approved. Always tie content to learning objectives (and program outcomes when relevant). Draft strong, specific pedagogy: real objectives with Bloom levels, modules in a sensible sequence, assessments aligned to objectives, accessible content.

Context: ${context ?? "none"}`;
}

type SessionRow = typeof chatSessions.$inferSelect;

async function loadOrCreateSession(
  ctx: { orgId: string; userId: string },
  persona: WorkspacePersona,
  courseId: string | null
): Promise<SessionRow> {
  const existing = await db
    .select()
    .from(chatSessions)
    .where(and(eq(chatSessions.orgId, ctx.orgId), eq(chatSessions.userId, ctx.userId), eq(chatSessions.persona, persona)))
    .orderBy(desc(chatSessions.updatedAt))
    .limit(1);
  if (existing[0]) return existing[0];

  const [created] = await db
    .insert(chatSessions)
    .values({ orgId: ctx.orgId, userId: ctx.userId, persona, courseId, messages: [] })
    .returning();
  return created;
}

export async function POST(req: Request) {
  let tenant;
  try {
    tenant = await requireTenant();
  } catch (e) {
    const status = e instanceof UnauthorizedError ? 401 : e instanceof ForbiddenError ? 403 : 500;
    return Response.json({ error: (e as Error).message }, { status });
  }

  const body = await req.json();
  const incoming = body?.message as UIMessage | undefined;
  const context = typeof body?.context === "string" ? body.context : null;
  const courseId = typeof body?.courseId === "string" ? body.courseId : null;

  // Persona is gated by role: only instructor-like users can drive authoring tools.
  const requestedPersona: WorkspacePersona = body?.persona === "instructor" ? "instructor" : "student";
  const persona: WorkspacePersona = requestedPersona === "instructor" && isInstructorLike(tenant.role) ? "instructor" : "student";

  const session = await loadOrCreateSession(tenant, persona, courseId);

  const ctx: ChatToolContext = {
    userId: tenant.userId,
    orgId: tenant.orgId,
    role: tenant.role,
    persona,
    sessionId: session.id,
    courseId: courseId ?? session.courseId ?? null,
  };

  const tools = persona === "instructor" ? createInstructorTools(ctx) : createStudentTools(ctx);

  const stored = (Array.isArray(session.messages) ? session.messages : []) as UIMessage[];
  const merged = incoming ? [...stored, incoming] : stored;
  const validated = await validateUIMessages<UIMessage>({
    messages: merged.filter((m) => Array.isArray(m.parts) && m.parts.length > 0),
  });

  const system = persona === "instructor" ? instructorSystemPrompt(context) : studentSystemPrompt(context);
  const modelMessages = await convertToModelMessages(validated, { tools });

  let result;
  try {
    result = streamText({ model: primaryModel(), system, messages: modelMessages, tools, stopWhen: stepCountIs(8) });
  } catch (err) {
    if (!isRetryableError(err)) throw err;
    result = streamText({ model: fallbackModel(), system, messages: modelMessages, tools, stopWhen: stepCountIs(8) });
  }

  result.consumeStream();

  return result.toUIMessageStreamResponse({
    originalMessages: validated,
    generateMessageId: messageIdGenerator,
    onFinish: async ({ messages: finalMessages }) => {
      await db
        .update(chatSessions)
        .set({ messages: finalMessages as object, courseId: ctx.courseId, updatedAt: new Date() })
        .where(eq(chatSessions.id, session.id));
    },
  });
}
