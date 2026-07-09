import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isInstructorLike } from "@/lib/auth/session";
import { resolveScope } from "@/lib/workspace/scope";
import { AppShell, type NavSection } from "@/components/atlas/app-shell";

/**
 * The teaching shell: global context first (the overview), then the course
 * record itself, then the Atlas surfaces. The term and course in view sit
 * above the navigation; Settings and Account close the column.
 */
const teacherSections: NavSection[] = [
  {
    items: [{ href: "/teach", label: "Overview", icon: "dashboard", exact: true }],
  },
  {
    label: "Course record",
    items: [
      { href: "/teach/work", label: "Work", icon: "work" },
      { href: "/teach/weeks", label: "Modules", icon: "weeks" },
      { href: "/teach/announcements", label: "Announcements", icon: "announce" },
      { href: "/teach/students", label: "Students", icon: "students" },
      { href: "/teach/course", label: "Course setup", icon: "setup" },
    ],
  },
  {
    label: "Atlas",
    items: [
      { href: "/teach/atlas", label: "Atlas", icon: "atlas" },
      { href: "/teach/review", label: "Review", icon: "review" },
    ],
  },
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
      sections={teacherSections}
      courses={scope.courses.map((c) => ({ id: c.id, code: c.code, name: c.name }))}
      activeCourseId={scope.course?.id}
      terms={scope.terms.map((t) => ({ slug: t.slug, name: t.name }))}
      activeTermSlug={scope.term?.slug}
      scopePath="/teach"
      accountHref="/teach/account"
      settingsHref="/teach/settings"
      userName={session.user.name}
      userEmail={session.user.email}
    >
      {children}
    </AppShell>
  );
}
