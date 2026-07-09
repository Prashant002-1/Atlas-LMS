import { Check, Plus } from "lucide-react";
import { auth } from "@/lib/auth";
import { loadInstructorWorkspace, type InstructorWorkspace } from "@/lib/instructor/workspace";
import { createAssignmentRecord, publishAssignment } from "@/lib/instructor/actions";
import { PageHeader } from "@/components/teach/page-header";
import { ActionButton, CodeList, StatusBadge, TextLink } from "@/components/atlas/primitives";
import { EmptyState, ObjectiveChecklist } from "@/components/atlas/record";
import { StaggerGrid, MotionItem } from "@/components/atlas/motion";

/** Graded work: one row per item, grading state up front, direct add below. */
export default async function TeachWorkPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const session = await auth();
  const [workspace, params] = await Promise.all([loadInstructorWorkspace(session?.user), searchParams]);
  const openNew = params.new === "1";

  if (workspace.problem) {
    return (
      <>
        <PageHeader title="Work" />
        <p className="max-w-lg text-[14px] leading-6 text-[var(--color-muted)]">{workspace.problem.detail}</p>
      </>
    );
  }

  const progressById = new Map(workspace.workProgress.map((item) => [item.assignmentId, item]));

  return (
    <>
      <PageHeader title="Work" course={`${workspace.course.code} / ${workspace.course.term}`} />

      {workspace.assignments.length > 0 ? (
        <StaggerGrid className="space-y-2.5" stagger={0.04}>
          {workspace.assignments.map((assignment) => (
            <MotionItem key={assignment.id ?? assignment.title}>
              <WorkRow
                assignment={assignment}
                progress={assignment.id ? progressById.get(assignment.id) : undefined}
              />
            </MotionItem>
          ))}
        </StaggerGrid>
      ) : (
        <div className="rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-panel)]">
          <EmptyState art="atlas" title="No work yet" detail="Draft it with Atlas or add it below." />
        </div>
      )}

      <details
        id="new"
        open={openNew}
        className="mt-5 scroll-mt-24 rounded-panel border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface)] px-5 py-4 shadow-[var(--shadow-panel)]"
      >
        <summary className="cursor-pointer text-[14px] font-semibold transition hover:text-[var(--color-accent-strong)]">Add work</summary>
        <form action={createAssignmentRecord} className="mt-4 grid max-w-xl gap-3">
          <label className="grid gap-1.5 text-[12px] font-medium">
            Title
            <input
              name="title"
              type="text"
              required
              placeholder="Problem Set 6: Regression diagnostics"
              className="min-h-10 rounded-control border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 text-[14px] transition focus:border-[var(--color-accent-strong)] focus:bg-[var(--color-surface)]"
            />
          </label>
          <label className="grid gap-1.5 text-[12px] font-medium">
            Instructions
            <textarea
              name="description"
              rows={3}
              placeholder="The task, the deliverable, and what good work looks like."
              className="resize-none rounded-control border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2.5 text-[14px] leading-6 transition focus:border-[var(--color-accent-strong)] focus:bg-[var(--color-surface)]"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1.5 text-[12px] font-medium">
              Due
              <input name="dueDate" type="date" className="min-h-10 rounded-control border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 text-[14px] transition focus:border-[var(--color-accent-strong)] focus:bg-[var(--color-surface)]" />
            </label>
            <label className="grid gap-1.5 text-[12px] font-medium">
              Points
              <input name="points" type="number" min={1} defaultValue={100} className="min-h-10 rounded-control border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 text-[14px] transition focus:border-[var(--color-accent-strong)] focus:bg-[var(--color-surface)]" />
            </label>
          </div>
          <ObjectiveChecklist objectives={workspace.objectives} selectedCodes={[]} />
          <div>
            <ActionButton>
              <Plus size={14} strokeWidth={2} aria-hidden="true" />
              <span className="ml-1.5">Add work</span>
            </ActionButton>
          </div>
        </form>
      </details>
    </>
  );
}

function WorkRow({
  assignment,
  progress,
}: {
  assignment: InstructorWorkspace["assignments"][number];
  progress?: InstructorWorkspace["workProgress"][number];
}) {
  const waiting = progress ? Math.max(0, progress.submitted - progress.graded) : 0;
  const approved = assignment.status === "approved";

  return (
    <article className="atlas-card-hover group flex items-center gap-4 rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-panel)]">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium leading-6">
          {assignment.id ? <TextLink href={`/teach/work/${assignment.id}`}>{assignment.title}</TextLink> : assignment.title}
        </p>
        <p className="text-[12.5px] text-[var(--color-muted)]">
          {assignment.dueAt ? `Due ${assignment.dueAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "No due date"}
          {assignment.points ? ` / ${Math.round(assignment.points)} pts` : ""}
        </p>
      </div>
      <div className="hidden shrink-0 sm:block">
        <CodeList codes={assignment.objectiveCodes} />
      </div>
      {waiting > 0 ? <StatusBadge tone="warn">{waiting} ungraded</StatusBadge> : null}
      {approved ? (
        <StatusBadge tone="good">Live</StatusBadge>
      ) : (
        <form action={publishAssignment}>
          <input type="hidden" name="assignmentId" value={assignment.id} />
          <input type="hidden" name="returnTo" value="/teach/work" />
          <ActionButton variant="secondary" ariaLabel={`Publish ${assignment.title}`} title="Publish">
            <Check size={13} strokeWidth={2} aria-hidden="true" />
            <span className="ml-1">Publish</span>
          </ActionButton>
        </form>
      )}
    </article>
  );
}
