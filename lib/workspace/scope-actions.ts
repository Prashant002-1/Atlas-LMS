"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTenant } from "@/lib/auth/session";
import { SCOPE_COOKIES } from "@/lib/workspace/scope";

const YEAR = 60 * 60 * 24 * 365;

/** Switch the course in view within the current term. */
export async function setCourseScope(formData: FormData) {
  await requireTenant();
  const courseId = String(formData.get("course") ?? "");
  const returnTo = safeReturnPath(formData.get("returnTo"));
  if (courseId) {
    const store = await cookies();
    store.set(SCOPE_COOKIES.course, courseId, { path: "/", maxAge: YEAR, sameSite: "lax" });
  }
  revalidatePath("/", "layout");
  redirect(returnTo);
}

/**
 * Switch the term in view. The course cookie clears with it: a pinned course
 * from another term would otherwise shadow the first course of the new one.
 */
export async function setTermScope(formData: FormData) {
  await requireTenant();
  const termSlug = String(formData.get("term") ?? "");
  const returnTo = safeReturnPath(formData.get("returnTo"));
  if (termSlug) {
    const store = await cookies();
    store.set(SCOPE_COOKIES.term, termSlug, { path: "/", maxAge: YEAR, sameSite: "lax" });
    store.delete(SCOPE_COOKIES.course);
  }
  revalidatePath("/", "layout");
  redirect(returnTo);
}

function safeReturnPath(value: FormDataEntryValue | null): string {
  const path = String(value ?? "");
  return path.startsWith("/") && !path.startsWith("//") ? path : "/";
}
