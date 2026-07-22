import type { LanguageModel } from "ai";
import {
  CHAT_PROVIDERS,
  createChatModel,
  defaultChatProvider,
  defaultModelIdFor,
  envBaseUrlFor,
  hasEnvCredentials,
  type ChatProviderKind,
} from "@/lib/ai/provider";

export type ResolvedPlatformModel = {
  model: LanguageModel;
  provider: ChatProviderKind;
  modelId: string;
};

/** Prefer the server-configured provider, then any other platform credential. */
function platformProviderOrder(): ChatProviderKind[] {
  const preferred = defaultChatProvider();
  return [preferred, ...CHAT_PROVIDERS.filter((provider) => provider !== preferred)];
}

/** Resolve Atlas's model exclusively from server environment configuration. */
export function resolvePlatformModel(): ResolvedPlatformModel | null {
  for (const provider of platformProviderOrder()) {
    if (!hasEnvCredentials(provider)) continue;

    const modelId = defaultModelIdFor(provider, "chat");
    return {
      model: createChatModel({ provider, modelId, baseURL: envBaseUrlFor(provider) }),
      provider,
      modelId,
    };
  }

  return null;
}
