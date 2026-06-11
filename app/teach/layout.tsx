import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isInstructorLike } from "@/lib/auth/session";
import { resolveScope } from "@/lib/workspace/scope";
import { AppShell, type NavItem } from "@/components/atlas/app-shell";

const teacherNav: NavItem[] = [
  { href: "/teach", label: "Overview", icon: "dashboard", exact: true },
  { href: "/teach/atlas", label: "Atlas", icon: "atlas" },
  { href: "/teach/review", label: "Review", icon: "review" },
  { href: "/teach/weeks", label: "Weeks", icon: "weeks" },
  { href: "/teach/work", label: "Work", icon: "work" },
  { href: "/teach/students", label: "Students", icon: "students" },
  { href: "/teach/settings", label: "Settings", icon: "settings" },
];

export default async function TeachLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in");
  }
  if (!isInstructorLike(session.user.role)) {
    redirect("/student");
  }
  if (!session.user.orgId) {
    redirect("/sign-in");
  }

  const scope = await resolveScope({
    orgId: session.user.orgId,
    userId: session.user.id,
    role: session.user.role,
    teachingOnly: true,
  });

  return (
    <AppShell
      nav={teacherNav}
      courses={scope.courses.map((c) => ({ id: c.id, code: c.code, name: c.name }))}
      activeCourseId={scope.course?.id}
      scopePath="/teach"
    >
      {children}
    </AppShell>
  );
}
