import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { courses, enrollments } from "@/lib/db/schema";
import { AppShell, type NavSection } from "@/components/atlas/app-shell";

/**
 * The study shell: the global views first (home, calendar), then every
 * enrolled course. The course in view opens into its own record navigation:
 * Home, Modules, Assignments, Grades.
 */
export default async function StudentLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in?role=student");
  }
  if (session.user.role !== "student") {
    redirect("/teach");
  }

  const rows = session.user.orgId
    ? await db
        .select({ courseId: enrollments.courseId, code: courses.code })
        .from(enrollments)
        .innerJoin(courses, eq(enrollments.courseId, courses.id))
        .where(
          and(
            eq(enrollments.orgId, session.user.orgId),
            eq(enrollments.userId, session.user.id),
            eq(enrollments.role, "student"),
            eq(enrollments.state, "active")
          )
        )
        .orderBy(asc(courses.code))
    : [];

  const sections: NavSection[] = [
    {
      items: [
        { href: "/student", label: "Home", icon: "dashboard", exact: true },
        { href: "/student/calendar", label: "Calendar", icon: "calendar" },
      ],
    },
    ...(rows.length > 0
      ? [
          {
            label: "Courses",
            items: rows.map((row) => ({
              href: `/student/course/${row.courseId}`,
              label: row.code,
              icon: "course" as const,
              children: [
                { href: `/student/course/${row.courseId}`, label: "Home", exact: true },
                { href: `/student/course/${row.courseId}/modules`, label: "Modules" },
                { href: `/student/course/${row.courseId}/assignments`, label: "Assignments" },
                { href: `/student/course/${row.courseId}/grades`, label: "Grades" },
              ],
            })),
          },
        ]
      : []),
  ];

  return (
    <AppShell sections={sections} userName={session.user.name} userEmail={session.user.email}>
      {children}
    </AppShell>
  );
}
