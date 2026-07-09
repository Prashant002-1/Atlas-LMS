import { redirect } from "next/navigation";
import { Megaphone } from "lucide-react";
import { and, desc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { isInstructorLike } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { announcements } from "@/lib/db/schema";
import { findEditableCourse } from "@/lib/instructor/workspace";
import { createAnnouncementRecord } from "@/lib/instructor/actions";
import { PageHeader } from "@/components/teach/page-header";
import { ActionButton, Panel } from "@/components/atlas/primitives";
import { EmptyState } from "@/components/atlas/record";
import { StaggerGrid, MotionItem } from "@/components/atlas/motion";

/**
 * Announcements: one-way course posts, newest first. Each post is a record
 * with its posted date; there is no inbox and no thread. Students read them
 * on the course home.
 */
export default async function TeachAnnouncementsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in");
  }
  if (!isInstructorLike(session.user.role)) {
    redirect("/student");
  }
  if (!session.user.orgId) {
    redirect("/teach");
  }

  const course = await findEditableCourse({ id: session.user.id, orgId: session.user.orgId, role: session.user.role });
  if (!course) {
    redirect("/teach");
  }

  const rows = await db
    .select({
      id: announcements.id,
      title: announcements.title,
      messageMd: announcements.messageMd,
      postedAt: announcements.postedAt,
      published: announcements.published,
    })
    .from(announcements)
    .where(and(eq(announcements.orgId, session.user.orgId), eq(announcements.courseId, course.id)))
    .orderBy(desc(announcements.postedAt));

  const field =
    "min-h-10 rounded-control border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 text-[14px] text-[var(--color-ink)] transition focus:border-[var(--color-accent-strong)] focus:bg-[var(--color-surface)]";

  return (
    <>
      <PageHeader title="Announcements" course={`${course.code} / ${course.term ?? ""}`} />

      <Panel title="New announcement" className="scroll-mt-24" id="new">
        <form action={createAnnouncementRecord} className="grid max-w-2xl gap-3">
          <label className="grid gap-1.5 text-[12px] font-medium">
            Title
            <input name="title" type="text" required placeholder="Exam 2 covers through elasticity" className={field} />
          </label>
          <label className="grid gap-1.5 text-[12px] font-medium">
            Message
            <textarea
              name="message"
              rows={4}
              placeholder="What the class needs to read, in your words."
              className="resize-none rounded-control border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2.5 text-[14px] leading-6 transition focus:border-[var(--color-accent-strong)] focus:bg-[var(--color-surface)]"
            />
          </label>
          <div>
            <ActionButton>
              <Megaphone size={14} strokeWidth={2} aria-hidden="true" />
              <span className="ml-1.5">Post to course</span>
            </ActionButton>
          </div>
        </form>
      </Panel>

      <section className="mt-6">
        {rows.length > 0 ? (
          <StaggerGrid className="space-y-2.5" stagger={0.04}>
            {rows.map((row) => (
              <MotionItem key={row.id}>
                <article className="rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4 shadow-[var(--shadow-panel)]">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <h2 className="text-[14.5px] font-semibold leading-6">{row.title}</h2>
                    <p className="atlas-mono text-[11px] uppercase tracking-[0.06em] text-[var(--color-faint)]">
                      {row.postedAt
                        ? `Posted ${row.postedAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                        : "Draft"}
                    </p>
                  </div>
                  {row.messageMd ? (
                    <p className="mt-1.5 whitespace-pre-line text-[13.5px] leading-6 text-[var(--color-muted)]">{row.messageMd}</p>
                  ) : null}
                </article>
              </MotionItem>
            ))}
          </StaggerGrid>
        ) : (
          <div className="rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-panel)]">
            <EmptyState
              art="atlas"
              title="Nothing posted"
              detail="Posts appear here newest first, with the date the class saw them."
            />
          </div>
        )}
      </section>
    </>
  );
}
