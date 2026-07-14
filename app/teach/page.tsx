import Link from "next/link";
import { Plus } from "lucide-react";
import { auth } from "@/lib/auth";
import { loadInstructorWorkspace, type InstructorWorkspace } from "@/lib/instructor/workspace";
import { PageHeader } from "@/components/teach/page-header";
import { CourseSwitch } from "@/components/teach/course-switch";
import { ButtonLink, Panel, RecordRow, StatusBadge, TextLink } from "@/components/atlas/primitives";
import { EmptyState } from "@/components/atlas/record";
import { StaggerGrid, MotionItem } from "@/components/atlas/motion";

/**
 * The teaching overview is the course at a glance: the work, modules,
 * announcements, and recent changes, each as facts with direct controls.
 */
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

  const progressById = new Map(workspace.workProgress.map((item) => [item.assignmentId, item]));
  const workRows = workspace.assignments.slice(0, 6);
  const moduleRows = workspace.modules.slice(0, 6);

  return (
    <>
      <header className="mb-7 flex flex-wrap items-end justify-between gap-3 border-b border-[var(--color-border)] pb-5">
        <h1 className="sr-only">{workspace.course.name}</h1>
        <CourseSwitch
          courses={workspace.scope.courses.map((c) => ({ id: c.id, code: c.code, name: c.name }))}
          activeCourseId={workspace.scope.course?.id ?? ""}
          terms={workspace.scope.terms.map((t) => ({ slug: t.slug, name: t.name }))}
          activeTermSlug={workspace.scope.term?.slug ?? ""}
          returnTo="/teach"
        />
        <div className="flex flex-wrap items-center gap-2">
          <ButtonLink href="/teach/work?new=1#new" variant="secondary" size="sm" icon={false}>
            <Plus size={13} strokeWidth={2} aria-hidden className="mr-1.5" />
            New assignment
          </ButtonLink>
          <ButtonLink href="/teach/weeks?new=1#new" variant="secondary" size="sm" icon={false}>
            <Plus size={13} strokeWidth={2} aria-hidden className="mr-1.5" />
            New module
          </ButtonLink>
          <ButtonLink href="/teach/announcements#new" variant="secondary" size="sm" icon={false}>
            <Plus size={13} strokeWidth={2} aria-hidden className="mr-1.5" />
            New announcement
          </ButtonLink>
        </div>
      </header>

      <StaggerGrid className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(17.5rem,0.42fr)]" stagger={0.06}>
        <div className="min-w-0 space-y-4">
          <MotionItem>
            <Panel title="Work" action={<TextLink href="/teach/work" className="text-[0.8125rem]">All work</TextLink>}>
              {workRows.length > 0 ? (
                <div className="-mx-5 -my-5 divide-y divide-[var(--color-border)]">
                  {workRows.map((assignment) => (
                    <WorkRecordRow
                      key={assignment.id ?? assignment.title}
                      assignment={assignment}
                      progress={assignment.id ? progressById.get(assignment.id) : undefined}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  art="atlas"
                  title="No work yet"
                  detail="This course has no assignments yet."
                  action={<TextLink href="/teach/work?new=1#new" className="text-[0.8125rem]">New assignment</TextLink>}
                />
              )}
            </Panel>
          </MotionItem>

          <MotionItem>
            <Panel title="Modules" action={<TextLink href="/teach/weeks" className="text-[0.8125rem]">All modules</TextLink>}>
              {moduleRows.length > 0 ? (
                <div className="-mx-5 -my-5 divide-y divide-[var(--color-border)]">
                  {moduleRows.map((module) => (
                    <RecordRow
                      key={module.id ?? module.title}
                      href={module.id ? `/teach/week/${module.id}` : "/teach/weeks"}
                      aside={module.status === "approved" ? undefined : <StatusBadge tone="neutral">Draft</StatusBadge>}
                    >
                      <span className="flex min-w-0 items-baseline gap-3">
                        <span className="atlas-mono w-5 shrink-0 text-[0.8125rem] tabular-nums text-[var(--color-faint)]">
                          {module.week}
                        </span>
                        <span className="truncate text-[0.875rem] font-medium">{module.title}</span>
                      </span>
                    </RecordRow>
                  ))}
                </div>
              ) : (
                <EmptyState
                  art="atlas"
                  title="No modules yet"
                  detail="This course has no modules yet."
                  action={<TextLink href="/teach/weeks?new=1#new" className="text-[0.8125rem]">New module</TextLink>}
                />
              )}
            </Panel>
          </MotionItem>
        </div>

        <div className="min-w-0 space-y-4">
          <MotionItem>
            <Panel title="Announcements" action={<TextLink href="/teach/announcements" className="text-[0.8125rem]">All</TextLink>}>
              {workspace.notices.length > 0 ? (
                <div className="space-y-4">
                  {workspace.notices.slice(0, 3).map((notice) => (
                    <div key={notice.id ?? notice.title}>
                      <p className="text-[0.84375rem] font-medium leading-5">{notice.title}</p>
                      <p className="atlas-mono mt-0.5 text-[0.6875rem] uppercase tracking-[0.06em] text-[var(--color-faint)]">
                        {notice.postedAt ? `Posted ${shortDate(notice.postedAt)}` : "Draft"}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  art="atlas"
                  title="No announcements"
                  detail="Nothing has been posted to this course yet."
                  action={<TextLink href="/teach/announcements#new" className="text-[0.8125rem]">New announcement</TextLink>}
                />
              )}
            </Panel>
          </MotionItem>

          <MotionItem>
            <Panel title="Recent changes">
              {workspace.recentChanges.length > 0 ? (
                <div className="space-y-3.5">
                  {workspace.recentChanges.map((change) => (
                    <Link
                      key={`${change.kind}-${change.href}-${change.at.getTime()}-${change.title}`}
                      href={change.href}
                      className="group/change block rounded-row focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)]"
                    >
                      <span className="block truncate text-[0.8125rem] font-medium text-[var(--color-ink)] underline decoration-[color-mix(in_oklch,var(--color-ink)_22%,transparent)] decoration-1 underline-offset-[3px] transition group-hover/change:text-[var(--color-accent-strong)] group-hover/change:decoration-[var(--color-accent-strong)]">
                        {change.title}
                      </span>
                      <span className="atlas-mono mt-0.5 block text-[0.6875rem] uppercase tracking-[0.06em] text-[var(--color-faint)]">
                        {change.event} / {shortDate(change.at)}
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-[0.8125rem] leading-5 text-[var(--color-muted)]">
                  Changes to modules, work, and announcements appear here as they happen.
                </p>
              )}
            </Panel>
          </MotionItem>
        </div>
      </StaggerGrid>
    </>
  );
}

function WorkRecordRow({
  assignment,
  progress,
}: {
  assignment: InstructorWorkspace["assignments"][number];
  progress?: InstructorWorkspace["workProgress"][number];
}) {
  const facts: string[] = [];
  if (assignment.dueAt) facts.push(`Due ${shortDate(assignment.dueAt)}`);
  if (assignment.points) facts.push(`${Math.round(assignment.points)} pts`);
  if (progress) {
    facts.push(`${progress.submitted} submitted`);
    if (progress.graded > 0) facts.push(`${progress.graded} graded`);
  }

  return (
    <RecordRow
      href={assignment.id ? `/teach/work/${assignment.id}` : "/teach/work"}
      aside={assignment.status === "approved" ? undefined : <StatusBadge tone="neutral">Draft</StatusBadge>}
    >
      <span className="block truncate text-[0.875rem] font-medium">{assignment.title}</span>
      <span className="mt-0.5 block truncate text-[0.78125rem] text-[var(--color-muted)]">
        {facts.length > 0 ? facts.join(" / ") : "No due date"}
      </span>
    </RecordRow>
  );
}

function shortDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
