"use server";

import { AuthError } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth, signIn, signOut } from "@/lib/auth";
import { isInstructorLike } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export type SignInState = {
  error?: string;
};

export type AccountProfileState = {
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

export async function updateAccountProfile(
  _: AccountProfileState,
  formData: FormData
): Promise<AccountProfileState> {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const name = String(formData.get("name") ?? "").replace(/\s+/g, " ").trim();
  if (!name) return { error: "Enter your name." };
  if (name.length > 100) return { error: "Name must be 100 characters or fewer." };

  const imageValue = String(formData.get("image") ?? "").trim();
  const image = profileImageUrl(imageValue);
  if (imageValue && !image) return { error: "Enter a valid http or https photo URL." };

  const values: Partial<typeof users.$inferInsert> = { name, image };

  // Instructor profile facts: a title, an office, and office hours. They
  // render on the account page and in the syllabus instructor block.
  if (isInstructorLike(session.user.role)) {
    values.title = profileField(formData.get("title"), 120);
    values.officeLocation = profileField(formData.get("officeLocation"), 160);
    values.officeHours = profileField(formData.get("officeHours"), 240);
  }

  await db.update(users).set(values).where(eq(users.id, session.user.id));

  const accountHref = isInstructorLike(session.user.role) ? "/teach/account" : "/student/account";
  revalidatePath("/teach", "layout");
  revalidatePath("/student", "layout");
  revalidatePath(accountHref);
  redirect(accountHref);
}

function profileField(value: FormDataEntryValue | null, maxLength: number): string | null {
  const text = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return text ? text.slice(0, maxLength) : null;
}

function profileImageUrl(value: string): string | null {
  if (!value || value.length > 2048) return null;

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}
