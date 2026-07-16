import { auth } from "@/lib/auth";
import { loadInstructorWorkspace } from "@/lib/instructor/workspace";
import { createAssignmentRecord } from "@/lib/instructor/actions";
import { PageHeader } from "@/components/teach/page-header";
import { ActionButton } from "@/components/atlas/primitives";
import { EmptyState } from "@/components/atlas/record";
import { RecordDialog } from "@/components/teach/record-dialog";
import { WorkTable, type WorkTableRow } from "@/components/teach/work-table";

// Rows state the ordinary AI assignment fact, and action={publishAssignment}
// is rendered in WorkTable beside draft records.
export default async function TeachWorkPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const session = await auth();
  const [workspace, params] = await Promise.all([loadInstructorWorkspace(session?.user), searchParams]);

  if (workspace.problem) {
    return (
      <>
        <PageHeader title="Work" />
        <p className="max-w-lg text-[0.875rem] leading-6 text-[var(--color-muted)]">{workspace.problem.detail}</p>
      </>
    );
  }

  const progressById = new Map(workspace.workProgress.map((item) => [item.assignmentId, item]));
  const rows: WorkTableRow[] = workspace.assignments.flatMap((assignment) => {
    if (!assignment.id) return [];
    const progress = progressById.get(assignment.id);
    return [{
      id: assignment.id,
      title: assignment.title,
      dueAt: assignment.dueAt?.toISOString() ?? null,
      points: assignment.points ?? null,
      published: assignment.status === "approved",
      aiAssignment: workspace.aiAssignmentIds.includes(assignment.id),
      submitted: progress?.submitted ?? 0,
      graded: progress?.graded ?? 0,
      missing: progress?.missing ?? 0,
      open: progress?.open ?? 0,
    }];
  });

  return (
    <>
      <PageHeader
        title="Work"
        course={`${workspace.course.code} / ${workspace.course.term}`}
        action={<NewAssignmentDialog defaultOpen={params.new === "1"} />}
      />

      {rows.length > 0 ? (
        <WorkTable rows={rows} nowIso={new Date().toISOString()} />
      ) : (
        <div className="border-y border-[var(--color-border)]">
          <EmptyState art="atlas" title="No assignments" detail="Create the first assignment for this course." />
        </div>
      )}
    </>
  );
}

function NewAssignmentDialog({ defaultOpen }: { defaultOpen: boolean }) {
  return (
    <RecordDialog
      mode="create"
      triggerLabel="New assignment"
      title="New assignment"
      description="Create the assignment record. It stays a draft until you publish it."
      triggerVariant="primary"
      defaultOpen={defaultOpen}
    >
      <form action={createAssignmentRecord} className="grid gap-4">
        <label className="grid gap-1.5 text-[0.75rem] font-medium">
          Title
          <input name="title" type="text" required autoFocus placeholder="Problem Set 6: Regression diagnostics" className={fieldClass} />
        </label>
        <label className="grid gap-1.5 text-[0.75rem] font-medium">
          Instructions
          <textarea name="description" rows={6} placeholder="The task, the deliverable, and what good work looks like." className={`${fieldClass} min-h-36 resize-y py-2.5 leading-6`} />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="grid gap-1.5 text-[0.75rem] font-medium">
            Due
            <input name="dueDate" type="date" className={fieldClass} />
          </label>
          <label className="grid gap-1.5 text-[0.75rem] font-medium">
            Points
            <input name="points" type="number" min={1} defaultValue={100} className={fieldClass} />
          </label>
        </div>
        <div className="flex justify-end border-t border-[var(--color-border)] pt-4">
          <ActionButton>Create assignment</ActionButton>
        </div>
      </form>
    </RecordDialog>
  );
}

const fieldClass = "min-h-10 rounded-control border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 text-[0.8125rem] text-[var(--color-ink)] outline-none transition placeholder:text-[var(--color-faint)] focus:border-[var(--color-accent-strong)] focus:bg-[var(--color-surface)]";
