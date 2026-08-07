import "../lib/db/env-loader";
import { and, eq, isNotNull, or } from "drizzle-orm";
import { hashPassword } from "../lib/auth/password";
import { db } from "../lib/db";
import { organizations, users } from "../lib/db/schema";

const DEMO_ORG_SLUG = "demo-u";
const YC_ACCOUNTS = [
  {
    sourceEmail: "instructor@demo.edu",
    email: "yc-instructor@atlas-lms.com",
    role: "instructor" as const,
  },
  {
    sourceEmail: "student@demo.edu",
    email: "yc-student@atlas-lms.com",
    role: "student" as const,
  },
];

async function main() {
  const password = process.env.ATLAS_YC_PASSWORD;
  if (!password) throw new Error("ATLAS_YC_PASSWORD is required.");

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.slug, DEMO_ORG_SLUG),
  });
  if (!org) throw new Error(`Seeded organization ${DEMO_ORG_SLUG} was not found.`);

  const passwordHash = await hashPassword(password);

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ passwordHash: null })
      .where(and(eq(users.orgId, org.id), isNotNull(users.passwordHash)));

    for (const account of YC_ACCOUNTS) {
      const existing = await tx.query.users.findMany({
        where: and(
          eq(users.orgId, org.id),
          eq(users.role, account.role),
          or(eq(users.email, account.sourceEmail), eq(users.email, account.email))
        ),
      });

      if (existing.length !== 1) {
        throw new Error(
          `Expected one ${account.role} account at ${account.sourceEmail} or ${account.email}; found ${existing.length}.`
        );
      }

      const updated = await tx
        .update(users)
        .set({ email: account.email, passwordHash })
        .where(eq(users.id, existing[0].id))
        .returning({ id: users.id });

      if (updated.length !== 1) {
        throw new Error(`Could not enable ${account.email}.`);
      }
    }
  });

  const enabledAccounts = await db
    .select({ email: users.email, role: users.role })
    .from(users)
    .where(and(eq(users.orgId, org.id), isNotNull(users.passwordHash)));

  if (
    enabledAccounts.length !== YC_ACCOUNTS.length ||
    YC_ACCOUNTS.some(
      (account) =>
        !enabledAccounts.some((enabled) => enabled.email === account.email && enabled.role === account.role)
    )
  ) {
    throw new Error("YC access provisioning did not leave exactly the expected accounts enabled.");
  }

  console.log(`Provisioned ${enabledAccounts.length} YC demo accounts for ${DEMO_ORG_SLUG}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
