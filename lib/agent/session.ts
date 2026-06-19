import { generateText, type ModelMessage, type UIMessage } from "ai";
import { and, asc, eq, gt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { agentSessions, agentTurns, changeProposals, proposalBlocks, type AgentSession } from "@/lib/db/schema";
import { parseStoredBlock, type Block } from "@/lib/agent/blocks";
import { estimateTokens } from "@/lib/agent/context";
import { fallbackModel } from "@/lib/ai/provider";

/**
 * Sessions, persistent, anchored, compacted.
 *
 * One session per (user, course, surface, anchor). The professor's command bar
 * resumes a single course-anchored session; each student cue thread anchors to
 * the record it was pressed on. History past the compaction threshold rolls into
 * a summary; recent turns travel verbatim. Identifiers (record ids, codes) are
 * preserved verbatim through compaction so grounding never drifts.
 */

export type SessionAnchor = {
  type: "assignment" | "module" | "page" | "course";
  id: string | null;
};

export type SessionScope = {
  orgId: string;
  userId: string;
  courseId: string;
  surface: "command" | "cue";
  anchor: SessionAnchor;
};

/** Verbatim-history budget; beyond this the older turns roll into the summary. */
const COMPACT_THRESHOLD_TOKENS = 12_000;
/** How many recent turns always stay verbatim. */
const KEEP_RECENT_TURNS = 6;

export async function resumeOrCreateSession(scope: SessionScope): Promise<AgentSession> {
  const anchorId = scope.anchor.id;
  const found = await db
    .select()
    .from(agentSessions)
    .where(
      and(
        eq(agentSessions.orgId, scope.orgId),
        eq(agentSessions.userId, scope.userId),
        eq(agentSessions.courseId, scope.courseId),
        eq(agentSessions.surface, scope.surface),
        eq(agentSessions.anchorType, scope.anchor.type),
        anchorId ? eq(agentSessions.anchorId, anchorId) : sql`${agentSessions.anchorId} IS NULL`
      )
    )
    .orderBy(asc(agentSessions.createdAt))
    .limit(1);
  if (found[0]) return found[0];

  const [created] = await db
    .insert(agentSessions)
    .values({
      orgId: scope.orgId,
      userId: scope.userId,
      courseId: scope.courseId,
      surface: scope.surface,
      anchorType: scope.anchor.type,
      anchorId,
    })
    .returning();
  return created;
}

export type TurnRecord = {
  turnIndex: number;
  role: "user" | "assistant" | "tool";
  parts: unknown;
};

/** The verbatim turns the next run should carry (everything after the compaction mark). */
export async function loadActiveTurns(session: AgentSession): Promise<TurnRecord[]> {
  const rows = await db
    .select({ turnIndex: agentTurns.turnIndex, role: agentTurns.role, parts: agentTurns.parts })
    .from(agentTurns)
    .where(and(eq(agentTurns.sessionId, session.id), gt(agentTurns.turnIndex, session.compactedThroughTurn)))
    .orderBy(asc(agentTurns.turnIndex));
  return rows;
}

export async function appendTurn(
  session: AgentSession,
  role: "user" | "assistant" | "tool",
  parts: unknown
): Promise<number> {
  const nextIndex = session.totalTurns + 1;
  await db.insert(agentTurns).values({
    orgId: session.orgId,
    sessionId: session.id,
    turnIndex: nextIndex,
    role,
    parts: parts as object,
    tokenEstimate: estimateTokens(JSON.stringify(parts ?? "")),
  });
  await db
    .update(agentSessions)
    .set({ totalTurns: nextIndex, updatedAt: new Date() })
    .where(eq(agentSessions.id, session.id));
  session.totalTurns = nextIndex;
  return nextIndex;
}

/** Convert stored UIMessage-shaped turns into plain model messages (text + tool traces flattened). */
export function turnsToModelMessages(turns: TurnRecord[]): ModelMessage[] {
  const messages: ModelMessage[] = [];
  for (const turn of turns) {
    const text = turnText(turn.parts);
    if (!text) continue;
    messages.push({ role: turn.role === "user" ? "user" : "assistant", content: text });
  }
  return messages;
}

function turnText(parts: unknown): string {
  if (typeof parts === "string") return parts;
  if (!Array.isArray(parts)) return "";
  return (parts as Array<Record<string, unknown>>)
    .map((p) => {
      if (p.type === "text" && typeof p.text === "string") return p.text;
      if (typeof p.type === "string" && p.type.startsWith("tool-")) {
        const name = p.type.slice("tool-".length);
        const input = p.input !== undefined ? JSON.stringify(p.input) : "";
        return `[${name} ${input.slice(0, 600)}]`;
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

/**
 * Roll old history into the session summary when the verbatim tail outgrows the
 * budget. Runs after a completed turn, off the hot path. Keeps record ids,
 * objective codes, and decisions verbatim so later turns can still cite them.
 */
export async function compactIfNeeded(session: AgentSession): Promise<void> {
  const turns = await loadActiveTurns(session);
  const tailTokens = turns.reduce((sum, t) => sum + estimateTokens(JSON.stringify(t.parts ?? "")), 0);
  if (tailTokens < COMPACT_THRESHOLD_TOKENS || turns.length <= KEEP_RECENT_TURNS) return;

  const toCompact = turns.slice(0, turns.length - KEEP_RECENT_TURNS);
  const transcript = toCompact.map((t) => `${t.role.toUpperCase()}: ${turnText(t.parts).slice(0, 2000)}`).join("\n\n");

  try {
    const { text } = await generateText({
      model: fallbackModel(),
      system:
        "Compress this working-session transcript into a dense brief for the agent's future turns. Preserve verbatim: record ids in [id:...] form, objective codes, titles, numeric decisions, and anything the user approved or rejected. Drop pleasantries and dead ends. Under 300 words.",
      prompt: `${session.summary ? `EARLIER SUMMARY:\n${session.summary}\n\n` : ""}TRANSCRIPT:\n${transcript}`,
    });

    await db
      .update(agentSessions)
      .set({
        summary: text,
        compactedThroughTurn: toCompact[toCompact.length - 1].turnIndex,
        updatedAt: new Date(),
      })
      .where(eq(agentSessions.id, session.id));
  } catch {
    // Compaction is an optimization; a failed pass must never break the session.
  }
}

/** Stored turns → UIMessages for client rendering (history hydration). */
export function turnsToUIMessages(turns: TurnRecord[]): UIMessage[] {
  return turns
    .filter((t) => t.role !== "tool")
    .map((t) => ({
      id: `turn-${t.turnIndex}`,
      role: t.role === "user" ? ("user" as const) : ("assistant" as const),
      parts: Array.isArray(t.parts) ? (t.parts as UIMessage["parts"]) : [{ type: "text" as const, text: String(t.parts ?? "") }],
    }));
}

export type SessionDraft = {
  proposalId: string;
  blocks: Block[];
};

/** Load durable draft blocks produced by a command session for history hydration. */
export async function loadSessionDrafts(orgId: string, sessionId: string): Promise<SessionDraft[]> {
  const rows = await db
    .select({
      proposalId: changeProposals.id,
      blockType: proposalBlocks.blockType,
      data: proposalBlocks.data,
    })
    .from(changeProposals)
    .innerJoin(
      proposalBlocks,
      and(eq(proposalBlocks.orgId, orgId), eq(proposalBlocks.proposalId, changeProposals.id))
    )
    .where(and(eq(changeProposals.orgId, orgId), eq(changeProposals.sessionId, sessionId)))
    .orderBy(asc(changeProposals.createdAt), asc(proposalBlocks.position));

  const drafts: SessionDraft[] = [];
  for (const row of rows) {
    const block = parseStoredBlock(row.blockType, row.data);
    if (!block) continue;
    const existing = drafts.find((draft) => draft.proposalId === row.proposalId);
    if (existing) {
      existing.blocks.push(block);
    } else {
      drafts.push({ proposalId: row.proposalId, blocks: [block] });
    }
  }
  return drafts;
}
