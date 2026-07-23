import { tool } from "ai";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { agentMemories, courses, enrollments, type AgentMemory } from "@/lib/db/schema";

/**
 * Agent memories: the small, curated, always-loaded observation store behind
 * the personal agents (ADR-0016). The design borrows the open Hermes Agent
 * memory mechanics: one narrow write tool (add, replace, remove), hard budgets
 * enforced in code so the store is curated rather than accumulated, an
 * instruction-control scan before any entry is accepted (memories are injected
 * into future prompts), exact-duplicate no-ops, and archive-not-delete so
 * every change keeps provenance.
 */

export const MEMORY_ENTRY_MAX_CHARS = 240;
export const MEMORY_ACTIVE_BUDGET_CHARS = 2200;
export const MEMORY_ACTIVE_MAX_ENTRIES = 40;

export const memoryKinds = ["strength", "gap", "preference", "goal", "context"] as const;
export type MemoryKind = (typeof memoryKinds)[number];

export type MemoryProfile = "student" | "professor";

export type MemoryScope = {
  orgId: string;
  userId: string;
  profile: MemoryProfile;
};

const unsafeMemoryText = [
  /ignore\s+(?:all\s+)?(?:previous|prior|system|developer)\s+instructions?/i,
  /(?:show|reveal|print|repeat|dump)\s+(?:the\s+)?(?:system|developer|hidden|privileged)\s+(?:prompt|instructions?)/i,
  /(?:bypass|override|disable)\s+(?:the\s+)?(?:guardrails?|authorization|permissions?|policy|rules?)/i,
  /you\s+(?:must|should)\s+(?:now\s+)?(?:always\s+)?(?:act|behave|respond)\s+as/i,
];

function assertMemoryTextIsSafe(content: string) {
  if (unsafeMemoryText.some((pattern) => pattern.test(content))) {
    throw new MemoryWriteError(
      "That note reads like an instruction rather than an observation. Rewrite it as a plain fact about the person."
    );
  }
}

class MemoryWriteError extends Error {}

export async function listActiveMemories(scope: MemoryScope): Promise<AgentMemory[]> {
  return db
    .select()
    .from(agentMemories)
    .where(
      and(
        eq(agentMemories.orgId, scope.orgId),
        eq(agentMemories.userId, scope.userId),
        eq(agentMemories.profile, scope.profile),
        eq(agentMemories.status, "active")
      )
    )
    .orderBy(asc(agentMemories.createdAt));
}

function activeChars(memories: AgentMemory[]): number {
  return memories.reduce((sum, memory) => sum + memory.content.length, 0);
}

export function memoryHandle(memory: Pick<AgentMemory, "id">): string {
  return memory.id.slice(0, 8);
}

/**
 * Frozen reference block for the prompt, one line per observation with a
 * stable handle the remember tool accepts, plus a usage header so the agent
 * can see how full the store is (the Hermes usage-header pattern).
 */
export function renderMemoriesForReference(memories: AgentMemory[]): string {
  const used = activeChars(memories);
  const header = `MEMORY [${Math.round((used / MEMORY_ACTIVE_BUDGET_CHARS) * 100)}% full - ${used}/${MEMORY_ACTIVE_BUDGET_CHARS} chars]`;
  if (memories.length === 0) {
    return `${header}\nNo durable observations yet. Record one with the remember tool when the conversation shows real evidence.`;
  }
  return [
    header,
    ...memories.map((memory) => `[m:${memoryHandle(memory)}] (${memory.kind}) ${memory.content}`),
  ].join("\n");
}

function resolveByHandle(memories: AgentMemory[], handle: string): AgentMemory {
  const compact = handle.trim().replace(/^\[?m:/, "").replace(/\]$/, "");
  if (compact.length < 4) throw new MemoryWriteError("Give the memory handle shown in MEMORY, like m:1a2b3c4d.");
  const matches = memories.filter((memory) => memory.id.startsWith(compact.toLowerCase()));
  if (matches.length === 0) throw new MemoryWriteError(`No active memory matches ${compact}.`);
  if (matches.length > 1) throw new MemoryWriteError(`More than one memory matches ${compact}; use more characters.`);
  return matches[0];
}

async function validateCourseRef(scope: MemoryScope, courseId: string): Promise<void> {
  const [course] = await db
    .select({ id: courses.id })
    .from(courses)
    .where(and(eq(courses.id, courseId), eq(courses.orgId, scope.orgId)))
    .limit(1);
  if (!course) throw new MemoryWriteError("That course is not in this organization.");
  if (scope.profile === "student") {
    const [enrollment] = await db
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.orgId, scope.orgId),
          eq(enrollments.courseId, courseId),
          eq(enrollments.userId, scope.userId),
          eq(enrollments.role, "student"),
          eq(enrollments.state, "active")
        )
      )
      .limit(1);
    if (!enrollment) throw new MemoryWriteError("That course is not one of this student's enrollments.");
  }
}

export type RememberInput = {
  action: "add" | "replace" | "remove";
  kind?: MemoryKind;
  content?: string;
  memoryId?: string;
  courseId?: string;
};

export type RememberResult =
  | { ok: true; action: "remember"; summary: string; handle?: string }
  | { ok: false; error: string };

/**
 * The one memory write path. Budgets and safety are enforced here, in code:
 * an over-budget add returns a structured error that tells the agent to
 * consolidate first, so the model cannot argue its way past the cap.
 */
