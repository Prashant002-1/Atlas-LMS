"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTenant } from "@/lib/auth/session";
import { SCOPE_COOKIES } from "@/lib/workspace/scope";

const YEAR = 60 * 60 * 24 * 365;

/** Switch the semester in view. Clears the pinned course (it belongs to a term). */
export async function setTermScope(formData: FormData) {
  await requireTenant();
  const slug = String(formData.get("term") ?? "");
  const returnTo = safeReturnPath(formData.get("returnTo"));
  if (slug) {
    const store = await cookies();
    store.set(SCOPE_COOKIES.term, slug, { path: "/", maxAge: YEAR, sameSite: "lax" });
    store.delete(SCOPE_COOKIES.course);
  }
  revalidatePath("/", "layout");
  redirect(returnTo);
}

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

function safeReturnPath(value: FormDataEntryValue | null): string {
  const path = String(value ?? "");
  return path.startsWith("/") && !path.startsWith("//") ? path : "/";
}
