import { pricingArtifactSchema, type PricingArtifact } from "@/lib/agent/session-parts";

/**
 * Transcript normalization, the bridge between a live session and the grading
 * pipeline. Submit freezes the session into this shape; evidence spans are
 * (turnId, charStart, charEnd) offsets into each turn's `text`, so the
 * extraction here must stay boring and deterministic:
 *
 *   - one normalized turn per stored agent turn, stable db ids carried over;
 *   - `text` is the concatenation of the turn's text parts, in order,
 *     joined with a blank line; tool calls and data parts contribute NOTHING
 *     to `text` (quotes must come from what a person actually typed or read);
 *   - original parts ride along untouched for replay in the drill-in view.
 *
 * Change the text extraction and every stored span silently misaligns, treat
 * this file like a wire format.
 */

export type NormalizedTurn = {
  id: string;
  turnIndex: number;
  role: "user" | "assistant" | "tool";
  text: string;
  parts: unknown[];
};

export type NormalizedArtifactState = {
  id: string;
  turnIndex: number;
  artifactType: string;
  state: unknown;
};

export type NormalizedTranscript = {
  turns: NormalizedTurn[];
  artifactStates: NormalizedArtifactState[];
  finalArtifact: PricingArtifact | null;
  turnCount: number;
};

export type StoredTurnRow = {
  id: string;
  turnIndex: number;
  role: "user" | "assistant" | "tool";
  parts: unknown;
};

export type StoredArtifactRow = {
  id: string;
  turnIndex: number;
  artifactType: string;
  state: unknown;
};

/** Plain-text extraction for one turn; the span-verification target. */
export function turnPlainText(parts: unknown): string {
  if (typeof parts === "string") return parts;
  if (!Array.isArray(parts)) return "";
  const texts: string[] = [];
  for (const part of parts as Array<Record<string, unknown>>) {
    if (part && part.type === "text" && typeof part.text === "string") {
      texts.push(part.text);
    }
  }
  return texts.join("\n\n");
}

export function normalizeSessionTranscript(
  turnRows: StoredTurnRow[],
  artifactRows: StoredArtifactRow[]
): NormalizedTranscript {
  const orderedTurns = [...turnRows].sort((a, b) => a.turnIndex - b.turnIndex);
  const turns: NormalizedTurn[] = orderedTurns.map((row) => ({
    id: row.id,
    turnIndex: row.turnIndex,
    role: row.role,
    text: turnPlainText(row.parts),
    parts: Array.isArray(row.parts) ? (row.parts as unknown[]) : [],
  }));

  const orderedArtifacts = [...artifactRows].sort((a, b) => a.turnIndex - b.turnIndex);
  const artifactStates: NormalizedArtifactState[] = orderedArtifacts.map((row) => ({
    id: row.id,
    turnIndex: row.turnIndex,
    artifactType: row.artifactType,
    state: row.state,
  }));

  let finalArtifact: PricingArtifact | null = null;
  for (let i = orderedArtifacts.length - 1; i >= 0; i -= 1) {
    const parsed = pricingArtifactSchema.safeParse(orderedArtifacts[i].state);
    if (parsed.success) {
      finalArtifact = parsed.data;
      break;
    }
  }

  return { turns, artifactStates, finalArtifact, turnCount: turns.length };
}

/**
 * Verify a quote against a normalized turn by exact string match. The grading
 * pipeline (Phase 3) calls this before any span may influence a score or
 * reach a UI; it lives here so the contract ships with the transcript shape.
 */
export function verifyQuote(
  turn: NormalizedTurn,
  quote: string
): { verified: true; charStart: number; charEnd: number } | { verified: false } {
  if (!quote) return { verified: false };
  const charStart = turn.text.indexOf(quote);
  if (charStart === -1) return { verified: false };
  return { verified: true, charStart, charEnd: charStart + quote.length };
}

/** Render the frozen artifact as the plain-text submission body for the gradebook row. */
export function renderFinalArtifactBody(artifact: PricingArtifact | null, studentName: string): string {
  if (!artifact) {
    return `Pricing Strategy Session final submission by ${studentName}. Session transcript submitted without a final artifact state.`;
  }
  const tierLines = artifact.tiers.map((tier) => `- ${tier.name}: $${tier.price.toFixed(2)} (${tier.fence})`);
  return [
    `Pricing Strategy Session final submission by ${studentName}. Recommended Pricing Tiers:`,
    ...tierLines,
    `Expected risk: ${artifact.expectedRisk}`,
  ].join("\n");
}
