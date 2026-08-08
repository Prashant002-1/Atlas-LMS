import { auth } from "@/lib/auth";
import { loadInstructorWorkspace } from "@/lib/instructor/workspace";
import { PageHeader } from "@/components/teach/page-header";
import { EmptyState } from "@/components/atlas/record";
import { AssignmentTable, type AssignmentTableRow } from "@/components/teach/assignment-table";
import { NewAssignmentDialog } from "@/components/teach/new-assignment-dialog";

// Rows state the ordinary AI assignment fact, and action={publishAssignment}
// is rendered beside draft records.
export default async function TeachAssignmentsPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const session = await auth();
  const [workspace, params] = await Promise.all([loadInstructorWorkspace(session?.user), searchParams]);

  if (workspace.problem) {
    return (
      <>
        <PageHeader title="Assignments" />
        <p className="max-w-lg text-[0.875rem] leading-6 text-[var(--color-muted)]">{workspace.problem.detail}</p>
      </>
    );
  }

  const progressById = new Map(workspace.workProgress.map((item) => [item.assignmentId, item]));
  const moduleOptions = workspace.modules.flatMap((module) => module.id ? [{
    id: module.id,
    label: `Week ${module.week}: ${module.title}`,
  }] : []);
  const rows: AssignmentTableRow[] = workspace.assignments.flatMap((assignment) => {
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
        title="Assignments"
        course={`${workspace.course.code} / ${workspace.course.term}`}
        action={<NewAssignmentDialog modules={moduleOptions} defaultOpen={params.new === "1"} />}
      />

      {rows.length > 0 ? (
        <AssignmentTable rows={rows} nowIso={new Date().toISOString()} />
      ) : (
        <div>
          <EmptyState art="atlas" title="No assignments" />
        </div>
      )}
    </>
  );
}
