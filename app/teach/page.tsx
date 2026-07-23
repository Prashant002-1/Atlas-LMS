import { Plus } from "lucide-react";
import { auth } from "@/lib/auth";
import { loadInstructorWorkspace, type InstructorWorkspace } from "@/lib/instructor/workspace";
import { PageHeader } from "@/components/teach/page-header";
import { CourseSwitch } from "@/components/teach/course-switch";
import { ButtonLink, RecordRow, StatusBadge, TextLink } from "@/components/atlas/primitives";
import { StaggerGrid, MotionItem } from "@/components/atlas/motion";

function hasUpcomingDueDate(assignment: InstructorWorkspace["assignments"][number]) {
  return assignment.status === "approved" && assignment.dueAt && assignment.dueAt.getTime() >= Date.now();
}

/** A lean teaching overview: assignments, the next dates, and a short Atlas briefing. */
export default async function TeachOverviewPage() {
  const session = await auth();
  const workspace = await loadInstructorWorkspace(session?.user);

  if (workspace.problem) {
    return (
      <>
        <PageHeader title={workspace.problem.title} />
        <p className="max-w-lg text-[0.875rem] leading-6 text-[var(--color-muted)]">{workspace.problem.detail}</p>
      </>
    );
  }

  const assignments = workspace.assignments.slice(0, 7);
  const upcoming = workspace.assignments
    .filter(hasUpcomingDueDate)
    .sort((a, b) => (a.dueAt?.getTime() ?? 0) - (b.dueAt?.getTime() ?? 0))
    .slice(0, 4);
  const briefing = buildAtlasBriefing(workspace);

  return (
    <>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <h1 className="sr-only">{workspace.course.name}</h1>
        <CourseSwitch
          courses={workspace.scope.courses.map((course) => ({ id: course.id, code: course.code, name: course.name }))}
          activeCourseId={workspace.scope.course?.id ?? ""}
          terms={workspace.scope.terms.map((term) => ({ slug: term.slug, name: term.name }))}
          activeTermSlug={workspace.scope.term?.slug ?? ""}
          returnTo="/teach"
        />
        <div className="flex flex-wrap items-center gap-2">
          <ButtonLink href="/teach/assignments?new=1#new" variant="secondary" size="sm" icon={false}>
            <Plus size={13} strokeWidth={2} aria-hidden className="mr-1.5" />
            New assignment
          </ButtonLink>
          <ButtonLink href="/teach/weeks?new=1#new" variant="secondary" size="sm" icon={false}>
            <Plus size={13} strokeWidth={2} aria-hidden className="mr-1.5" />
            New module
          </ButtonLink>
          <ButtonLink href="/teach/announcements?new=1" variant="secondary" size="sm" icon={false}>
            <Plus size={13} strokeWidth={2} aria-hidden className="mr-1.5" />
            New announcement
          </ButtonLink>
        </div>
      </header>

      <StaggerGrid className="grid gap-x-10 gap-y-9 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,0.38fr)]" stagger={0.05}>
        <MotionItem>
          <section className="min-w-0" aria-labelledby="overview-assignments-heading">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h2 id="overview-assignments-heading" className="text-[1rem] font-semibold text-[var(--color-ink)]">Assignments</h2>
              <TextLink href="/teach/assignments" className="text-[0.75rem]">All assignments</TextLink>
            </div>
            {assignments.length > 0 ? (
              <div className="divide-y divide-[var(--color-border)]">
                {assignments.map((assignment) => <AssignmentRecordRow key={assignment.id ?? assignment.title} assignment={assignment} />)}
              </div>
            ) : (
              <p className="py-5 text-[0.8125rem] text-[var(--color-muted)]">No assignments yet.</p>
            )}
          </section>
        </MotionItem>

        <div className="min-w-0 space-y-8">
          <MotionItem>
            <section aria-labelledby="atlas-briefing-heading">
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h2 id="atlas-briefing-heading" className="text-[1rem] font-semibold text-[var(--color-ink)]">Atlas briefing</h2>
                <TextLink href="/teach/atlas" className="text-[0.75rem]">Open Atlas</TextLink>
              </div>
              <p className="pt-3 text-[0.8125rem] leading-6 text-[var(--color-muted)]">{briefing}</p>
            </section>
          </MotionItem>

          <MotionItem>
            <section aria-labelledby="upcoming-heading">
              <h2 id="upcoming-heading" className="mb-2 text-[1rem] font-semibold text-[var(--color-ink)]">Upcoming</h2>
              {upcoming.length > 0 ? (
                <div className="divide-y divide-[var(--color-border)]">
                  {upcoming.map((assignment) => (
                    <RecordRow key={assignment.id ?? assignment.title} href={assignment.id ? `/teach/assignments/${assignment.id}` : "/teach/assignments"}>
                      <span className="block truncate text-[0.8125rem] font-medium">{assignment.title}</span>
                      <span className="mt-0.5 block text-[0.71875rem] text-[var(--color-muted)]">{assignment.dueAt ? shortDate(assignment.dueAt) : "No due date"}</span>
                    </RecordRow>
                  ))}
                </div>
              ) : (
                <p className="py-4 text-[0.8125rem] text-[var(--color-muted)]">No upcoming due dates.</p>
              )}
            </section>
          </MotionItem>

          <MotionItem>
            <section aria-labelledby="overview-announcements-heading">
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <h2 id="overview-announcements-heading" className="text-[1rem] font-semibold text-[var(--color-ink)]">Announcements</h2>
                <TextLink href="/teach/announcements" className="text-[0.75rem]">All</TextLink>
              </div>
              {workspace.notices.length > 0 ? (
                <div className="divide-y divide-[var(--color-border)]">
                  {workspace.notices.slice(0, 2).map((notice) => (
                    <article key={notice.id ?? notice.title} className="py-3.5">
                      <p className="text-[0.8125rem] font-medium leading-5 text-[var(--color-ink)]">{notice.title}</p>
                      <p className="mt-0.5 text-[0.6875rem] text-[var(--color-faint)]">{notice.postedAt ? shortDate(notice.postedAt) : "Draft"}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="py-4 text-[0.8125rem] text-[var(--color-muted)]">No announcements.</p>
              )}
            </section>
          </MotionItem>
        </div>
      </StaggerGrid>
    </>
  );
}

function AssignmentRecordRow({ assignment }: { assignment: InstructorWorkspace["assignments"][number] }) {
  return (
    <RecordRow
      href={assignment.id ? `/teach/assignments/${assignment.id}` : "/teach/assignments"}
      aside={assignment.status === "approved" ? undefined : <StatusBadge tone="neutral">Draft</StatusBadge>}
    >
      <span className="block truncate text-[0.84375rem] font-medium">{assignment.title}</span>
      <span className="mt-0.5 block text-[0.75rem] text-[var(--color-muted)]">{assignment.dueAt ? shortDate(assignment.dueAt) : "No due date"}</span>
    </RecordRow>
  );
}

function buildAtlasBriefing(workspace: InstructorWorkspace) {
  const ungraded = workspace.workProgress.reduce((sum, item) => sum + Math.max(0, item.submitted - item.graded), 0);
  const missing = workspace.workProgress.reduce((sum, item) => sum + item.missing, 0);
  const drafts = workspace.proposals.filter((proposal) => proposal.status === "pending").length;
  const gradingFocus = [...workspace.workProgress]
    .map((item) => ({ ...item, waiting: Math.max(0, item.submitted - item.graded) }))
    .sort((left, right) => right.waiting - left.waiting)[0];
  const courseCode = workspace.course.code;
  const parts: string[] = [];
  if (ungraded > 0 && gradingFocus?.waiting) {
    parts.push(
      `Start with ${gradingFocus.title}: ${gradingFocus.waiting} ${gradingFocus.waiting === 1 ? "submission is" : "submissions are"} waiting for grading`
    );
  }
  if (missing > 0) parts.push(`${missing} ${missing === 1 ? "submission is" : "submissions are"} marked missing across the course`);
  if (drafts > 0) parts.push(`${drafts} ${drafts === 1 ? "draft is" : "drafts are"} waiting in Review`);
  if (parts.length === 0) return `${courseCode} has no ungraded submissions, missing records, or Review drafts today.`;
  return `In ${courseCode}, ${parts.join(". ")}.`;
}

function shortDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
