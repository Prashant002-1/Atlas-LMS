export const DEFAULT_ATLAS_CHAT_TITLE = "Atlas chat";
export const ATLAS_CHAT_TITLE_LIMIT = 160;

const LEGACY_DEFAULT_TITLES = new Set([DEFAULT_ATLAS_CHAT_TITLE, "Atlas thread", "Course command session"]);

export function isDefaultAtlasChatTitle(title: string | null | undefined) {
  return !title?.trim() || LEGACY_DEFAULT_TITLES.has(title.trim());
}

/** A deterministic, immediate chat title from the first user message. */
export function atlasChatTitleFromIntent(intent: string, fallback = DEFAULT_ATLAS_CHAT_TITLE) {
  const compact = intent.replace(/\s+/g, " ").trim();
  if (!compact) return fallback;
  const characters = Array.from(compact);
  if (characters.length <= ATLAS_CHAT_TITLE_LIMIT) return compact;
  return `${characters.slice(0, ATLAS_CHAT_TITLE_LIMIT - 1).join("")}…`;
}

/** The first user message is the display authority; stored titles are a fallback. */
export function displayAtlasChatTitle(firstUserText: string | null | undefined, storedTitle: string | null | undefined) {
  return atlasChatTitleFromIntent(firstUserText ?? "", storedTitle?.trim() || DEFAULT_ATLAS_CHAT_TITLE);
}

export function firstUserTextFromParts(parts: unknown): string | null {
  if (!Array.isArray(parts)) return null;
  for (const part of parts) {
    if (!part || typeof part !== "object") continue;
    const value = part as { type?: unknown; text?: unknown };
    if (value.type === "text" && typeof value.text === "string" && value.text.trim()) return value.text;
  }
  return null;
}
