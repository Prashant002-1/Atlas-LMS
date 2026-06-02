import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { enrollments } from "@/lib/db/schema";
import type { Role } from "@/lib/auth/session";
import type { WorkspacePersona } from "@/lib/workspace/contracts";

/** Context every tool receives — the resolved tenant + the active session/persona. */
export type ChatToolContext = {
  userId: string;
  orgId: string;
  role: Role;
  persona: WorkspacePersona;
  sessionId: string;
  courseId?: string | null;
};

/** Uniform tool envelope the reducer understands: { uiTarget, summary, payload }. */
export type ToolPayload<T> = {
  uiTarget: string;
  summary: string;
  payload: T;
};

export function ok<T>(uiTarget: string, summary: string, payload: T): ToolPayload<T> {
  return { uiTarget, summary, payload };
}

/** Course ids the user is enrolled in with the given role (defaults to student). */
export async function enrolledCourseIds(
  ctx: ChatToolContext,
  role?: "instructor" | "ta" | "student"
): Promise<string[]> {
  const rows = await db
    .select({ courseId: enrollments.courseId })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.orgId, ctx.orgId),
        eq(enrollments.userId, ctx.userId),
        ...(role ? [eq(enrollments.role, role)] : [])
      )
    );
  return rows.map((r) => r.courseId);
}

/** Assert the actor can teach/edit a specific course. Throws if not. */
export async function assertCanEditCourse(ctx: ChatToolContext, courseId: string): Promise<void> {
  if (ctx.role === "admin" || ctx.role === "superadmin") return;
  const teaching = await db
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.orgId, ctx.orgId),
        eq(enrollments.userId, ctx.userId),
        eq(enrollments.courseId, courseId),
        eq(enrollments.role, "instructor")
      )
    )
    .limit(1);
  if (teaching.length === 0) {
    throw new Error("You do not have instructor access to this course.");
  }
}
