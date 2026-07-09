import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { isInstructorLike } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { PageHeader } from "@/components/teach/page-header";
import { AccountPanel } from "@/components/atlas/account-panel";

/** The signed-in identity, the theme choice, and sign out. */
export default async function TeachAccountPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in");
  }
  if (!isInstructorLike(session.user.role)) {
    redirect("/student");
  }

  const [org] = session.user.orgId
    ? await db
        .select({ name: organizations.name })
        .from(organizations)
        .where(eq(organizations.id, session.user.orgId))
        .limit(1)
    : [];

  return (
    <>
      <PageHeader title="Account" />
      <AccountPanel
        name={session.user.name}
        email={session.user.email}
        role={session.user.role}
        organization={org?.name ?? null}
      />
    </>
  );
}
