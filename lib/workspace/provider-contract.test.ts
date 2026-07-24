import { test } from "node:test";
import assert from "node:assert/strict";
import {
  compactionInputThresholdTokens,
  compactionSummaryTokenBudget,
  createChatModel,
  modelContextWindowTokens,
} from "@/lib/ai/provider";
import { resolvePlatformModel } from "@/lib/ai/platform-model";

const platformModelEnv = [
  "ATLAS_CHAT_PROVIDER",
  "ATLAS_CHAT_MODEL",
  "ATLAS_OPENAI_COMPAT_BASE_URL",
  "ATLAS_OPENAI_COMPAT_API_KEY",
  "OPENROUTER_API_KEY",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "GEMINI_API_KEY",
] as const;

function structuredOutputCapability(model: unknown): boolean | undefined {
  return (model as { supportsStructuredOutputs?: boolean }).supportsStructuredOutputs;
}

test("official OpenCode compatible endpoints enable schema-constrained output", () => {
  const go = createChatModel({
    provider: "openai_compatible",
    modelId: "kimi-k3",
    apiKey: "test-key",
    baseURL: "https://opencode.ai/zen/go/v1",
  });
  const zen = createChatModel({
    provider: "openai_compatible",
    modelId: "kimi-k3",
    apiKey: "test-key",
    baseURL: "https://opencode.ai/zen/v1",
  });

  assert.equal(structuredOutputCapability(go), true);
  assert.equal(structuredOutputCapability(zen), true);
});

test("unknown compatible endpoints retain the conservative capability default", () => {
  const custom = createChatModel({
    provider: "openai_compatible",
    modelId: "custom-model",
    apiKey: "test-key",
    baseURL: "https://models.example.com/v1",
  });

  assert.equal(structuredOutputCapability(custom), false);
});

test("compaction uses half a known context window and a 160k unknown-model fallback", () => {
  const fable = createChatModel({
    provider: "anthropic",
    modelId: "claude-fable-5",
    apiKey: "test-key",
  });
  const unknown = createChatModel({
    provider: "openai_compatible",
    modelId: "custom-model",
    apiKey: "test-key",
    baseURL: "https://models.example.com/v1",
  });

  assert.equal(modelContextWindowTokens(fable), 1_000_000);
  assert.equal(compactionInputThresholdTokens(fable), 500_000);
  assert.equal(modelContextWindowTokens(unknown), undefined);
  assert.equal(compactionInputThresholdTokens(unknown), 160_000);
});

test("compaction summaries receive 10 to 15 percent of provider input", () => {
  assert.deepEqual(compactionSummaryTokenBudget(500_000), {
    sourceTokens: 500_000,
    minTokens: 50_000,
    targetTokens: 62_500,
    maxTokens: 75_000,
  });
  assert.deepEqual(compactionSummaryTokenBudget(), {
    sourceTokens: 160_000,
    minTokens: 16_000,
    targetTokens: 20_000,
    maxTokens: 24_000,
  });
});

test("platform model resolution is environment-only and accepts no actor scope", () => {
  withPlatformModelEnv(
    {
      ATLAS_CHAT_PROVIDER: "openai",
      ATLAS_CHAT_MODEL: "gpt-platform-test",
      OPENAI_API_KEY: "platform-test-key",
    },
    () => {
      assert.equal(resolvePlatformModel.length, 0);
      const resolved = resolvePlatformModel();
      assert.equal(resolved?.provider, "openai");
      assert.equal(resolved?.modelId, "gpt-platform-test");
    }
  );
});

test("platform model resolution can use another configured server provider", () => {
  withPlatformModelEnv(
    {
      ATLAS_CHAT_PROVIDER: "openrouter",
      ATLAS_CHAT_MODEL: "claude-platform-test",
      ANTHROPIC_API_KEY: "platform-test-key",
    },
    () => {
      const resolved = resolvePlatformModel();
      assert.equal(resolved?.provider, "anthropic");
      assert.equal(resolved?.modelId, "claude-platform-test");
    }
  );
});

test("platform model resolution reports missing server configuration", () => {
  withPlatformModelEnv({}, () => {
    assert.equal(resolvePlatformModel(), null);
  });
});

function withPlatformModelEnv(overrides: Partial<Record<(typeof platformModelEnv)[number], string>>, run: () => void) {
  const previous = new Map(platformModelEnv.map((name) => [name, process.env[name]]));
  for (const name of platformModelEnv) delete process.env[name];
  Object.assign(process.env, overrides);

  try {
    run();
  } finally {
    for (const [name, value] of previous) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}
