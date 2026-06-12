import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { EmbeddingModel, LanguageModel } from "ai";

/**
 * Provider registry. One place that knows how to turn a (provider, modelId, key)
 * triple into a Vercel AI SDK model, so chat/generation and embeddings can be
 * swapped per env or per org without touching call sites.
 *
 * Chat/generation providers:
 *   openrouter | openai | anthropic | google | openai_compatible
 * The `openai_compatible` slot points at ANY OpenAI-compatible base URL
 * (a local gateway, LiteLLM/vLLM/LM Studio, or an OpenAI-compatible proxy in
 * front of opencode). For opencode's native session API, see lib/ai/opencode.ts.
 *
 * Embeddings (course-content lookup only, never session recall): google
 * (gemini-embedding-002) by default, openai, or an openai_compatible endpoint.
 */

export type ChatProviderKind = "openrouter" | "openai" | "anthropic" | "google" | "openai_compatible";
export type EmbeddingProviderKind = "google" | "openai" | "openai_compatible";

export const CHAT_PROVIDERS: readonly ChatProviderKind[] = [
  "openrouter",
  "openai",
  "anthropic",
  "google",
  "openai_compatible",
] as const;

export type ChatModelSpec = {
  provider: ChatProviderKind;
  modelId: string;
  /** Explicit key (BYOK). When omitted, the env key for the provider is used. */
  apiKey?: string;
  /** Required for openai_compatible; ignored otherwise. */
  baseURL?: string;
};

/** Best-effort built-in model ids. All overridable via env; opencode/compat must set ATLAS_CHAT_MODEL. */
const BUILTIN_CHAT_MODEL: Record<ChatProviderKind, string> = {
  openrouter: "openai/gpt-4.1",
  openai: "gpt-4.1",
  anthropic: "claude-3-7-sonnet-latest",
  google: "gemini-2.5-pro",
  openai_compatible: "gpt-4.1",
};

export function createChatModel(spec: ChatModelSpec): LanguageModel {
  switch (spec.provider) {
    case "openrouter":
      return createOpenRouter({ apiKey: spec.apiKey ?? process.env.OPENROUTER_API_KEY })(spec.modelId);
    case "openai":
      return createOpenAI({ apiKey: spec.apiKey ?? process.env.OPENAI_API_KEY })(spec.modelId);
    case "anthropic":
      return createAnthropic({ apiKey: spec.apiKey ?? process.env.ANTHROPIC_API_KEY })(spec.modelId);
    case "google":
      return createGoogleGenerativeAI({ apiKey: spec.apiKey ?? googleApiKeyFromEnv() })(spec.modelId);
    case "openai_compatible": {
      const baseURL = spec.baseURL ?? process.env.ATLAS_OPENAI_COMPAT_BASE_URL;
      if (!baseURL) {
        throw new Error("openai_compatible provider requires a base URL (ATLAS_OPENAI_COMPAT_BASE_URL or org base_url).");
      }
      return createOpenAICompatible({
        name: "atlas-compat",
        baseURL,
        apiKey: spec.apiKey ?? process.env.ATLAS_OPENAI_COMPAT_API_KEY,
      })(spec.modelId);
    }
  }
}

function googleApiKeyFromEnv(): string | undefined {
  // @ai-sdk/google reads GOOGLE_GENERATIVE_AI_API_KEY; accept GEMINI_API_KEY as an alias.
  return process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GEMINI_API_KEY;
}

/** The env API key for a provider, or undefined when none is set. */
export function envApiKeyFor(provider: ChatProviderKind): string | undefined {
  switch (provider) {
    case "openrouter":
      return process.env.OPENROUTER_API_KEY || undefined;
    case "openai":
      return process.env.OPENAI_API_KEY || undefined;
    case "anthropic":
      return process.env.ANTHROPIC_API_KEY || undefined;
    case "google":
      return googleApiKeyFromEnv() || undefined;
    case "openai_compatible":
      return process.env.ATLAS_OPENAI_COMPAT_API_KEY || undefined;
  }
}

