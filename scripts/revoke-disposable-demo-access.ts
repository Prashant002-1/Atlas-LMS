import "../lib/db/env-loader";
import { and, inArray, isNotNull } from "drizzle-orm";
import { db } from "../lib/db";
import { loginAliases, users } from "../lib/db/schema";

const disposableUserEmails = ["yc-instructor@atlas-lms.com", "yc-student@atlas-lms.com"];
const disposableAliasEmails = ["spc-instructor@atlas-lms.com", "spc-student@atlas-lms.com"];

async function main() {
  await db.transaction(async (tx) => {
    await tx.delete(loginAliases).where(inArray(loginAliases.email, disposableAliasEmails));
    await tx.update(users).set({ passwordHash: null }).where(inArray(users.email, disposableUserEmails));
  });

  const [enabledUsers, remainingAliases] = await Promise.all([
    db
      .select({ email: users.email })
      .from(users)
      .where(and(inArray(users.email, disposableUserEmails), isNotNull(users.passwordHash))),
    db
      .select({ email: loginAliases.email })
      .from(loginAliases)
      .where(inArray(loginAliases.email, disposableAliasEmails)),
  ]);

  if (enabledUsers.length > 0 || remainingAliases.length > 0) {
    throw new Error("Disposable demo access remains enabled after revocation.");
  }

  console.log("Revoked disposable YC user passwords and SPC login aliases.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
