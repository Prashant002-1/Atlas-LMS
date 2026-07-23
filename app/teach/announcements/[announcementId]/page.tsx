import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { isInstructorLike } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { announcements, users } from "@/lib/db/schema";
import { findEditableCourse } from "@/lib/instructor/workspace";
import { BackLink } from "@/components/atlas/primitives";
import { PageHeader } from "@/components/teach/page-header";
import { Markdown } from "@/components/agent/markdown";

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

  const author = record.authorName ?? record.authorEmail ?? "Course staff";

  return (
    <>
      <BackLink href="/teach/announcements">Announcements</BackLink>
      <div className="mt-3">
        <PageHeader title={record.title} course={`${course.code} / Announcement`} />
      </div>

      <article className="max-w-4xl">
        <header className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1 pb-4">
          <p className="text-[0.8125rem] font-medium text-[var(--color-ink)]">{author}</p>
          <time dateTime={record.postedAt?.toISOString()} className="text-[0.75rem] tabular-nums text-[var(--color-muted)]">
            {record.postedAt ? fullTimestamp(record.postedAt) : "Draft"}
          </time>
        </header>
        <div className="py-6">
          {record.messageMd ? <Markdown className="text-[0.90625rem] leading-7">{record.messageMd}</Markdown> : <p className="text-[0.8125rem] text-[var(--color-muted)]">No message.</p>}
        </div>
      </article>
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
