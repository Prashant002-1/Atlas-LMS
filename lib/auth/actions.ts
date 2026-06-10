"use server";

import { AuthError } from "next-auth";
import { eq } from "drizzle-orm";
import { signIn, signOut } from "@/lib/auth";
import { isInstructorLike } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export type SignInState = {
  error?: string;
};

export async function signInWithCredentials(_: SignInState, formData: FormData): Promise<SignInState> {
  return signInFromForm(formData);
}


async function signInFromForm(formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter an email and password." };
  }

  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  const redirectTo = user && isInstructorLike(user.role) ? "/teach" : "/student";

  try {
    await signIn("credentials", { email, password, redirectTo });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Email or password is incorrect." };
    }
    throw error;
  }

  return { error: "Could not complete sign in. Try again." };
}

export async function signOutOfAtlas() {
  await signOut({ redirectTo: "/sign-in" });
}
