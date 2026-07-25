"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { requireTenant } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { courses, terms } from "@/lib/db/schema";
import { SCOPE_COOKIES } from "@/lib/workspace/scope";

const YEAR = 60 * 60 * 24 * 365;

/**
 * Switch the course in view.
 *
 * A course belongs to exactly one term, so choosing a course from another term
 * moves the term with it. That is what makes the term a category rather than a
 * second thing to select: there is one choice, and the pair can never
 * disagree. The term comes from the course row, never from the client, and the
 * lookup is org-scoped so a foreign course id sets nothing.
 */
export async function setCourseScope(formData: FormData) {
  const tenant = await requireTenant();
  const courseId = String(formData.get("course") ?? "");
  const returnTo = safeReturnPath(formData.get("returnTo"));
  if (courseId) {
    const termSlug = await termSlugForCourse(tenant.orgId, courseId);
    const store = await cookies();
    store.set(SCOPE_COOKIES.course, courseId, { path: "/", maxAge: YEAR, sameSite: "lax" });
    if (termSlug) store.set(SCOPE_COOKIES.term, termSlug, { path: "/", maxAge: YEAR, sameSite: "lax" });
  }
  revalidatePath("/", "layout");
  redirect(returnTo);
}

/**
 * Switch the term in view. The course cookie clears with it: a pinned course
 * from another term would otherwise shadow the first course of the new one.
 *
 * Kept for surfaces that move between semesters without naming a course, such
 * as a calendar. The course switcher no longer calls it, because selecting a
 * course already carries its term.
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

/** The term a course sits in, scoped to the caller's organization. */
async function termSlugForCourse(orgId: string, courseId: string): Promise<string | null> {
  const [row] = await db
    .select({ slug: terms.slug })
    .from(courses)
    .innerJoin(terms, eq(terms.id, courses.termId))
    .where(and(eq(courses.orgId, orgId), eq(courses.id, courseId)))
    .limit(1);
  return row?.slug ?? null;
}

function safeReturnPath(value: FormDataEntryValue | null): string {
  const path = String(value ?? "");
  return path.startsWith("/") && !path.startsWith("//") ? path : "/";
}
