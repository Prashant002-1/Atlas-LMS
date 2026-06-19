import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { defineAgent } from "eve";
import type { LanguageModel } from "ai";

function atlasModel(): LanguageModel {
  const provider = process.env.ATLAS_CHAT_PROVIDER ?? "openai_compatible";
  const modelId = process.env.ATLAS_CHAT_MODEL ?? "gpt-4.1";

  if (provider === "openrouter") {
    return createOpenAICompatible({
      name: "openrouter",
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY,
    })(modelId);
  }

  if (provider === "openai") {
    return createOpenAI({ apiKey: process.env.OPENAI_API_KEY })(modelId);
  }

  if (provider === "anthropic") {
    return createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })(modelId);
  }

  if (provider === "google") {
    return createGoogleGenerativeAI({
      apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GEMINI_API_KEY,
    })(modelId);
  }

  return createOpenAICompatible({
    name: "atlas-compat",
    baseURL: process.env.ATLAS_OPENAI_COMPAT_BASE_URL ?? "http://127.0.0.1:4096/v1",
    apiKey: process.env.ATLAS_OPENAI_COMPAT_API_KEY,
  })(modelId);
}

export default defineAgent({
  model: atlasModel(),
  modelContextWindowTokens: 128_000,
  compaction: {
    thresholdPercent: 0.75,
  },
});
