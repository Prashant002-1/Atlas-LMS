import {
  formatFromBytes,
  formatFromExtension,
  toMarkdownBytes,
  type ConvertErrorCode,
} from "@firecrawl/anydoc";
import { z } from "zod";

export const DOCUMENT_PARSER_VERSION = "0.1.7";
export const MAX_DOCUMENT_MARKDOWN_CHARS = 2_000_000;

const ANYDOC_EXTENSIONS = new Set([
  "doc", "docx", "docm",
  "ppt", "pps", "pot", "pptx", "pptm", "ppsx", "ppsm",
  "xls", "xlsx", "xlsm", "xlsb",
  "odt", "ods", "odp", "rtf", "epub", "csv", "pdf",
]);

const PLAIN_TEXT_EXTENSIONS = new Set(["txt", "md"]);
const CODE_EXTENSIONS = new Set([
  "xml", "json", "jsonl", "yaml", "yml", "html", "css", "js", "jsx", "ts", "tsx", "mjs", "cjs",
  "py", "java", "c", "cc", "cpp", "h", "hpp", "go", "rs", "rb", "php", "swift", "kt", "kts",
  "sql", "sh", "zsh", "bash",
]);

export const DOCUMENT_EXTENSIONS = new Set([
  ...ANYDOC_EXTENSIONS,
  ...PLAIN_TEXT_EXTENSIONS,
  ...CODE_EXTENSIONS,
]);

export const documentSectionSchema = z.object({
  title: z.string().trim().min(1).max(240),
  content: z.string().trim().min(1).max(20_000),
  pageStart: z.number().int().positive().nullable().default(null),
  pageEnd: z.number().int().positive().nullable().default(null),
});

export const documentExtractionSchema = z.object({
  title: z.string().trim().min(1).max(300).nullable().default(null),
  summary: z.string().trim().min(1).max(4_000),
  contentMarkdown: z.string().trim().min(1).max(MAX_DOCUMENT_MARKDOWN_CHARS),
  sections: z.array(documentSectionSchema).max(80),
});

export type DocumentExtraction = z.infer<typeof documentExtractionSchema>;

export type ParsedDocument = {
  markdown: string;
  extraction: DocumentExtraction;
  parser: "anydoc" | "atlas-text";
  parserVersion: string;
  inputMode: "anydoc_markdown" | "utf8";
};

export class DocumentParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumentParseError";
  }
}

export function isDocumentFilename(filename: string): boolean {
  return DOCUMENT_EXTENSIONS.has(extensionOf(filename));
}

export async function parseDocumentBytes(args: {
  filename: string;
  bytes: Uint8Array;
}): Promise<ParsedDocument> {
  const extension = extensionOf(args.filename);
  if (!DOCUMENT_EXTENSIONS.has(extension)) {
    throw new DocumentParseError("Atlas does not support this document type.");
  }

  if (args.bytes.byteLength === 0) {
    throw new DocumentParseError("The document is empty.");
  }

  if (PLAIN_TEXT_EXTENSIONS.has(extension) || CODE_EXTENSIONS.has(extension)) {
    const text = decodeUtf8(args.bytes);
    const markdown = extension === "md" || extension === "txt"
      ? normalizeMarkdown(text)
      : fencedCode(text, extension);
    return parsedResult({
      filename: args.filename,
      markdown,
      parser: "atlas-text",
      parserVersion: "1",
      inputMode: "utf8",
    });
  }

  const detectedFormat = formatFromBytes(args.bytes);
  const extensionFormat = formatFromExtension(extension);
  const format = detectedFormat ?? extensionFormat;
  if (!format) throw new DocumentParseError("Atlas could not identify this document format.");

  try {
    const markdown = await toMarkdownBytes(args.bytes, format);
    return parsedResult({
      filename: args.filename,
      markdown,
      parser: "anydoc",
      parserVersion: DOCUMENT_PARSER_VERSION,
      inputMode: "anydoc_markdown",
    });
  } catch (error) {
    throw new DocumentParseError(parseFailureMessage(error, extension));
  }
}