export function envBaseUrlFor(provider: ChatProviderKind): string | undefined {
  return provider === "openai_compatible" ? process.env.ATLAS_OPENAI_COMPAT_BASE_URL || undefined : undefined;
}

/** Does the environment carry enough to use this provider as a fallback? */
export function hasEnvCredentials(provider: ChatProviderKind): boolean {
  if (provider === "openai_compatible") return Boolean(envBaseUrlFor(provider));
  return Boolean(envApiKeyFor(provider));
}

export function defaultModelIdFor(provider: ChatProviderKind, role: "chat" | "structured" | "fallback" = "chat"): string {
  const override =
    role === "structured"
      ? process.env.ATLAS_STRUCTURED_MODEL
      : role === "fallback"
        ? process.env.ATLAS_FALLBACK_MODEL
        : process.env.ATLAS_CHAT_MODEL;
  return override ?? BUILTIN_CHAT_MODEL[provider];
}

/** Provider chosen by env (ATLAS_CHAT_PROVIDER), defaulting to openrouter. */
export function defaultChatProvider(): ChatProviderKind {
  const p = process.env.ATLAS_CHAT_PROVIDER as ChatProviderKind | undefined;
  return p && CHAT_PROVIDERS.includes(p) ? p : "openrouter";
}

export function defaultFallbackProvider(): ChatProviderKind {
  const p = process.env.ATLAS_FALLBACK_PROVIDER as ChatProviderKind | undefined;
  return p && CHAT_PROVIDERS.includes(p) ? p : defaultChatProvider();
}

/* ── env-default convenience models (used off the BYOK path, e.g. compaction) ── */

export function primaryModel(): LanguageModel {
  const provider = defaultChatProvider();
  return createChatModel({ provider, modelId: defaultModelIdFor(provider, "chat") });
}

export function structuredModel(): LanguageModel {
  const provider = defaultChatProvider();
  return createChatModel({ provider, modelId: defaultModelIdFor(provider, "structured") });
}

/** A genuinely different, cheaper/more-available model for compaction/retry. */
export function fallbackModel(): LanguageModel {
  const provider = defaultFallbackProvider();
  return createChatModel({ provider, modelId: defaultModelIdFor(provider, "fallback") });
}

/* ── embeddings (course content only) ─────────────────────────── */

// Output dims are pinned so vectors drop into the existing pgvector columns and
// stay HNSW-indexable (ADR-004). gemini-embedding-002 supports MRL truncation.
export const EMBEDDING_DIMS = Number(process.env.ATLAS_EMBEDDING_DIMS ?? 1536);

export function embeddingProviderKind(): EmbeddingProviderKind {
  const p = process.env.ATLAS_EMBEDDING_PROVIDER as EmbeddingProviderKind | undefined;
  return p === "openai" || p === "openai_compatible" ? p : "google";
}

export function embeddingModelId(): string {
  return process.env.ATLAS_EMBEDDING_MODEL ?? (embeddingProviderKind() === "openai" ? "text-embedding-3-small" : "gemini-embedding-002");
}

export function embeddingModel(): EmbeddingModel {
  const provider = embeddingProviderKind();
  const modelId = embeddingModelId();
  if (provider === "openai") {
    return createOpenAI({ apiKey: process.env.OPENAI_API_KEY }).textEmbeddingModel(modelId);
  }
  if (provider === "openai_compatible") {
    const baseURL = process.env.ATLAS_OPENAI_COMPAT_BASE_URL;
    if (!baseURL) throw new Error("openai_compatible embeddings require ATLAS_OPENAI_COMPAT_BASE_URL.");
    return createOpenAICompatible({ name: "atlas-compat", baseURL, apiKey: process.env.ATLAS_OPENAI_COMPAT_API_KEY }).textEmbeddingModel(
      modelId
    );
  }
  return createGoogleGenerativeAI({ apiKey: googleApiKeyFromEnv() }).textEmbeddingModel(modelId);
}

export function isRetryableError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const m = err.message.toLowerCase();
  return m.includes("429") || m.includes("rate") || m.includes("overloaded") || m.includes("timeout");
}
