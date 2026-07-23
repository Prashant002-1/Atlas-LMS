import { auth } from "@/lib/auth";
import { loadStudentCourseWorkspace, type StudentAssignment } from "@/lib/student/workspace";
import { dueLabel, isOverdue } from "@/lib/student/format";
import { PageHeader } from "@/components/teach/page-header";
import { RecordRow, StatusBadge, TextLink } from "@/components/atlas/primitives";

/** A lean course home: current module, open assignments, and recent announcements. */
export default async function StudentCoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const session = await auth();
  const { courseId } = await params;
  const workspace = await loadStudentCourseWorkspace(session?.user, courseId);

  if (workspace.problem) {
    return (
      <>
        <PageHeader title={workspace.problem.title} />
        <p className="max-w-lg text-[0.875rem] leading-6 text-[var(--color-muted)]">{workspace.problem.detail}</p>
      </>
    );
  }

  const openAssignments = workspace.assignments
    .filter((assignment) => assignment.status === "open" || assignment.status === "missing")
    .sort((a, b) => {
      if (a.dueAt && b.dueAt) return a.dueAt.getTime() - b.dueAt.getTime();
      if (a.dueAt) return -1;
      if (b.dueAt) return 1;
      return 0;
    });

  return (
    <>
      <PageHeader
        title={workspace.course.name}
        action={workspace.standing ? <span className="text-[0.8125rem] font-medium tabular-nums text-[var(--color-muted)]">{workspace.standing}</span> : undefined}
      />

      <div className="grid gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_minmax(15rem,0.38fr)]">
        <div className="min-w-0 space-y-8">
          {workspace.currentWeek ? (
            <section aria-labelledby="current-module-heading">
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h2 id="current-module-heading" className="text-[1rem] font-semibold text-[var(--color-ink)]">This week</h2>
                <TextLink href={`/student/course/${courseId}/modules`} className="text-[0.75rem]">Modules</TextLink>
              </div>
              <div className="pt-3">
                <p className="text-[0.9375rem] font-semibold leading-6">
                  <TextLink href={`/student/material/${workspace.currentWeek.id}`}>{workspace.currentWeek.title}</TextLink>
                </p>
                {workspace.currentWeek.summary ? <p className="mt-1 max-w-2xl text-[0.8125rem] leading-6 text-[var(--color-muted)]">{workspace.currentWeek.summary}</p> : null}
              </div>
            </section>
          ) : null}

          <section aria-labelledby="course-assignments-heading">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h2 id="course-assignments-heading" className="text-[1rem] font-semibold text-[var(--color-ink)]">Assignments</h2>
              <TextLink href={`/student/course/${courseId}/assignments`} className="text-[0.75rem]">All assignments</TextLink>
            </div>
            {openAssignments.length > 0 ? (
              <div className="divide-y divide-[var(--color-border)]">
                {openAssignments.slice(0, 5).map((assignment) => <OpenAssignmentRow key={assignment.id} assignment={assignment} />)}
              </div>
            ) : (
              <p className="py-5 text-[0.8125rem] text-[var(--color-muted)]">No open assignments.</p>
            )}
          </section>
        </div>

        <section aria-labelledby="course-announcements-heading" className="min-w-0">
          <h2 id="course-announcements-heading" className="mb-2 text-[1rem] font-semibold text-[var(--color-ink)]">Announcements</h2>
          {workspace.notices.length > 0 ? (
            <div className="divide-y divide-[var(--color-border)]">
              {workspace.notices.slice(0, 3).map((notice) => (
                <article key={notice.id ?? notice.title} className="py-3.5">
                  <p className="text-[0.8125rem] font-medium leading-5 text-[var(--color-ink)]">{notice.title}</p>
                  {notice.postedAt ? <p className="mt-0.5 text-[0.6875rem] text-[var(--color-faint)]">{notice.postedAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p> : null}
                  {notice.message ? <p className="mt-1 line-clamp-2 text-[0.75rem] leading-5 text-[var(--color-muted)]">{notice.message}</p> : null}
                </article>
              ))}
            </div>
          ) : (
            <p className="py-5 text-[0.8125rem] text-[var(--color-muted)]">No announcements.</p>
          )}
        </section>
      </div>
    </>
  );
}

function OpenAssignmentRow({ assignment }: { assignment: StudentAssignment }) {
  const overdue = assignment.dueAt ? isOverdue(assignment.dueAt) : false;
  return (
    <RecordRow
      href={`/student/assignments/${assignment.id}`}
      aside={assignment.status === "missing" ? <StatusBadge tone="warn">Missing</StatusBadge> : undefined}
    >
      <span className="block truncate text-[0.84375rem] font-medium">{assignment.name}</span>
      <span className={overdue ? "mt-0.5 block text-[0.75rem] font-medium text-[var(--color-danger)]" : "mt-0.5 block text-[0.75rem] text-[var(--color-muted)]"}>
        {assignment.dueAt ? dueLabel(assignment.dueAt) : "No due date"}
      </span>
    </RecordRow>
  );
}
