import {
  parseSessionArtifact,
  parseStoredSessionArtifact,
  type SessionArtifact,
} from "@/lib/agent/session-parts";

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
  finalArtifact: SessionArtifact | null;
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

  let finalArtifact: SessionArtifact | null = null;
  for (let i = orderedArtifacts.length - 1; i >= 0; i -= 1) {
    const parsed = parseSessionArtifact(orderedArtifacts[i].artifactType, orderedArtifacts[i].state);
    if (parsed) {
      finalArtifact = parsed.state;
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

/* ── evidence highlighting (drill-in rendering) ─────────────── */

export type SpanRange = {
  id: string;
  criterionKey: string;
  charStart: number;
  charEnd: number;
};

export type TextSegment = {
  text: string;
  /** Evidence spans covering this segment (empty = plain text). */
  spans: SpanRange[];
};

/**
 * Split a turn's text into contiguous segments by the evidence spans covering
 * them, boundary-sweep style, so the drill-in can render verified quotes
 * highlighted IN PLACE in the transcript. Overlapping spans stack (a segment
 * can carry several criteria); out-of-range offsets are clamped; the
 * concatenation of segments is always exactly the input text.
 */
export function splitTextBySpans(text: string, ranges: SpanRange[]): TextSegment[] {
  if (text.length === 0) return [];
  const clamped = ranges
    .map((range) => ({
      ...range,
      charStart: Math.max(0, Math.min(range.charStart, text.length)),
      charEnd: Math.max(0, Math.min(range.charEnd, text.length)),
    }))
    .filter((range) => range.charEnd > range.charStart);

  const boundaries = new Set<number>([0, text.length]);
  for (const range of clamped) {
    boundaries.add(range.charStart);
    boundaries.add(range.charEnd);
  }
  const points = [...boundaries].sort((a, b) => a - b);

  const segments: TextSegment[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const start = points[i];
    const end = points[i + 1];
    const covering = clamped.filter((range) => range.charStart <= start && range.charEnd >= end);
    segments.push({ text: text.slice(start, end), spans: covering });
  }
  return segments;
}

/** Render the frozen artifact as the plain-text submission body for the gradebook row. */
export function renderFinalArtifactBody(artifact: unknown, studentName: string): string {
  const parsed = parseStoredSessionArtifact(artifact);
  if (!parsed) {
    return `Assignment session submission by ${studentName}. Transcript submitted without a submission draft.`;
  }
  if (parsed.artifactType === "pricing_table") {
    const tierLines = parsed.state.tiers.map((tier) => `- ${tier.name}: $${tier.price.toFixed(2)} (${tier.fence})`);
    return [
      `Pricing Strategy Session final submission by ${studentName}. Recommended Pricing Tiers:`,
      ...tierLines,
      `Expected risk: ${parsed.state.expectedRisk}`,
    ].join("\n");
  }

  const sectionLines = parsed.state.sections.flatMap((section) => [
    section.heading,
    section.content ?? "",
    ...(section.fields ?? []).map((field) => `${field.label}: ${field.value}`),
    ...(section.items ?? []).map((item) => `- ${item}`),
  ]).filter(Boolean);
  return [
    `${parsed.state.title} submission by ${studentName}.`,
    parsed.state.summary ?? "",
    ...sectionLines,
  ].filter(Boolean).join("\n");
}
