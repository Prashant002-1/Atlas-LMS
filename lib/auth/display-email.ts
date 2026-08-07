import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { loginAliases } from "@/lib/db/schema";

export type DisplayEmailLookup = {
  byEmail(email: string): Promise<string | null>;
  byUserId(userId: string): Promise<string[]>;
};

const databaseDisplayEmailLookup: DisplayEmailLookup = {
  async byEmail(email) {
    const [alias] = await db
      .select({ email: loginAliases.email })
      .from(loginAliases)
      .where(eq(loginAliases.email, email))
      .limit(1);
    return alias?.email ?? null;
  },

  async byUserId(userId) {
    const aliases = await db
      .select({ email: loginAliases.email })
      .from(loginAliases)
      .where(eq(loginAliases.userId, userId));
    return aliases.map((alias) => alias.email);
  },
};

/**
 * Keep record ownership on the stable user id while presenting emails from the
 * credential set used by the viewer. Direct users retain canonical emails.
 */
export async function displayLoginEmail(
  {
    viewerEmail,
    userId,
    fallback,
  }: { viewerEmail?: string | null; userId: string; fallback?: string | null },
  lookup: DisplayEmailLookup = databaseDisplayEmailLookup
): Promise<string | null> {
  const normalized = viewerEmail?.toLowerCase().trim();
  if (!normalized) return fallback ?? null;

  const viewerAlias = await lookup.byEmail(normalized);
  if (!viewerAlias) return fallback ?? null;

  const namespace = aliasNamespace(viewerAlias);
  if (!namespace) return fallback ?? null;

  const aliases = await lookup.byUserId(userId);
  return aliases.find((email) => email.toLowerCase().startsWith(namespace)) ?? fallback ?? null;
}

function aliasNamespace(email: string): string | null {
  const local = email.toLowerCase().split("@", 1)[0];
  const separator = local.indexOf("-");
  return separator > 0 ? `${local.slice(0, separator + 1)}` : null;
}
