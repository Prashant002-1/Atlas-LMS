import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createOpenAI } from "@ai-sdk/openai";

/**
 * Provider abstraction. The prototype hardcoded `:free` OpenRouter models (no SLA,
 * heavy rate limits, can vanish). Atlas defaults to real, paid-capable models and a
 * genuine fallback chain, all overridable by env.
 */
const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });
const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

const CHAT_MODEL = process.env.ATLAS_CHAT_MODEL ?? "openai/gpt-4.1";
const STRUCTURED_MODEL = process.env.ATLAS_STRUCTURED_MODEL ?? "openai/gpt-4.1";
const FALLBACK_MODEL = process.env.ATLAS_FALLBACK_MODEL ?? "openai/gpt-4.1-mini";

export function primaryModel() {
  return openrouter(CHAT_MODEL);
}

export function structuredModel() {
  return openrouter(STRUCTURED_MODEL);
}

/** A genuinely different, cheaper/more-available model — not an alias of primary. */
export function fallbackModel() {
  return openrouter(FALLBACK_MODEL);
}

// Embeddings: 1536 dims so pgvector HNSW indexing works (see ADR-004).
export const EMBEDDING_DIMS = 1536;
const EMBEDDING_MODEL_ID = process.env.ATLAS_EMBEDDING_MODEL ?? "text-embedding-3-small";

export function embeddingModel() {
  return openai.embedding(EMBEDDING_MODEL_ID);
}

export function isRetryableError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const m = err.message.toLowerCase();
  return m.includes("429") || m.includes("rate") || m.includes("overloaded") || m.includes("timeout");
}
