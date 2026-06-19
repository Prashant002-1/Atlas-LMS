import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { changeProposals, enrollments, proposalBlocks } from "@/lib/db/schema";
import { requireTenant, isInstructorLike, UnauthorizedError, ForbiddenError } from "@/lib/auth/session";
import { buildContextPack } from "@/lib/agent/context";
import { commandSystemPrompt } from "@/lib/agent/runtime";
import {
  appendTurn,
  compactIfNeeded,
  loadCommandSession,
  titleCommandSessionFromIntent,
  updateCommandSessionEveCursor,
} from "@/lib/agent/session";
import { BLOCK_SCHEMA_VERSION, blockSchema, type Block } from "@/lib/agent/blocks";
import { eveBridgeAuthorization } from "@/lib/agent/eve-auth";
import type { AgentSession } from "@/lib/db/schema";
import type { Tenant } from "@/lib/auth/session";

export const maxDuration = 120;

type EveStartResponse = {
  ok?: boolean;
  sessionId?: string;
  continuationToken?: string;
  error?: string;
};

type EveEvent = {
  type: string;
  data?: unknown;
};

type ToolRequest = {
  callId: string;
  input: unknown;
  toolName: string;
};

const PROPOSAL_TOOL_TO_BLOCK: Record<string, Block["type"]> = {
  proposeObjective: "objective",
  proposeModule: "module",
  proposeAssignment: "assignment",
  proposePage: "page",
  proposeAnnouncement: "announcement",
  proposePracticeSet: "practice_set",
  proposeRubric: "rubric",
};

function proposalKind(blockType: Block["type"]): "course" | "module" | "assignment" | "objective" {
  if (blockType === "objective") return "objective";
  if (blockType === "module" || blockType === "practice_set") return "module";
  if (blockType === "assignment" || blockType === "rubric") return "assignment";
  return "course";
}

function firstText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseEvent(line: string): EveEvent | null {
  try {
    const event = JSON.parse(line) as EveEvent;
    return typeof event.type === "string" ? event : null;
  } catch {
    return null;
  }
}

