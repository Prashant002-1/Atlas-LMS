import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isInstructorLike } from "@/lib/auth/session";
import { AppShell, type NavSection } from "@/components/atlas/app-shell";

/**
 * The teaching shell: the overview first, then the course itself, then the
 * Atlas surfaces. Course and term switching live on the overview header;
 * the account menu closes the column.
 */
const teacherSections: NavSection[] = [
  {
    items: [{ href: "/teach", label: "Overview", icon: "dashboard", exact: true }],
  },
  {
    label: "Course",
    items: [
      { href: "/teach/work", label: "Work", icon: "work" },
      { href: "/teach/weeks", label: "Modules", icon: "weeks" },
      { href: "/teach/announcements", label: "Announcements", icon: "announce" },
      { href: "/teach/calendar", label: "Calendar", icon: "calendar" },
      { href: "/teach/gradebook", label: "Gradebook", icon: "gradebook" },
      { href: "/teach/students", label: "Students", icon: "students" },
      { href: "/teach/course", label: "Course setup", icon: "setup" },
    ],
  },
  {
    label: "Atlas",
    items: [
      { href: "/teach/atlas", label: "Atlas", icon: "atlas" },
      { href: "/teach/ai-assignments", label: "AI assignments", icon: "aiwork" },
      { href: "/teach/review", label: "Review", icon: "review" },
      { href: "/teach/settings", label: "Settings", icon: "settings" },
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

  return (
    <AppShell sections={teacherSections} userName={session.user.name} userEmail={session.user.email}>
      {children}
    </AppShell>
  );
}
