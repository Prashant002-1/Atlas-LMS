/**
 * Pure helpers for session recall: window/bookend index planning and text
 * shaping. No DB, no imports, so they stay trivially testable and deterministic.
 */

/**
 * Given the matched turn indexes and the session bounds [lo, hi], compute the
 * exact, deduped, sorted set of turn indexes to fetch: each match plus a
 * +/- `window` neighborhood, plus the first/last `bookends` turns.
 */
export function planRecallIndices(
  matchIndexes: number[],
  lo: number,
  hi: number,
  opts: { window: number; bookends: number }
): number[] {
  if (hi < lo) return [];
  const set = new Set<number>();
  const add = (i: number) => {
    if (i >= lo && i <= hi) set.add(i);
  };
  for (let i = 0; i < opts.bookends; i++) {
    add(lo + i);
    add(hi - i);
  }
  for (const m of matchIndexes) {
    for (let d = -opts.window; d <= opts.window; d++) add(m + d);
  }
  return [...set].sort((a, b) => a - b);
}

/** Is `index` within `window` of any match (i.e. a neighbor rather than a pure bookend)? */
export function isContextNeighbor(index: number, matchIndexes: number[], window: number): boolean {
  return matchIndexes.some((m) => Math.abs(m - index) <= window);
}

/** Flatten stored UIMessage-shaped parts into plain text for snippets/return. */
export function partsToText(parts: unknown): string {
  if (typeof parts === "string") return parts;
  if (!Array.isArray(parts)) return "";
  return (parts as Array<Record<string, unknown>>)
    .map((p) => {
      if (p.type === "text" && typeof p.text === "string") return p.text;
      if (typeof p.type === "string" && p.type.startsWith("tool-")) {
        const name = p.type.slice("tool-".length);
        const input = p.input !== undefined ? JSON.stringify(p.input) : "";
        return `[${name} ${input.slice(0, 300)}]`;
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

/** A short excerpt of `text` centered on the first matching query term. */
export function makeSnippet(text: string, query: string, radius = 120): string {
  const hay = text.toLowerCase();
  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((t) => t.length >= 2);
  let at = -1;
  for (const t of terms) {
    const i = hay.indexOf(t);
    if (i !== -1 && (at === -1 || i < at)) at = i;
  }
  if (at === -1) return text.slice(0, radius * 2).trim();
  const start = Math.max(0, at - radius);
  const end = Math.min(text.length, at + radius);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

export const clipText = (s: string, max: number) => (s.length <= max ? s : `${s.slice(0, max)}…`);
