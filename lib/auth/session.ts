import { auth } from "@/lib/auth";

export type Role = "superadmin" | "admin" | "instructor" | "ta" | "student";

export type Tenant = {
  userId: string;
  orgId: string;
  role: Role;
};

export class UnauthorizedError extends Error {}
export class ForbiddenError extends Error {}

/**
 * Resolve the signed-in user + tenant. Throws if unauthenticated or org-less.
 * This is the single chokepoint every server action / API route / tool goes through,
 * there is no "global, unscoped" read path in Atlas (unlike the prototype).
 */
export async function requireTenant(): Promise<Tenant> {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) throw new UnauthorizedError("Not signed in.");
  if (!user.orgId) throw new ForbiddenError("User is not attached to an organization.");
  return { userId: user.id, orgId: user.orgId, role: user.role };
}

const RANK: Record<Role, number> = {
  student: 0,
  ta: 1,
  instructor: 2,
  admin: 3,
  superadmin: 4,
};

/** Require at least the given role (hierarchical). */
export async function requireRole(min: Role): Promise<Tenant> {
  const tenant = await requireTenant();
  if (RANK[tenant.role] < RANK[min]) {
    throw new ForbiddenError(`Requires ${min}; you are ${tenant.role}.`);
  }
  return tenant;
}

export function isInstructorLike(role: Role): boolean {
  return RANK[role] >= RANK["instructor"];
}
