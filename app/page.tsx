import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isInstructorLike } from "@/lib/auth/session";

/**
 * Atlas has no public surface. The root routes you to your workspace,
 * everything else is the course record, behind sign-in.
 */
export default async function RootPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in");
  }
  redirect(isInstructorLike(session.user.role) ? "/teach" : "/student");
}
