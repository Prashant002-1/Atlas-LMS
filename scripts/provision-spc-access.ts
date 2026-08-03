import "../lib/db/env-loader";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../lib/db";
import { loginAliases, organizations, users } from "../lib/db/schema";

const DEMO_ORG_SLUG = "demo-u";
const SPC_ALIASES = [
  {
    email: "spc-instructor@atlas-lms.com",
    targetEmail: "yc-instructor@atlas-lms.com",
    role: "instructor" as const,
  },
  {
    email: "spc-student@atlas-lms.com",
    targetEmail: "yc-student@atlas-lms.com",
    role: "student" as const,
  },
];

async function main() {
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.slug, DEMO_ORG_SLUG),
  });
  if (!org) throw new Error(`Seeded organization ${DEMO_ORG_SLUG} was not found.`);

  await db.transaction(async (tx) => {
    for (const account of SPC_ALIASES) {
      const target = await tx.query.users.findFirst({
        where: and(
          eq(users.orgId, org.id),
          eq(users.email, account.targetEmail),
          eq(users.role, account.role)
        ),
      });
      if (!target?.passwordHash) {
        throw new Error(`Enabled target account ${account.targetEmail} was not found.`);
      }

      const conflictingUser = await tx.query.users.findFirst({
        where: eq(users.email, account.email),
      });
      if (conflictingUser) {
        throw new Error(`Alias email ${account.email} is already a user account.`);
      }

      await tx
        .insert(loginAliases)
        .values({ email: account.email, userId: target.id })
        .onConflictDoUpdate({
          target: loginAliases.email,
          set: { userId: target.id },
        });
    }
  });

  const provisioned = await db
    .select({
      email: loginAliases.email,
      targetEmail: users.email,
      role: users.role,
      passwordHash: users.passwordHash,
    })
    .from(loginAliases)
    .innerJoin(users, eq(users.id, loginAliases.userId))
    .where(inArray(loginAliases.email, SPC_ALIASES.map((account) => account.email)));

  if (
    provisioned.length !== SPC_ALIASES.length ||
    SPC_ALIASES.some(
      (account) =>
        !provisioned.some(
          (row) =>
            row.email === account.email &&
            row.targetEmail === account.targetEmail &&
            row.role === account.role &&
            Boolean(row.passwordHash)
        )
    )
  ) {
    throw new Error("SPC alias provisioning did not leave exactly the expected login mappings enabled.");
  }

  console.log(`Provisioned ${provisioned.length} SPC login aliases for ${DEMO_ORG_SLUG}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