export function extractionFromMarkdown(args: {
  filename: string;
  markdown: string;
}): DocumentExtraction {
  const markdown = normalizeMarkdown(args.markdown);
  assertUsefulMarkdown(markdown);

  const headingMatches = [...markdown.matchAll(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/gm)].slice(0, 80);
  const fallbackTitle = cleanFilename(args.filename);
  const firstLine = markdown.split("\n").find((line) => cleanInlineMarkdown(line)) ?? "";
  const firstHeading = headingMatches[0];
  const titleSource = firstHeading && (firstHeading.index ?? 0) < 10 ? firstHeading[2] : firstLine || fallbackTitle;
  const title = cleanInlineMarkdown(titleSource).slice(0, 300) || fallbackTitle;
  const sections = headingMatches.map((match, index) => {
    const start = (match.index ?? 0) + match[0].length;
    const end = headingMatches[index + 1]?.index ?? markdown.length;
    const content = markdown.slice(start, end).trim().slice(0, 20_000);
    const sectionTitle = cleanInlineMarkdown(match[2]).slice(0, 240) || `Section ${index + 1}`;
    return {
      title: sectionTitle,
      content: content || sectionTitle,
      pageStart: null,
      pageEnd: null,
    };
  });

  return documentExtractionSchema.parse({
    title,
    summary: summaryFromMarkdown(markdown, title),
    contentMarkdown: markdown,
    sections,
  });
}

export function documentParseErrorMessage(error: unknown): string {
  if (error instanceof DocumentParseError) return error.message;
  return "Atlas could not prepare a readable version of this document.";
}

function parsedResult(args: {
  filename: string;
  markdown: string;
  parser: ParsedDocument["parser"];
  parserVersion: string;
  inputMode: ParsedDocument["inputMode"];
}): ParsedDocument {
  const extraction = extractionFromMarkdown({ filename: args.filename, markdown: args.markdown });
  return {
    markdown: extraction.contentMarkdown,
    extraction,
    parser: args.parser,
    parserVersion: args.parserVersion,
    inputMode: args.inputMode,
  };
}

function decodeUtf8(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new DocumentParseError("This text document is not valid UTF-8.");
  }
}

function normalizeMarkdown(value: string): string {
  return value.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim();
}

function assertUsefulMarkdown(markdown: string) {
  if (!markdown) throw new DocumentParseError("Atlas found no readable text in this document.");
  if (markdown.length > MAX_DOCUMENT_MARKDOWN_CHARS) {
    throw new DocumentParseError("The readable document is too large for Atlas.");
  }
}

function fencedCode(value: string, language: string): string {
  const normalized = normalizeMarkdown(value);
  const longestFence = Math.max(2, ...[...normalized.matchAll(/`+/g)].map((match) => match[0].length));
  const fence = "`".repeat(longestFence + 1);
  return `${fence}${language}\n${normalized}\n${fence}`;
}

function summaryFromMarkdown(markdown: string, fallback: string): string {
  const paragraphs = markdown.split(/\n\s*\n/);
  let shortCandidate: string | null = null;
  for (const paragraph of paragraphs) {
    const candidate = paragraph
      .split("\n")
      .filter((line) => !/^\s{0,3}(#{1,6}|```|~~~|\|?\s*:?-{3})/.test(line))
      .join(" ")
      .replace(/^\s*(?:[-*+] |\d+[.)] )/gm, "")
      .trim();
    if ((candidate.match(/\|/g) ?? []).length >= 3) continue;
    const cleaned = cleanInlineMarkdown(candidate).replace(/\s+/g, " ").trim();
    if (cleaned === fallback) continue;
    if (cleaned.length >= 60) return cleaned.slice(0, 4_000);
    if (!shortCandidate && cleaned.length >= 20) shortCandidate = cleaned;
  }
  return (shortCandidate ?? fallback).slice(0, 4_000);
}

function cleanInlineMarkdown(value: string): string {
  return value
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[`*_~]/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanFilename(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return (base || "Document").slice(0, 300);
}

function parseFailureMessage(error: unknown, extension: string): string {
  const code = errorCode(error);
  if (code === "encrypted") return "Password-protected documents are not supported.";
  if (code === "resourceLimit") return "This document exceeded the parser's safety limits.";
  if (code === "malformed" || code === "missingPart") return "This document is damaged or incomplete.";
  if (code === "unsupported" && extension === "pdf") {
    return "Atlas found no readable text in this PDF. Scanned PDFs need OCR before upload.";
  }
  if (code === "unsupported") return "Atlas could not read this document format.";
  return "Atlas could not prepare a readable version of this document.";
}

function errorCode(error: unknown): ConvertErrorCode | null {
  if (!(error instanceof Error) || !("code" in error)) return null;
  const code = (error as Error & { code?: unknown }).code;
  return typeof code === "string" ? code as ConvertErrorCode : null;
}

function extensionOf(filename: string): string {
  return filename.toLowerCase().split(".").pop() ?? "";
}
