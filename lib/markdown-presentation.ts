const LEADING_HEADING = /^\s{0,3}#{1,6}[ \t]+([^\r\n]+)(?:\r?\n+|$)/u;

/**
 * Stored record prose is Markdown, but record pages already own their title.
 * Remove only a matching leading heading so the title is not shown twice.
 */
export function markdownBody(markdown: string, recordTitle: string): string {
  const source = markdown.trim();
  const leading = source.match(LEADING_HEADING);
  if (!leading || normalize(leading[1]) !== normalize(recordTitle)) return source;
  return source.slice(leading[0].length).trimStart();
}

/** Plain text for a compact row that cannot lay out Markdown blocks. */
export function markdownPreview(markdown: string, recordTitle: string): string {
  return markdownToPlainText(markdownBody(markdown, recordTitle));
}

function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/```[^\r\n]*\r?\n?/gu, "")
    .replace(/```/gu, "")
    .replace(/^\s{0,3}#{1,6}[ \t]+/gmu, "")
    .replace(/^\s{0,3}>[ \t]?/gmu, "")
    .replace(/^\s*(?:[-+*]|\d+[.)])[ \t]+/gmu, "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/gu, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/gu, "$1")
    .replace(/<https?:\/\/[^>]+>/gu, (value) => value.slice(1, -1))
    .replace(/<[^>]+>/gu, "")
    .replace(/(\*\*|__)(.*?)\1/gu, "$2")
    .replace(/(\*|_)(.*?)\1/gu, "$2")
    .replace(/~~(.*?)~~/gu, "$1")
    .replace(/`([^`]+)`/gu, "$1")
    .replace(/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/gmu, " ")
    .replace(/\|/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function normalize(value: string): string {
  return markdownToPlainText(value)
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
