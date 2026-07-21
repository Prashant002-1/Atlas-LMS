import { test } from "node:test";
import assert from "node:assert/strict";
import { createChatModel } from "@/lib/ai/provider";

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
