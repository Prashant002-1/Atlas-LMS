import { embed, embedMany } from "ai";
import { embeddingModel, embeddingProviderKind, EMBEDDING_DIMS } from "@/lib/ai/provider";

export { EMBEDDING_DIMS };

/**
 * Embeddings are for ONE job: semantic lookup over large course content (the
 * syllabus, long pages/files). They are not used for session/message recall,
 * that path is keyword FTS (see lib/agent/session-search.ts), which is cheaper,
 * deterministic, and needs no model call.
 *
 * Default model: Google gemini-embedding-002, output truncated to EMBEDDING_DIMS
 * (1536) so vectors fit the existing pgvector columns (ADR-004). Truncated MRL
 * vectors are not unit-length, so we L2-normalize for stable cosine distance.
 */

/** Content shorter than this is not worth embedding; callers should keep it in the deterministic pack instead. */
export const MIN_EMBED_CHARS = Number(process.env.ATLAS_EMBED_MIN_CHARS ?? 280);

export function shouldEmbed(text: string | null | undefined): boolean {
  return Boolean(text && text.trim().length >= MIN_EMBED_CHARS);
}

type Task = "document" | "query";

function providerOptions(task: Task) {
  const kind = embeddingProviderKind();
  if (kind === "google") {
    return {
      google: {
        outputDimensionality: EMBEDDING_DIMS,
        taskType: task === "query" ? "RETRIEVAL_QUERY" : "RETRIEVAL_DOCUMENT",
      },
    };
  }
  if (kind === "openai") {
    return { openai: { dimensions: EMBEDDING_DIMS } };
  }
  return undefined;
}

function l2normalize(v: number[]): number[] {
  let sum = 0;
  for (const x of v) sum += x * x;
  const norm = Math.sqrt(sum);
  if (norm === 0 || !Number.isFinite(norm)) return v;
  return v.map((x) => x / norm);
}

/** Embed a document chunk for indexing (RETRIEVAL_DOCUMENT). */
export async function embedDocument(text: string): Promise<number[]> {
  const { embedding } = await embed({ model: embeddingModel(), value: text, providerOptions: providerOptions("document") });
  return l2normalize(embedding);
}

export async function embedDocuments(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const { embeddings } = await embedMany({ model: embeddingModel(), values: texts, providerOptions: providerOptions("document") });
  return embeddings.map(l2normalize);
}

/** Embed a search query (RETRIEVAL_QUERY) to compare against indexed documents. */
export async function embedQuery(text: string): Promise<number[]> {
  const { embedding } = await embed({ model: embeddingModel(), value: text, providerOptions: providerOptions("query") });
  return l2normalize(embedding);
}

/* Back-compat aliases (prior call sites used these names). Both index documents. */
export const embedText = embedDocument;
export const embedTexts = embedDocuments;