export async function rememberMemory(
  scope: MemoryScope,
  sourceSessionId: string | null,
  input: RememberInput
): Promise<RememberResult> {
  try {
    const active = await listActiveMemories(scope);

    if (input.action === "remove") {
      if (!input.memoryId) throw new MemoryWriteError("Removing a memory needs its handle.");
      const target = resolveByHandle(active, input.memoryId);
      await db
        .update(agentMemories)
        .set({ status: "archived", archivedAt: new Date() })
        .where(eq(agentMemories.id, target.id));
      return { ok: true, action: "remember", summary: `Removed the note: ${clip(target.content, 80)}` };
    }

    const content = (input.content ?? "").replace(/\s+/g, " ").trim();
    if (content.length < 8) throw new MemoryWriteError("A durable observation needs a real sentence.");
    if (content.length > MEMORY_ENTRY_MAX_CHARS) {
      throw new MemoryWriteError(`Keep one observation under ${MEMORY_ENTRY_MAX_CHARS} characters.`);
    }
    assertMemoryTextIsSafe(content);
    const kind = input.kind ?? "context";
    if (!memoryKinds.includes(kind)) throw new MemoryWriteError("Unknown memory kind.");
    if (input.courseId) await validateCourseRef(scope, input.courseId);

    if (input.action === "replace") {
      if (!input.memoryId) throw new MemoryWriteError("Replacing a memory needs its handle.");
      const target = resolveByHandle(active, input.memoryId);
      const budgetAfter = activeChars(active) - target.content.length + content.length;
      if (budgetAfter > MEMORY_ACTIVE_BUDGET_CHARS) {
        throw new MemoryWriteError(
          `Memory is over budget (${budgetAfter}/${MEMORY_ACTIVE_BUDGET_CHARS} chars). Remove or consolidate an entry first.`
        );
      }
      const [created] = await db.transaction(async (tx) => {
        await tx
          .update(agentMemories)
          .set({ status: "archived", archivedAt: new Date() })
          .where(eq(agentMemories.id, target.id));
        return tx
          .insert(agentMemories)
          .values({
            orgId: scope.orgId,
            userId: scope.userId,
            profile: scope.profile,
            kind,
            courseId: input.courseId ?? target.courseId,
            content,
            sourceSessionId,
            replacesId: target.id,
          })
          .returning();
      });
      return {
        ok: true,
        action: "remember",
        summary: `Updated a note: ${clip(content, 100)}`,
        handle: memoryHandle(created),
      };
    }

    // add
    if (active.some((memory) => memory.content === content)) {
      return { ok: true, action: "remember", summary: "Already noted." };
    }
    if (active.length >= MEMORY_ACTIVE_MAX_ENTRIES) {
      throw new MemoryWriteError(
        `Memory holds ${MEMORY_ACTIVE_MAX_ENTRIES} entries already. Replace or remove one first.`
      );
    }
    const budgetAfter = activeChars(active) + content.length;
    if (budgetAfter > MEMORY_ACTIVE_BUDGET_CHARS) {
      throw new MemoryWriteError(
        `Memory is over budget (${budgetAfter}/${MEMORY_ACTIVE_BUDGET_CHARS} chars). Remove or consolidate an entry first.`
      );
    }
    const [created] = await db
      .insert(agentMemories)
      .values({
        orgId: scope.orgId,
        userId: scope.userId,
        profile: scope.profile,
        kind,
        courseId: input.courseId ?? null,
        content,
        sourceSessionId,
      })
      .returning();
    return {
      ok: true,
      action: "remember",
      summary: `Noted (${kind}): ${clip(content, 100)}`,
      handle: memoryHandle(created),
    };
  } catch (error) {
    if (error instanceof MemoryWriteError) return { ok: false, error: error.message };
    console.error("memory write failed", error);
    return { ok: false, error: "The note was not saved." };
  }
}

/** Archive several memories at once (used by nothing yet; kept for curation passes). */
export async function archiveMemories(scope: MemoryScope, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const rows = await db
    .update(agentMemories)
    .set({ status: "archived", archivedAt: new Date() })
    .where(
      and(
        eq(agentMemories.orgId, scope.orgId),
        eq(agentMemories.userId, scope.userId),
        eq(agentMemories.profile, scope.profile),
        eq(agentMemories.status, "active"),
        inArray(agentMemories.id, ids)
      )
    )
    .returning({ id: agentMemories.id });
  return rows.length;
}

function clip(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 3)}...`;
}

/**
 * The remember tool, shared by the professor and student runtimes. The output
 * shape matches direct-action results ({ ok, action, summary }) so the rooms
 * render a quiet receipt instead of a trace.
 */
export function personalMemoryTool(args: { scope: MemoryScope; sessionId: string }) {
  return tool({
    description:
      "Record, update, or drop one durable observation about this person: a strength, a recurring gap, a preference, or a goal. Use it only when the conversation shows real evidence, not for session-only context. The store is small and always in view under MEMORY; when it is full, consolidate with replace or remove before adding.",
    inputSchema: z.object({
      action: z.enum(["add", "replace", "remove"]),
      kind: z.enum(memoryKinds).optional().describe("What kind of observation this is. Defaults to context."),
      content: z
        .string()
        .trim()
        .max(MEMORY_ENTRY_MAX_CHARS)
        .optional()
        .describe("The observation, one plain sentence. Required for add and replace."),
      memoryId: z
        .string()
        .trim()
        .max(40)
        .optional()
        .describe("The m: handle shown in MEMORY. Required for replace and remove."),
      courseId: z.string().uuid().optional().describe("The course this observation belongs to, when it is course specific."),
    }),
    execute: (input) => rememberMemory(args.scope, args.sessionId, input),
  });
}
