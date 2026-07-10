import { auth } from "@/lib/auth";
import { loadStudentCourseWorkspace, type StudentAssignment } from "@/lib/student/workspace";
import { dueLabel, isOverdue } from "@/lib/student/format";
import { PageHeader } from "@/components/teach/page-header";
import { Panel, RecordRow, StatusBadge, TextLink } from "@/components/atlas/primitives";
import { EmptyState } from "@/components/atlas/record";

/**
 * The course home: where the course stands right now. The current module,
 * what is due, and what the professor posted. The full lists live on their
 * own pages: Modules, Assignments, Grades.
 */
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

  const openWork = workspace.assignments
    .filter((a) => a.status === "open" || a.status === "missing")
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
        course={`${workspace.course.code} / ${workspace.course.term}`}
        action={workspace.standing ? <StatusBadge tone="neutral">{workspace.standing}</StatusBadge> : undefined}
      />

      {workspace.course.description ? (
        <p className="-mt-3 mb-6 max-w-2xl text-[0.84375rem] leading-6 text-[var(--color-muted)]">
          {workspace.course.description}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(16.25rem,0.42fr)]">
        <div className="min-w-0 space-y-4">
          {workspace.currentWeek ? (
            <section className="atlas-card-hover rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-panel)]">
              <p className="atlas-mono text-[0.6875rem] uppercase tracking-[0.08em] text-[var(--color-faint)]">This week</p>
              <p className="mt-1 text-[0.9375rem] font-semibold leading-6">
                <TextLink href={`/student/material/${workspace.currentWeek.id}`}>{workspace.currentWeek.title}</TextLink>
              </p>
              {workspace.currentWeek.summary ? (
                <p className="mt-1 line-clamp-2 text-[0.84375rem] leading-6 text-[var(--color-muted)]">
                  {workspace.currentWeek.summary}
                </p>
              ) : null}
            </section>
          ) : null}

          <Panel
            title="Due in this course"
            action={<TextLink href={`/student/course/${courseId}/assignments`} className="text-[0.8125rem]">All assignments</TextLink>}
          >
            {openWork.length > 0 ? (
              <div className="-mx-5 -my-5 divide-y divide-[var(--color-border)]">
                {openWork.slice(0, 5).map((assignment) => (
                  <OpenWorkRow key={assignment.id} assignment={assignment} />
                ))}
              </div>
            ) : (
              <EmptyState
                art="summit"
                title="Everything is in"
                detail="No open work in this course right now."
                action={<TextLink href={`/student/course/${courseId}/grades`} className="text-[0.8125rem]">See grades</TextLink>}
              />
            )}
          </Panel>
        </div>

        <div className="min-w-0 space-y-4">
          <Panel title="Announcements">
            {workspace.notices.length > 0 ? (
              <div className="space-y-4">
                {workspace.notices.slice(0, 3).map((notice) => (
                  <div key={notice.id ?? notice.title}>
                    <p className="text-[0.84375rem] font-medium leading-5">{notice.title}</p>
                    {notice.postedAt ? (
                      <p className="atlas-mono mt-0.5 text-[0.6875rem] uppercase tracking-[0.06em] text-[var(--color-faint)]">
                        Posted {notice.postedAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                    ) : null}
                    {notice.message ? (
                      <p className="mt-1 line-clamp-3 text-[0.78125rem] leading-5 text-[var(--color-muted)]">{notice.message}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[0.8125rem] leading-5 text-[var(--color-muted)]">Nothing posted yet.</p>
            )}
          </Panel>

          <Panel title="Modules">
            <p className="text-[0.8125rem] leading-5 text-[var(--color-muted)]">
              {workspace.materials.length > 0
                ? `${workspace.materials.length} published`
                : "Nothing published yet"}
            </p>
            <p className="mt-2 text-[0.8125rem]">
              <TextLink href={`/student/course/${courseId}/modules`} className="text-[0.8125rem]">All modules</TextLink>
            </p>
          </Panel>
        </div>
      </div>
    </>
  );
}

function OpenWorkRow({ assignment }: { assignment: StudentAssignment }) {
  const overdue = assignment.dueAt ? isOverdue(assignment.dueAt) : false;
  return (
    <RecordRow
      href={`/student/work/${assignment.id}`}
      aside={assignment.status === "missing" ? <StatusBadge tone="warn">Missing</StatusBadge> : undefined}
    >
      <span className="block truncate text-[0.875rem] font-medium">{assignment.name}</span>
      <span
        className={`mt-0.5 block text-[0.78125rem] ${
          overdue ? "font-medium text-[var(--color-danger)]" : "text-[var(--color-muted)]"
        }`}
      >
        {assignment.dueAt ? dueLabel(assignment.dueAt) : "No due date"}
        {assignment.points ? ` / ${Math.round(assignment.points)} pts` : ""}
      </span>
    </RecordRow>
  );
}
