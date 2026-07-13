import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";

/** Resolve the institution name from the authenticated tenant, never from client input. */
export async function loadInstitutionName(orgId: string): Promise<string> {
  const [organization] = await db
    .select({ name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);

  return organization?.name.trim() || "Institution";
}
