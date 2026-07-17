import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export async function loadAccountProfile(userId: string) {
  const [profile] = await db
    .select({
      id: users.id,
      orgId: users.orgId,
      name: users.name,
      email: users.email,
      image: users.image,
      role: users.role,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return profile ?? null;
}
