import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { db } from "@/lib/db";
import { orgProviderKeys } from "@/lib/db/schema";

/**
 * BYOK, bring your own key, per organization.
 *
 * Demo posture: each org (school/team) attaches its own OpenRouter or OpenAI key
 * in Course settings; the platform env key is the fallback. Keys are AES-256-GCM
 * encrypted at rest with a key derived from AUTH_SECRET, never sent to the
 * client (only a masked tail), and resolved server-side per request.
 */

const ALGO = "aes-256-gcm";

function encryptionKey(): Buffer {
  const secret = process.env.ATLAS_KEY_SECRET ?? process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET (or ATLAS_KEY_SECRET) must be set to store provider keys.");
  return createHash("sha256").update(secret).digest();
}

export function encryptSecret(plaintext: string): { ciphertext: string; iv: string } {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { ciphertext: Buffer.concat([encrypted, tag]).toString("base64"), iv: iv.toString("base64") };
}

export function decryptSecret(ciphertext: string, iv: string): string {
  const raw = Buffer.from(ciphertext, "base64");
  const tag = raw.subarray(raw.length - 16);
  const body = raw.subarray(0, raw.length - 16);
  const decipher = createDecipheriv(ALGO, encryptionKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
}

export type ResolvedProvider = {
  model: LanguageModel;
  source: "org" | "env";
  provider: "openrouter" | "openai";
  modelId: string;
};

const DEFAULT_OPENROUTER_MODEL = process.env.ATLAS_CHAT_MODEL ?? "openai/gpt-4.1";
const DEFAULT_OPENAI_MODEL = "gpt-4.1";

/**
 * Resolution order: the org's stored key (OpenRouter preferred, then OpenAI),
 * then the platform env key. Returns null when nothing is configured, callers
 * surface a clean "connect a model key" state instead of a broken run.
 */
export async function resolveModelForOrg(orgId: string): Promise<ResolvedProvider | null> {
  const rows = await db.select().from(orgProviderKeys).where(eq(orgProviderKeys.orgId, orgId));
  const stored = rows.find((r) => r.provider === "openrouter") ?? rows.find((r) => r.provider === "openai");

  if (stored) {
    try {
      const apiKey = decryptSecret(stored.ciphertext, stored.iv);
      if (stored.provider === "openrouter") {
        const modelId = stored.chatModel ?? DEFAULT_OPENROUTER_MODEL;
        return { model: createOpenRouter({ apiKey })(modelId), source: "org", provider: "openrouter", modelId };
      }
      const modelId = stored.chatModel ?? DEFAULT_OPENAI_MODEL;
      return { model: createOpenAI({ apiKey })(modelId), source: "org", provider: "openai", modelId };
    } catch {
      // fall through to env, a corrupt row must not take the product down
    }
  }

  if (process.env.OPENROUTER_API_KEY) {
    return {
      model: createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY })(DEFAULT_OPENROUTER_MODEL),
      source: "env",
      provider: "openrouter",
      modelId: DEFAULT_OPENROUTER_MODEL,
    };
  }
  if (process.env.OPENAI_API_KEY) {
    return {
      model: createOpenAI({ apiKey: process.env.OPENAI_API_KEY })(DEFAULT_OPENAI_MODEL),
      source: "env",
      provider: "openai",
      modelId: DEFAULT_OPENAI_MODEL,
    };
  }
  return null;
}

export async function saveOrgProviderKey(args: {
  orgId: string;
  userId: string;
  provider: "openrouter" | "openai";
  apiKey: string;
  chatModel?: string | null;
}): Promise<void> {
  const { ciphertext, iv } = encryptSecret(args.apiKey);
  const keyTail = args.apiKey.slice(-4);
  await db
    .insert(orgProviderKeys)
    .values({
      orgId: args.orgId,
      provider: args.provider,
      ciphertext,
      iv,
      keyTail,
      chatModel: args.chatModel ?? null,
      createdById: args.userId,
    })
    .onConflictDoUpdate({
      target: [orgProviderKeys.orgId, orgProviderKeys.provider],
      set: { ciphertext, iv, keyTail, chatModel: args.chatModel ?? null, createdById: args.userId, updatedAt: new Date() },
    });
}

export async function deleteOrgProviderKey(orgId: string, provider: "openrouter" | "openai"): Promise<void> {
  await db.delete(orgProviderKeys).where(and(eq(orgProviderKeys.orgId, orgId), eq(orgProviderKeys.provider, provider)));
}

export async function listOrgProviderKeys(orgId: string) {
  const rows = await db
    .select({
      provider: orgProviderKeys.provider,
      keyTail: orgProviderKeys.keyTail,
      chatModel: orgProviderKeys.chatModel,
      updatedAt: orgProviderKeys.updatedAt,
    })
    .from(orgProviderKeys)
    .where(eq(orgProviderKeys.orgId, orgId));
  return rows;
}
