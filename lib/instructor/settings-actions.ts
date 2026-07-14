"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isInstructorLike } from "@/lib/auth/session";
import { deleteOrgProviderKey, saveOrgProviderKey } from "@/lib/agent/keys";
import { CHAT_PROVIDERS, type ChatProviderKind } from "@/lib/ai/provider";

/** Organization model access, separate from course-record actions. */
export async function saveSettingsProviderKey(formData: FormData) {
  const user = await requireInstructorActor();
  const provider = providerField(formData.get("provider"));
  const apiKey = String(formData.get("apiKey") ?? "").trim();
  const chatModel = optionalCompactField(formData.get("chatModel"), 160);
  const baseUrl = compatibleBaseUrl(formData.get("baseUrl"), provider);

  if (apiKey.length < 12) {
    throw new Error("That key looks too short.");
  }

  await saveOrgProviderKey({
    orgId: user.orgId,
    userId: user.id,
    provider,
    apiKey,
    chatModel,
    baseUrl,
  });

  revalidatePath("/teach/settings");
  redirect("/teach/settings#model-access");
}

export async function removeSettingsProviderKey(formData: FormData) {
  const user = await requireInstructorActor();
  const provider = providerField(formData.get("provider"));

  await deleteOrgProviderKey(user.orgId, provider);
  revalidatePath("/teach/settings");
  redirect("/teach/settings#model-access");
}

async function requireInstructorActor() {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || !user.orgId || !isInstructorLike(user.role)) {
    redirect("/sign-in");
  }
  return { id: user.id, orgId: user.orgId };
}

function providerField(value: FormDataEntryValue | null): ChatProviderKind {
  const provider = String(value ?? "") as ChatProviderKind;
  if (!CHAT_PROVIDERS.includes(provider)) {
    throw new Error("Unknown provider.");
  }
  return provider;
}

function compatibleBaseUrl(value: FormDataEntryValue | null, provider: ChatProviderKind) {
  if (provider !== "openai_compatible") return null;
  const raw = optionalCompactField(value, 400);
  if (!raw) {
    throw new Error("An OpenAI-compatible provider needs an endpoint URL.");
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("The endpoint URL is invalid.");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("The endpoint must use HTTP or HTTPS.");
  }
  return parsed.toString().replace(/\/$/, "");
}

function optionalCompactField(value: FormDataEntryValue | null, maxLength: number) {
  const text = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return text ? text.slice(0, maxLength) : null;
}
