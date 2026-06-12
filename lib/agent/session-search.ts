import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { agentTurns } from "@/lib/db/schema";
import { clipText, isContextNeighbor, makeSnippet, partsToText, planRecallIndices } from "@/lib/agent/recall-window";

/**
 * Session search, the Hermes lesson applied to Atlas: recall is cheap, keyword,
 * and bounded, with NO model call in the path.
 *
 *   FTS (here: Postgres tsvector/GIN on agent_turns.fts)
 *     -> match turn ids
 *     -> fetch ONLY a small window around each hit (+/- `window`) plus the
 *        conversation's opening/closing "bookend" turns
 *     -> return the raw DB turns; the agent scrolls if it needs more.
 *
 * This deliberately avoids the expensive old shape (match -> load whole session
 * -> format transcript -> summarize with an LLM). Snippets/windows are assembled
 * in code so the result stays deterministic and inspectable.
 *
 * NOT semantic search. Semantic course-content lookup is a separate concern and
 * uses embeddings (lib/ai/embeddings.ts); session recall stays keyword-only.
 */

export type RecallOptions = {
  /** Turns of context to include on each side of a hit. */
  window?: number;
  /** Opening + closing turns to always include for orientation. */
  bookends?: number;
  /** Max FTS hits to anchor windows on. */
  limit?: number;
  /** Per-turn text cap in the returned payload. */
  maxCharsPerTurn?: number;
};

export type RecallTurn = {
  turnIndex: number;
  role: string;
  text: string;
  /** "match" = an FTS hit, "context" = a neighbor, "bookend" = opening/closing. */
  via: "match" | "context" | "bookend";
  rank?: number;
  snippet?: string;
};

export type RecallResult = {
  query: string;
  totalTurns: number;
  matched: number;
  /** True when more hits existed than `limit`. */
  truncated: boolean;
  turns: RecallTurn[];
};

const DEFAULTS = { window: 5, bookends: 3, limit: 8, maxCharsPerTurn: 600 } as const;

/**
 * Search one session's turns by keyword and return a small, bounded view: the
 * matching snippets with their +/- window neighbors and the conversation's
 * bookends. Scoped to (orgId, sessionId). No LLM.
 */
export async function searchSession(
  orgId: string,
  sessionId: string,
  query: string,
  options: RecallOptions = {}
): Promise<RecallResult> {
  const window = options.window ?? DEFAULTS.window;
  const bookends = options.bookends ?? DEFAULTS.bookends;
  const limit = options.limit ?? DEFAULTS.limit;
  const maxChars = options.maxCharsPerTurn ?? DEFAULTS.maxCharsPerTurn;
  const trimmed = query.trim();

  const bounds = (await db.execute(sql`
    SELECT MIN(turn_index) AS lo, MAX(turn_index) AS hi, COUNT(*)::int AS n
    FROM agent_turns
    WHERE org_id = ${orgId} AND session_id = ${sessionId}
  `)) as unknown as { rows: Array<{ lo: number | null; hi: number | null; n: number }> };
  const lo = bounds.rows[0]?.lo ?? 0;
  const hi = bounds.rows[0]?.hi ?? 0;
  const totalTurns = bounds.rows[0]?.n ?? 0;
  if (!totalTurns || trimmed.length < 2) {
    return { query: trimmed, totalTurns, matched: 0, truncated: false, turns: [] };
  }

  const tsq = sql`websearch_to_tsquery('english', ${trimmed})`;
  const matchRes = (await db.execute(sql`
    SELECT turn_index, ts_rank(fts, ${tsq}) AS rank
    FROM agent_turns
    WHERE org_id = ${orgId} AND session_id = ${sessionId} AND fts @@ ${tsq}
    ORDER BY rank DESC, turn_index DESC
    LIMIT ${limit + 1}
  `)) as unknown as { rows: Array<{ turn_index: number; rank: number }> };
  const truncated = matchRes.rows.length > limit;
  const hits = matchRes.rows.slice(0, limit);
  const rankByIndex = new Map<number, number>(hits.map((r) => [Number(r.turn_index), Number(r.rank)]));
  const matchIndexes = [...rankByIndex.keys()];

  const wanted = planRecallIndices(matchIndexes, lo, hi, { window, bookends });
  if (wanted.length === 0) {
    return { query: trimmed, totalTurns, matched: matchIndexes.length, truncated, turns: [] };
  }

  const rows = await db
    .select({ turnIndex: agentTurns.turnIndex, role: agentTurns.role, parts: agentTurns.parts })
    .from(agentTurns)
    .where(and(eq(agentTurns.orgId, orgId), eq(agentTurns.sessionId, sessionId), inArray(agentTurns.turnIndex, wanted)))
    .orderBy(asc(agentTurns.turnIndex));

  const isBookend = (i: number) => i < lo + bookends || i > hi - bookends;

  const turns: RecallTurn[] = rows.map((r) => {
    const text = partsToText(r.parts);
    const isMatch = rankByIndex.has(r.turnIndex);
    const via: RecallTurn["via"] = isMatch
      ? "match"
      : isBookend(r.turnIndex) && !isContextNeighbor(r.turnIndex, matchIndexes, window)
        ? "bookend"
        : "context";
    return {
      turnIndex: r.turnIndex,
      role: r.role,
      text: clipText(text, maxChars),
      via,
      ...(isMatch ? { rank: rankByIndex.get(r.turnIndex), snippet: makeSnippet(text, trimmed) } : {}),
    };
  });

  return { query: trimmed, totalTurns, matched: matchIndexes.length, truncated, turns };
}

/**
 * Explicit scroll: load a contiguous window of turns around a center index.
 * Lets the agent expand context after a search without re-querying FTS.
 */
export async function loadTurnWindow(
  orgId: string,
  sessionId: string,
  centerTurn: number,
  before = 8,
  after = 8,
  maxChars = 600
): Promise<RecallTurn[]> {
  const wanted: number[] = [];
  for (let i = centerTurn - before; i <= centerTurn + after; i++) if (i >= 1) wanted.push(i);
  if (wanted.length === 0) return [];
  const rows = await db
    .select({ turnIndex: agentTurns.turnIndex, role: agentTurns.role, parts: agentTurns.parts })
    .from(agentTurns)
    .where(and(eq(agentTurns.orgId, orgId), eq(agentTurns.sessionId, sessionId), inArray(agentTurns.turnIndex, wanted)))
    .orderBy(asc(agentTurns.turnIndex));
  return rows.map((r) => ({
    turnIndex: r.turnIndex,
    role: r.role,
    text: clipText(partsToText(r.parts), maxChars),
    via: r.turnIndex === centerTurn ? "match" : "context",
  }));
}
