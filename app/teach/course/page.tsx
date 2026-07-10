import { redirect } from "next/navigation";
import { Check } from "lucide-react";
import { and, count, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { isInstructorLike } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { courses, enrollments } from "@/lib/db/schema";
import { findEditableCourse } from "@/lib/instructor/workspace";
import { updateCourseDetails } from "@/lib/instructor/actions";
import { PageHeader } from "@/components/teach/page-header";
import { ActionButton, Panel, TextLink } from "@/components/atlas/primitives";
import { RecordFact } from "@/components/atlas/record";

/**
 * Course setup: the roster-facing course record. The name and description
 * students see, the syllabus they read, and the facts of the offering.
 * Atlas policy and model keys live in Settings, deliberately apart.
 */
export default async function TeachCourseSetupPage() {
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

  const scoped = await findEditableCourse({ id: session.user.id, orgId: session.user.orgId, role: session.user.role });
  if (!scoped) {
    redirect("/teach");
  }

  const [course] = await db
    .select({
      id: courses.id,
      code: courses.code,
      name: courses.name,
      term: courses.term,
      description: courses.description,
      syllabusMd: courses.syllabusMd,
      startDate: courses.startDate,
      endDate: courses.endDate,
    })
    .from(courses)
    .where(and(eq(courses.orgId, session.user.orgId), eq(courses.id, scoped.id)))
    .limit(1);
  if (!course) {
    redirect("/teach");
  }

  const [roster] = await db
    .select({ students: count() })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.orgId, session.user.orgId),
        eq(enrollments.courseId, course.id),
        eq(enrollments.role, "student"),
        eq(enrollments.state, "active")
      )
    );

  const field =
    "min-h-10 rounded-control border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 text-[0.875rem] text-[var(--color-ink)] transition focus:border-[var(--color-accent-strong)] focus:bg-[var(--color-surface)]";

  return (
    <>
      <PageHeader title="Course setup" course={`${course.code} / ${course.term ?? ""}`} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(16.25rem,0.38fr)]">
        <div className="min-w-0 space-y-4">
          <Panel title="Course details">
            <form action={updateCourseDetails} className="grid gap-3">
              <label className="grid gap-1.5 text-[0.75rem] font-medium">
                Name
                <input name="name" type="text" required defaultValue={course.name} className={field} />
              </label>
              <label className="grid gap-1.5 text-[0.75rem] font-medium">
                Description
                <textarea
                  name="description"
                  rows={3}
                  defaultValue={course.description ?? ""}
                  className="resize-none rounded-control border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2.5 text-[0.875rem] leading-6 transition focus:border-[var(--color-accent-strong)] focus:bg-[var(--color-surface)]"
                />
              </label>
              <label className="grid gap-1.5 text-[0.75rem] font-medium">
                Syllabus
                <textarea
                  name="syllabus"
                  rows={14}
                  defaultValue={course.syllabusMd ?? ""}
                  placeholder="Markdown"
                  className="atlas-mono resize-y rounded-control border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2.5 text-[0.78125rem] leading-6 transition focus:border-[var(--color-accent-strong)] focus:bg-[var(--color-surface)]"
                />
              </label>
              <div>
                <ActionButton>
                  <Check size={14} strokeWidth={2} aria-hidden="true" />
                  <span className="ml-1.5">Save course</span>
                </ActionButton>
              </div>
            </form>
          </Panel>
        </div>

        <div className="min-w-0 space-y-4">
          <Panel title="Offering">
            <div className="grid gap-3 text-[0.8125rem]">
              <RecordFact label="Code" value={<span className="atlas-mono">{course.code}</span>} />
              <RecordFact label="Term" value={course.term ?? "Not set"} />
              {course.startDate ? <RecordFact label="Starts" value={longDate(course.startDate)} /> : null}
              {course.endDate ? <RecordFact label="Ends" value={longDate(course.endDate)} /> : null}
            </div>
          </Panel>

          <Panel title="Roster">
            <div className="grid gap-3 text-[0.8125rem]">
              <RecordFact label="Students" value={roster?.students ?? 0} />
            </div>
            <p className="mt-3 text-[0.8125rem]">
              <TextLink href="/teach/students" className="text-[0.8125rem]">Open Students</TextLink>
            </p>
          </Panel>
        </div>
      </div>
    </>
  );
}

function longDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
