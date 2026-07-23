import { redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { isInstructorLike } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { announcements, users } from "@/lib/db/schema";
import { findEditableCourse } from "@/lib/instructor/workspace";
import { createAnnouncementRecord } from "@/lib/instructor/actions";
import { PageHeader } from "@/components/teach/page-header";
import { ActionButton } from "@/components/atlas/primitives";
import { EmptyState } from "@/components/atlas/record";
import { AnnouncementList, type AnnouncementListRow } from "@/components/teach/announcement-list";
import { RecordDialog } from "@/components/teach/record-dialog";

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
  }));

  return (
    <>
      <PageHeader
        title="Announcements"
        course={`${course.code} / ${course.term ?? ""}`}
        action={<NewAnnouncementDialog defaultOpen={params.new === "1"} />}
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

function NewAnnouncementDialog({ defaultOpen }: { defaultOpen: boolean }) {
  return (
    <RecordDialog
      mode="create"
      triggerLabel="New announcement"
      title="New announcement"
      triggerVariant="primary"
      defaultOpen={defaultOpen}
    >
      <form action={createAnnouncementRecord} className="grid gap-4">
        <label className="grid gap-1.5 text-[0.75rem] font-medium">
          Subject
          <input name="title" type="text" required autoFocus maxLength={200} placeholder="Exam 2 covers through elasticity" className={fieldClass} />
        </label>
        <label className="grid gap-1.5 text-[0.75rem] font-medium">
          Message
          <textarea name="message" rows={12} required maxLength={4000} className={`${fieldClass} min-h-64 resize-y py-3 leading-6`} />
        </label>
        <div className="flex justify-end pt-4">
          <ActionButton>Publish announcement</ActionButton>
        </div>
      </form>
    </RecordDialog>
  );
}

const fieldClass = "min-h-10 rounded-control border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 text-[0.8125rem] text-[var(--color-ink)] outline-none transition placeholder:text-[var(--color-faint)] focus:border-[var(--color-accent-strong)] focus:bg-[var(--color-surface)]";
