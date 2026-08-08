import { and, asc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { assignments, modules } from "@/lib/db/schema";

export type CourseMaterialPlacementOption = {
  id: string;
  label: string;
};

export type CourseMaterialPlacementOptions = {
  modules: CourseMaterialPlacementOption[];
  assignments: CourseMaterialPlacementOption[];
};

export async function loadCourseMaterialPlacementOptions(args: {
  orgId: string;
  courseId: string;
}): Promise<CourseMaterialPlacementOptions> {
  const [moduleRows, assignmentRows] = await Promise.all([
    db
      .select({ id: modules.id, name: modules.name, position: modules.position })
      .from(modules)
      .where(and(eq(modules.orgId, args.orgId), eq(modules.courseId, args.courseId)))
      .orderBy(asc(modules.position), asc(modules.createdAt)),
    db
      .select({ id: assignments.id, name: assignments.name })
      .from(assignments)
      .where(and(eq(assignments.orgId, args.orgId), eq(assignments.courseId, args.courseId)))
      .orderBy(asc(assignments.position), asc(assignments.createdAt)),
  ]);

  return {
    modules: moduleRows.map((module, index) => ({
      id: module.id,
      label: `Week ${module.position ?? index + 1}: ${module.name}`,
    })),
    assignments: assignmentRows.map((assignment) => ({
      id: assignment.id,
      label: assignment.name,
    })),
  };
}
