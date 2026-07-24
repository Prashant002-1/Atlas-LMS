import { redirect } from "next/navigation";
import { and, desc, eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { isInstructorLike } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { announcements, users } from "@/lib/db/schema";
import { findEditableCourse } from "@/lib/instructor/workspace";
import { PageHeader } from "@/components/teach/page-header";
import { EmptyState } from "@/components/atlas/record";
import { AnnouncementList, type AnnouncementListRow } from "@/components/teach/announcement-list";
import { AnnouncementComposer } from "@/components/teach/announcement-composer";

/** Clickable, timestamped course announcements, newest first. */
export default async function TeachAnnouncementsPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  if (!isInstructorLike(session.user.role)) redirect("/student");
  if (!session.user.orgId) redirect("/teach");

  const [course, params] = await Promise.all([
    findEditableCourse({ id: session.user.id, orgId: session.user.orgId, role: session.user.role }),
    searchParams,
  ]);
  if (!course) redirect("/teach");

  const records = await db
    .select({
      id: announcements.id,
      title: announcements.title,
      messageMd: announcements.messageMd,
      postedAt: announcements.postedAt,
      published: announcements.published,
      scheduled: sql<boolean>`${announcements.postedAt} > now()`,
      authorName: users.name,
    })
    .from(announcements)
    .leftJoin(users, and(eq(users.id, announcements.authorId), eq(users.orgId, session.user.orgId)))
    .where(and(eq(announcements.orgId, session.user.orgId), eq(announcements.courseId, course.id)))
    .orderBy(desc(announcements.postedAt));

  const rows: AnnouncementListRow[] = records.map((record) => ({
    id: record.id,
    title: record.title,
    message: record.messageMd,
    authorName: record.authorName ?? "Course staff",
    postedAt: record.postedAt?.toISOString() ?? null,
    publication: !record.published || !record.postedAt ? "draft" : record.scheduled ? "scheduled" : "published",
  }));

  return (
    <>
      <PageHeader
        title="Announcements"
        course={`${course.code} / ${course.term ?? ""}`}
        action={<AnnouncementComposer defaultOpen={params.new === "1"} />}
      />

      {rows.length > 0 ? (
        <AnnouncementList rows={rows} />
      ) : (
        <div>
          <EmptyState art="atlas" title="No announcements" />
        </div>
      )}
    </>
  );
}
