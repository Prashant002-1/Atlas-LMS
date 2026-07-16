import { auth } from "@/lib/auth";
import { loadInstructorGradebook } from "@/lib/instructor/workspace";
import { PageHeader } from "@/components/teach/page-header";
import { EmptyState } from "@/components/atlas/record";
import { GradebookTable, type GradebookTableColumn, type GradebookTableRow } from "@/components/teach/gradebook-table";

/** The course grade matrix, filterable without losing its comparison structure. */
export default async function TeachGradebookPage() {
  const session = await auth();
  const gradebook = await loadInstructorGradebook(session?.user);

  if (gradebook.problem) {
    return (
      <>
        <PageHeader title="Gradebook" />
        <p className="max-w-lg text-[0.875rem] leading-6 text-[var(--color-muted)]">{gradebook.problem.detail}</p>
      </>
    );
  }

  const columns: GradebookTableColumn[] = gradebook.columns.map((column) => ({
    id: column.id,
    name: column.name,
    points: column.points,
    dueAt: column.dueAt?.toISOString() ?? null,
    published: column.published,
  }));
  const rows: GradebookTableRow[] = gradebook.rows.map((row) => ({
    studentId: row.studentId,
    name: row.name,
    standing: row.standing,
    cells: row.cells,
  }));

  return (
    <>
      <PageHeader title="Gradebook" course={`${gradebook.course.code} / ${gradebook.course.term}`} />

      {columns.length > 0 && rows.length > 0 ? (
        <GradebookTable columns={columns} rows={rows} />
      ) : (
        <div className="border-y border-[var(--color-border)]">
          <EmptyState
            art="atlas"
            title="Nothing to grade yet"
            detail={rows.length === 0 ? "No one is enrolled in this course yet." : "This course has no assignments yet."}
          />
        </div>
      )}
    </>
  );
}
