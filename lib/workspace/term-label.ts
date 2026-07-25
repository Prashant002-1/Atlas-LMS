/**
 * Term names, abbreviated the way a registrar writes them.
 *
 * A page header is a location marker, not a sentence. "ECON-241 / Summer 2026"
 * spends most of its width restating a season nobody misreads, and it pushes
 * the code, which is the part you actually scan for, off to the side. The
 * standard academic short form is compact and unambiguous: SU '26.
 *
 * Term first, then course, because term is the wider container: SU '26 /
 * ECON-241 reads outside in, the way the scope itself nests.
 */

const SEASONS: Array<{ match: RegExp; code: string }> = [
  { match: /\bspring\b/i, code: "SP" },
  { match: /\bsummer\b/i, code: "SU" },
  { match: /\bfall|autumn\b/i, code: "FA" },
  { match: /\bwinter\b/i, code: "WI" },
  { match: /\bintersession|interterm\b/i, code: "IN" },
];

/**
 * Abbreviate one term name. Anything that does not parse as season plus year
 * is returned as it was: a made-up abbreviation would be worse than the full
 * name a registrar chose.
 */
export function shortTermLabel(termName: string | null | undefined): string {
  const name = termName?.trim();
  if (!name) return "";

  const season = SEASONS.find((entry) => entry.match.test(name));
  const year = /\b((?:19|20)(\d{2}))\b/.exec(name);
  if (!season || !year) return name;

  return `${season.code} '${year[2]}`;
}

/**
 * The scope line a page header shows: term outside, course inside. Either half
 * may be missing without leaving a stray separator.
 */
export function scopeLabel(args: { code?: string | null; termName?: string | null }): string {
  const term = shortTermLabel(args.termName);
  const code = args.code?.trim() ?? "";
  if (term && code) return `${term} / ${code}`;
  return term || code;
}