function outputToBlock(output: unknown, fallbackType?: Block["type"]): Block | null {
  if (!output || typeof output !== "object") return null;
  const data = { ...(output as Record<string, unknown>) };
  if (!data.type && fallbackType) data.type = fallbackType;
  const parsed = blockSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

function blockToolName(block: Block): string {
  const found = Object.entries(PROPOSAL_TOOL_TO_BLOCK).find(([, blockType]) => blockType === block.type);
  return found?.[0] ?? block.type;
}

function blockData(block: Block): Record<string, unknown> {
  const data = { ...block } as Record<string, unknown>;
  delete data.type;
  return data;
}

function assistantParts(text: string, blocks: Block[]) {
  const parts: Array<Record<string, unknown>> = blocks.map((block) => ({
    type: `tool-${blockToolName(block)}`,
    state: "output-available",
    input: blockData(block),
  }));
  if (text.trim()) parts.push({ type: "text", text: text.trim() });
  return parts.length > 0 ? parts : [{ type: "text", text: "Done." }];
}

async function persistEveRun(input: {
  blocks: Block[];
  courseId: string;
  intent: string;
  session: AgentSession;
  text: string;
  tenant: Tenant;
}) {
  const { blocks, courseId, intent, session, tenant, text } = input;

  if (blocks.length > 0) {
    const [proposal] = await db
      .insert(changeProposals)
      .values({
        orgId: tenant.orgId,
        courseId,
        authorId: tenant.userId,
        kind: proposalKind(blocks[0].type),
        status: "pending",
        summary: (text.trim() || intent).slice(0, 280),
        diff: { intent, blocks: true, runtime: "eve" },
        sessionId: session.id,
      })
      .returning({ id: changeProposals.id });

    await db.insert(proposalBlocks).values(
      blocks.map((block, index) => ({
        orgId: tenant.orgId,
        proposalId: proposal.id,
        position: index + 1,
        blockType: block.type,
        schemaVersion: BLOCK_SCHEMA_VERSION,
        data: blockData(block),
      }))
    );
  }

  await appendTurn(session, "assistant", assistantParts(text, blocks));
  await compactIfNeeded(session);
}

async function requireInstructorCourse(tenant: Tenant, courseId: string) {
  if (tenant.role !== "instructor" && tenant.role !== "ta") return true;
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
  return Boolean(teaching);
}

async function sendToEve(req: Request, input: { courseId: string; intent: string; session: AgentSession; tenant: Tenant }) {
  const pack = await buildContextPack({
    orgId: input.tenant.orgId,
    courseId: input.courseId,
    audience: "instructor",
    userId: input.tenant.userId,
  });
  if (!pack.content) return { error: Response.json({ error: "Course not found." }, { status: 404 }) };

  const origin = new URL(req.url).origin;
  const authorization = eveBridgeAuthorization({
    userId: input.tenant.userId,
    orgId: input.tenant.orgId,
    role: input.tenant.role,
    courseId: input.courseId,
    atlasSessionId: input.session.id,
  });

  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (authorization) headers.Authorization = authorization;

  const continuing = Boolean(input.session.eveSessionId && input.session.eveContinuationToken);
  const url = continuing
    ? new URL(`/eve/v1/session/${input.session.eveSessionId}`, origin)
    : new URL("/eve/v1/session", origin);
  const payload = {
    ...(continuing ? { continuationToken: input.session.eveContinuationToken } : {}),
    message: input.intent,
    clientContext: [
      commandSystemPrompt(pack),
      `Atlas course id: ${input.courseId}`,
      `Atlas command session id: ${input.session.id}`,
      "Use the propose* tools for every draftable artifact. Finish with one short text line.",
    ],
  };

  const started = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  if (!started.ok) {
    const data = (await started.json().catch(() => null)) as EveStartResponse | null;
    return {
      error: Response.json(
        { error: data?.error ?? `Eve command runtime failed to start (${started.status}).` },
        { status: started.status }
      ),
    };
  }

  const data = (await started.json()) as EveStartResponse;
  const eveSessionId = data.sessionId ?? input.session.eveSessionId;
  if (!eveSessionId) {
    return { error: Response.json({ error: "Eve did not return a session id." }, { status: 502 }) };
  }

  await updateCommandSessionEveCursor(input.session, {
    eveSessionId,
    eveContinuationToken: data.continuationToken ?? input.session.eveContinuationToken,
  });

  const streamUrl = new URL(`/eve/v1/session/${eveSessionId}/stream`, origin);
  streamUrl.searchParams.set("startIndex", String(input.session.eveStreamIndex ?? 0));
  const stream = await fetch(streamUrl, { headers: authorization ? { Authorization: authorization } : undefined });
  if (!stream.ok || !stream.body) {
    return { error: Response.json({ error: `Eve command stream failed (${stream.status}).` }, { status: 502 }) };
  }

  return { body: stream.body };
}

function proxyEveStream(
  body: ReadableStream<Uint8Array>,
  input: { courseId: string; intent: string; session: AgentSession; tenant: Tenant }
) {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const toolRequests = new Map<string, ToolRequest>();
  const blocks: Block[] = [];
  const terminalMessages: string[] = [];
  let messageSoFar = "";
  let buffer = "";
  let eventCount = input.session.eveStreamIndex ?? 0;
  let settled = false;

  async function finish() {
    if (settled) return;
    settled = true;
    const text = terminalMessages.at(-1) ?? messageSoFar;
    await persistEveRun({ ...input, blocks, text });
    await updateCommandSessionEveCursor(input.session, { eveStreamIndex: eventCount });
  }

  function observe(event: EveEvent) {
    const data = (event.data && typeof event.data === "object" ? event.data : {}) as Record<string, unknown>;
    if (event.type === "actions.requested" && Array.isArray(data.actions)) {
      for (const action of data.actions) {
        if (!action || typeof action !== "object") continue;
        const a = action as Record<string, unknown>;
        if (a.kind !== "tool-call" || typeof a.callId !== "string" || typeof a.toolName !== "string") continue;
        toolRequests.set(a.callId, { callId: a.callId, input: a.input, toolName: a.toolName });
      }
    }

    if (event.type === "action.result") {
      const result = data.result && typeof data.result === "object" ? (data.result as Record<string, unknown>) : null;
      if (result?.kind === "tool-result" && typeof result.toolName === "string") {
        const request = typeof result.callId === "string" ? toolRequests.get(result.callId) : undefined;
        const fallbackType = PROPOSAL_TOOL_TO_BLOCK[result.toolName] ?? PROPOSAL_TOOL_TO_BLOCK[request?.toolName ?? ""];
        const block = outputToBlock(result.output, fallbackType);
        if (block) blocks.push(block);
      }
    }

    if (event.type === "message.appended") {
      messageSoFar = firstText(data.messageSoFar) ?? messageSoFar;
    }
    if (event.type === "message.completed" && data.finishReason !== "tool-calls") {
      const message = firstText(data.message);
      if (message) terminalMessages.push(message);
    }
  }

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = body.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            const event = parseEvent(line);
            if (!event) continue;
            eventCount += 1;
            observe(event);
            controller.enqueue(encoder.encode(`${line}\n`));
            if (event.type === "session.waiting" || event.type === "session.completed") {
              await finish();
              controller.close();
              await reader.cancel();
              return;
            }
            if (event.type === "turn.failed" || event.type === "session.failed") {
              await updateCommandSessionEveCursor(input.session, { eveStreamIndex: eventCount });
              controller.close();
              await reader.cancel();
              return;
            }
          }
        }
        await finish();
        controller.close();
      } catch (error) {
        controller.error(error);
      } finally {
        reader.releaseLock();
      }
    },
  });
}

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
  if (!sessionId) return Response.json({ error: "sessionId is required." }, { status: 400 });
  if (intent.length < 4) return Response.json({ error: "Say what you want drafted." }, { status: 400 });
  if (intent.length > 4000) return Response.json({ error: "Command is too long." }, { status: 400 });

  if (!(await requireInstructorCourse(tenant, courseId))) {
    return Response.json({ error: "You do not teach this course." }, { status: 403 });
  }

  const session = await loadCommandSession({ orgId: tenant.orgId, userId: tenant.userId, courseId }, sessionId);
  if (!session) return Response.json({ error: "Command session not found." }, { status: 404 });

  await titleCommandSessionFromIntent(session, intent);
  await appendTurn(session, "user", [{ type: "text", text: intent }]);

  const result = await sendToEve(req, { courseId, intent, session, tenant });
  if ("error" in result) return result.error;

  return new Response(proxyEveStream(result.body, { courseId, intent, session, tenant }), {
    headers: {
      "cache-control": "no-store, no-transform",
      "content-type": "application/x-ndjson; charset=utf-8",
      "x-accel-buffering": "no",
    },
  });
}
