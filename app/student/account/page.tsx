import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { PageHeader } from "@/components/teach/page-header";
import { AccountPanel } from "@/components/atlas/account-panel";

/** The signed-in identity, the theme choice, and sign out. */
export default async function StudentAccountPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in?role=student");
  }
  if (session.user.role !== "student") {
    redirect("/teach");
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
