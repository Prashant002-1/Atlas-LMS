import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { eq, and } from "drizzle-orm";
import type { LanguageModel } from "ai";
import { db } from "@/lib/db";
import { orgProviderKeys } from "@/lib/db/schema";
import {
  CHAT_PROVIDERS,
  createChatModel,
  defaultChatProvider,
  defaultModelIdFor,
  envApiKeyFor,
  envBaseUrlFor,
  hasEnvCredentials,
  type ChatProviderKind,
} from "@/lib/ai/provider";

/**
 * BYOK, bring your own key, per organization.
 *
 * Each org attaches its own provider key (OpenRouter, OpenAI, Anthropic, Google,
 * or an OpenAI-compatible/opencode endpoint) in Course settings; the platform env
 * is the fallback. Keys are AES-256-GCM encrypted at rest with a key derived from
 * AUTH_SECRET, never sent to the client (only a masked tail), and resolved
 * server-side per request. All provider wiring lives in lib/ai/provider.ts; this
 * file only decides WHICH key/model to hand it.
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
  provider: ChatProviderKind;
  modelId: string;
};

/** Preference order: the env-default provider first, then the rest in registry order. */
function providerOrder(): ChatProviderKind[] {
  const preferred = defaultChatProvider();
  return [preferred, ...CHAT_PROVIDERS.filter((p) => p !== preferred)];
}

/**
 * Resolution order: the org's stored key (preferred provider first), then the
 * platform env key. Returns null when nothing is configured, callers surface a
 * clean "connect a model key" state instead of a broken run.
 */
export async function resolveModelForOrg(orgId: string): Promise<ResolvedProvider | null> {
  const rows = await db.select().from(orgProviderKeys).where(eq(orgProviderKeys.orgId, orgId));
  const order = providerOrder();

  const stored = rows
    .filter((r) => (CHAT_PROVIDERS as readonly string[]).includes(r.provider))
    .sort((a, b) => order.indexOf(a.provider as ChatProviderKind) - order.indexOf(b.provider as ChatProviderKind))[0];

  if (stored) {
    try {
      const provider = stored.provider as ChatProviderKind;
      const apiKey = decryptSecret(stored.ciphertext, stored.iv);
      const baseURL = stored.baseUrl ?? envBaseUrlFor(provider);
      // openai_compatible/opencode needs a base URL; without one, fall through to env.
      if (provider !== "openai_compatible" || baseURL) {
        const modelId = stored.chatModel ?? defaultModelIdFor(provider, "chat");
        return { model: createChatModel({ provider, modelId, apiKey, baseURL }), source: "org", provider, modelId };
      }
    } catch {
      // A corrupt row must not take the product down; fall through to env.
    }
  }

  for (const provider of order) {
    if (!hasEnvCredentials(provider)) continue;
    const modelId = defaultModelIdFor(provider, "chat");
    return {
      model: createChatModel({ provider, modelId, apiKey: envApiKeyFor(provider), baseURL: envBaseUrlFor(provider) }),
      source: "env",
      provider,
      modelId,
    };
  }
  return null;
}

export async function saveOrgProviderKey(args: {
  orgId: string;
  userId: string;
  provider: ChatProviderKind;
  apiKey: string;
  chatModel?: string | null;
  baseUrl?: string | null;
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
      baseUrl: args.baseUrl ?? null,
      createdById: args.userId,
    })
    .onConflictDoUpdate({
      target: [orgProviderKeys.orgId, orgProviderKeys.provider],
      set: {
        ciphertext,
        iv,
        keyTail,
        chatModel: args.chatModel ?? null,
        baseUrl: args.baseUrl ?? null,
        createdById: args.userId,
        updatedAt: new Date(),
      },
    });
}

export async function deleteOrgProviderKey(orgId: string, provider: ChatProviderKind): Promise<void> {
  await db.delete(orgProviderKeys).where(and(eq(orgProviderKeys.orgId, orgId), eq(orgProviderKeys.provider, provider)));
}

export async function listOrgProviderKeys(orgId: string) {
  const rows = await db
    .select({
      provider: orgProviderKeys.provider,
      keyTail: orgProviderKeys.keyTail,
      chatModel: orgProviderKeys.chatModel,
      baseUrl: orgProviderKeys.baseUrl,
      updatedAt: orgProviderKeys.updatedAt,
    })
    .from(orgProviderKeys)
    .where(eq(orgProviderKeys.orgId, orgId));
  return rows;
}
