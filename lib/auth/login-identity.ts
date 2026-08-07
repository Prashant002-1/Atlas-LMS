import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { loginAliases, users } from "@/lib/db/schema";

export type LoginIdentity = {
  id: string;
  orgId: string | null;
  role: "superadmin" | "admin" | "instructor" | "ta" | "student";
  name: string | null;
  image: string | null;
  passwordHash: string | null;
  loginEmail: string;
};

export type LoginIdentityLookup = {
  direct(email: string): Promise<LoginIdentity | null>;
  alias(email: string): Promise<LoginIdentity | null>;
};

const identityColumns = {
  id: users.id,
  orgId: users.orgId,
  role: users.role,
  name: users.name,
  image: users.image,
};

const databaseLoginIdentityLookup: LoginIdentityLookup = {
  async direct(email) {
    const [identity] = await db
      .select({ ...identityColumns, passwordHash: users.passwordHash, loginEmail: users.email })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return identity ?? null;
  },

  async alias(email) {
    const [identity] = await db
      .select({
        ...identityColumns,
        passwordHash: loginAliases.passwordHash,
        loginEmail: loginAliases.email,
      })
      .from(loginAliases)
      .innerJoin(users, eq(users.id, loginAliases.userId))
      .where(eq(loginAliases.email, email))
      .limit(1);
    return identity ?? null;
  },
};

export async function resolveLoginIdentity(
  value: string,
  lookup: LoginIdentityLookup = databaseLoginIdentityLookup
): Promise<LoginIdentity | null> {
  const email = value.toLowerCase().trim();
  if (!email) return null;

  return (await lookup.direct(email)) ?? (await lookup.alias(email));
}
