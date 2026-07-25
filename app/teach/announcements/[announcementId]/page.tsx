import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { isInstructorLike } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { announcements, enrollments, users } from "@/lib/db/schema";
import { findEditableCourse } from "@/lib/instructor/workspace";
import { BackLink } from "@/components/atlas/primitives";
import { PageHeader } from "@/components/teach/page-header";
import { AnnouncementMessage } from "@/components/teach/announcement-message";

/**
 * One announcement, read the way mail is read.
 *
 * The subject is no longer the page title. It belongs inside the message, under
 * the sender, because that is where a reader looks for it and because the page
 * header was repeating it as a title while the body carried no sender at all.
 */
export default async function TeachAnnouncementPage({ params }: { params: Promise<{ announcementId: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  if (!isInstructorLike(session.user.role)) redirect("/student");
  if (!session.user.orgId) redirect("/teach");

  const [course, route] = await Promise.all([
    findEditableCourse({ id: session.user.id, orgId: session.user.orgId, role: session.user.role }),
    params,
  ]);
  if (!course) redirect("/teach");

  const [record] = await db
    .select({
      id: announcements.id,
      title: announcements.title,
      messageMd: announcements.messageMd,
      postedAt: announcements.postedAt,
      published: announcements.published,
      scheduled: sql<boolean>`${announcements.postedAt} > now()`,
      authorName: users.name,
      authorEmail: users.email,
    })
    .from(announcements)
    .leftJoin(users, and(eq(users.id, announcements.authorId), eq(users.orgId, session.user.orgId)))
    .where(
      and(
        eq(announcements.id, route.announcementId),
        eq(announcements.orgId, session.user.orgId),
        eq(announcements.courseId, course.id)
      )
    )
    .limit(1);

  if (!record) {
    return (
      <>
        <BackLink href="/teach/announcements">Announcements</BackLink>
        <div className="mt-3"><PageHeader title="Announcement unavailable" /></div>
        <p className="text-[0.8125rem] text-[var(--color-muted)]">This announcement is not in the course in view.</p>
      </>
    );
  }

  /* Who it actually reached, counted rather than asserted. */
  const [recipients] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.orgId, session.user.orgId),
        eq(enrollments.courseId, course.id),
        eq(enrollments.role, "student"),
        eq(enrollments.state, "active")
      )
    );
  const studentCount = Number(recipients?.count ?? 0);

  const posted = Boolean(record.published && record.postedAt);
  return (
    <>
      <BackLink href="/teach/announcements">Announcements</BackLink>

      <div className="mt-6">
        <AnnouncementMessage
          subject={record.title}
          authorName={record.authorName ?? record.authorEmail ?? "Course staff"}
          authorEmail={record.authorEmail}
          courseCode={course.code}
          audience={studentCount > 0 ? `${studentCount} students in ${course.code}` : `Everyone in ${course.code}`}
          messageMd={record.messageMd ?? ""}
          stampLabel={posted && record.postedAt ? fullTimestamp(record.postedAt) : "Not sent"}
          scheduled={Boolean(posted && record.scheduled)}
          draft={!record.published}
        />
      </div>
    </>
  );
}

function fullTimestamp(date: Date) {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
