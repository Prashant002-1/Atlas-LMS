import NextAuth, { type DefaultSession } from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, accounts, sessions, verificationTokens } from "@/lib/db/schema";
import { verifyPassword } from "@/lib/auth/password";

/**
 * Atlas sessions carry the tenant + role so every downstream tool can scope itself.
 * The prototype had no auth at all; this is the spine that makes multi-tenancy real.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      orgId: string | null;
      role: "superadmin" | "admin" | "instructor" | "ta" | "student";
    } & DefaultSession["user"];
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "jwt" },
  pages: { signIn: "/sign-in" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (creds) => {
        const email = String(creds?.email ?? "").toLowerCase().trim();
        const password = String(creds?.password ?? "");
        if (!email || !password) return null;

        const row = await db.query.users.findFirst({ where: eq(users.email, email) });
        if (!row?.passwordHash) return null;

        const ok = await verifyPassword(password, row.passwordHash);
        if (!ok) return null;

        return { id: row.id, email: row.email, name: row.name, image: row.image };
      },
    }),
  ],
  callbacks: {
    // Fold tenant + role into the JWT once, then expose on the session.
    jwt: async ({ token, user }) => {
      if (user?.id) {
        const row = await db.query.users.findFirst({ where: eq(users.id, user.id as string) });
        if (row) {
          token.orgId = row.orgId;
          token.role = row.role;
        }
      }
      return token;
    },
    session: ({ session, token }) => {
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.orgId = (token.orgId as string | null) ?? null;
        session.user.role =
          (token.role as "superadmin" | "admin" | "instructor" | "ta" | "student") ?? "student";
      }
      return session;
    },
  },
});
