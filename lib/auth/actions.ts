"use server";

import { AuthError } from "next-auth";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth, signIn, signOut } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { isInstructorLike } from "@/lib/auth/session";

export type SignInState = {
  error?: string;
};

export async function signInWithCredentials(_: SignInState, formData: FormData): Promise<SignInState> {
  return signInFromForm(formData);
}

export async function signInWithWorkspaceRole(formData: FormData): Promise<void> {
  const role = String(formData.get("role") ?? "");
  const isStudent = role === "student";
  const target = isStudent ? "/student" : "/teach";
  const email = isStudent ? "student@demo.edu" : "instructor@demo.edu";

  try {
    const session = await auth();
    const isAlreadyRightRole = isStudent
      ? session?.user.role === "student"
      : session?.user.role
        ? isInstructorLike(session.user.role)
        : false;

    if (session?.user && !isAlreadyRightRole) {
      await signOut({ redirect: false });
    }

    await signIn("credentials", {
      email,
      password: "atlas1234",
      redirect: false,
      redirectTo: target,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(`/sign-in${isStudent ? "?role=student" : ""}`);
    }
    throw error;
  }

  redirect(target);
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
