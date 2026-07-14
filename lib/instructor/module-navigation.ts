import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { modules } from "@/lib/db/schema";
import { isInstructorLike, type Role } from "@/lib/auth/session";
import { resolveScope } from "@/lib/workspace/scope";
import type { ModuleSwitcherItem } from "@/components/teach/module-switcher";

type Actor = { id: string; orgId: string | null; role: Role };

/** Bounded module navigation for the compact switcher on one module page. */
export async function loadModuleNavigation(actor?: Actor | null): Promise<ModuleSwitcherItem[]> {
  if (!actor?.orgId || !isInstructorLike(actor.role)) return [];
  const scope = await resolveScope({ orgId: actor.orgId, userId: actor.id, role: actor.role, teachingOnly: true });
  if (!scope.course) return [];

  const rows = await db
    .select({
      id: modules.id,
      name: modules.name,
      position: modules.position,
      published: modules.published,
      createdAt: modules.createdAt,
    })
    .from(modules)
    .where(and(eq(modules.orgId, actor.orgId), eq(modules.courseId, scope.course.id)))
    .orderBy(asc(modules.position), asc(modules.createdAt))
    .limit(40);

  return rows.map((row, index) => ({
    id: row.id,
    week: String(row.position ?? index + 1).padStart(2, "0"),
    title: row.name,
    status: row.published ? "approved" : "draft",
  }));
}
