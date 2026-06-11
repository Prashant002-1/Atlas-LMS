import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { courses, enrollments } from "@/lib/db/schema";
import { AppShell, type NavItem } from "@/components/atlas/app-shell";

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

  const nav: NavItem[] = [
    { href: "/student", label: "Overview", icon: "dashboard", exact: true },
    ...rows.map((row) => ({
      href: `/student/course/${row.courseId}`,
      label: row.code,
      icon: "course" as const,
    })),
  ];

  return <AppShell nav={nav}>{children}</AppShell>;
}
