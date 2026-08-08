import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, resolve, sep } from "node:path";

import {
  DOCUMENT_PARSER_VERSION,
  documentParseErrorMessage,
  parseDocumentBytes,
  type ParsedDocument,
} from "@/lib/course/document-parser";

export type PreparedSeedDocument = {
  assetPath: string;
  sourceFilename: string;
  bytes: Buffer;
  checksumSha256: string;
  parsed: ParsedDocument | null;
  error: string | null;
};

const preparedByPath = new Map<string, Promise<PreparedSeedDocument>>();

export function prepareSeedDocument(assetPath: string): Promise<PreparedSeedDocument> {
  const existing = preparedByPath.get(assetPath);
  if (existing) return existing;
  const prepared = prepare(assetPath);
  preparedByPath.set(assetPath, prepared);
  return prepared;
}

export function seedDocumentMetadata(prepared: PreparedSeedDocument) {
  return {
    originalStorage: "postgres",
    seedAssetPath: prepared.assetPath,
    parser: prepared.parsed ? { name: prepared.parsed.parser, version: prepared.parsed.parserVersion } : null,
    canonicalText: prepared.parsed ? "markdown" : null,
    anydocVersion: DOCUMENT_PARSER_VERSION,
  };
}

async function prepare(assetPath: string): Promise<PreparedSeedDocument> {
  if (!assetPath.startsWith("/seed-assets/")) {
    throw new Error(`Seed document path must stay under /seed-assets/: ${assetPath}`);
  }
  const root = resolve(process.cwd(), "public", "seed-assets");
  const path = resolve(process.cwd(), "public", assetPath.slice(1));
  if (path !== root && !path.startsWith(`${root}${sep}`)) {
    throw new Error(`Seed document path escapes the asset root: ${assetPath}`);
  }

  const bytes = await readFile(path);
  const sourceFilename = basename(path);
  const checksumSha256 = createHash("sha256").update(bytes).digest("hex");
  try {
    const parsed = await parseDocumentBytes({ filename: sourceFilename, bytes });
    return { assetPath, sourceFilename, bytes, checksumSha256, parsed, error: null };
  } catch (error) {
    return {
      assetPath,
      sourceFilename,
      bytes,
      checksumSha256,
      parsed: null,
      error: documentParseErrorMessage(error),
    };
  }
}
