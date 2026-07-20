import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { loadAccountProfile } from "@/lib/auth/account";
import { db } from "@/lib/db";
import { courses, enrollments } from "@/lib/db/schema";
import { loadInstitutionName } from "@/lib/workspace/institution";
import { AppShell, type NavSection } from "@/components/atlas/app-shell";

export default async function StudentLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in?role=student");
  if (session.user.role !== "student") redirect("/teach");
  if (!session.user.orgId) redirect("/sign-in?role=student");

  const [rows, institutionName, profile] = await Promise.all([
    db
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
      .orderBy(asc(courses.code)),
    loadInstitutionName(session.user.orgId),
    loadAccountProfile(session.user.id),
  ]);

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
              compactLabel: row.code.split("-")[0].slice(0, 2),
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
    <AppShell
      sections={sections}
      institutionName={institutionName}
      userName={profile?.name ?? session.user.name}
      userEmail={profile?.email ?? session.user.email}
      userImage={profile?.image ?? session.user.image}
      accountHref="/student/account"
    >
      {children}
    </AppShell>
  );
}
