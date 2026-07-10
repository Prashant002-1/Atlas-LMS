import Link from "next/link";
import { Check } from "lucide-react";
import { auth } from "@/lib/auth";
import { loadInstructorGradebook, type GradebookCell } from "@/lib/instructor/workspace";
import { PageHeader } from "@/components/teach/page-header";
import { EmptyState } from "@/components/atlas/record";

/**
 * The gradebook: the whole class against the whole course. One row per
 * student, one column per assignment, each cell the submission's own state.
 * Grading itself happens on the assignment page the column links to.
 */
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

  return (
    <>
      <PageHeader title="Gradebook" course={`${gradebook.course.code} / ${gradebook.course.term}`} />

      {gradebook.columns.length > 0 && gradebook.rows.length > 0 ? (
        <div className="overflow-x-auto rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-panel)]">
          <table className="w-full min-w-[40rem] border-collapse text-left">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th scope="col" className="sticky left-0 bg-[var(--color-surface)] px-4 py-2.5 text-[0.75rem] font-semibold text-[var(--color-muted)]">
                  Student
                </th>
                {gradebook.columns.map((column) => (
                  <th key={column.id} scope="col" className="max-w-[9rem] px-3 py-2.5 align-bottom">
                    <Link
                      href={`/teach/work/${column.id}`}
                      title={column.name}
                      className="group/col block rounded-row focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)]"
                    >
                      <span className="block truncate text-[0.75rem] font-semibold text-[var(--color-ink)] transition group-hover/col:text-[var(--color-accent-strong)]">
                        {column.name}
                      </span>
                      <span className="atlas-mono mt-0.5 block text-[0.65625rem] uppercase tracking-[0.05em] text-[var(--color-faint)]">
                        {column.points ? `${Math.round(column.points)} pts` : ""}
                        {column.published ? "" : column.points ? " / draft" : "draft"}
                      </span>
                    </Link>
                  </th>
                ))}
                <th scope="col" className="px-4 py-2.5 text-right text-[0.75rem] font-semibold text-[var(--color-muted)]">
                  Standing
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {gradebook.rows.map((row) => (
                <tr key={row.studentId} className="atlas-row-hover hover:bg-[var(--color-surface-muted)]">
                  <th scope="row" className="sticky left-0 bg-[var(--color-surface)] px-4 py-2 text-left font-normal">
                    <Link
                      href={`/teach/student/${row.studentId}`}
                      className="rounded-row text-[0.8125rem] font-medium text-[var(--color-ink)] underline decoration-[color-mix(in_oklch,var(--color-ink)_22%,transparent)] decoration-1 underline-offset-[3px] transition hover:text-[var(--color-accent-strong)] hover:decoration-[var(--color-accent-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)]"
                    >
                      {row.name}
                    </Link>
                  </th>
                  {row.cells.map((cell, index) => (
                    <td key={gradebook.columns[index]?.id ?? index} className="px-3 py-2">
                      <CellFact cell={cell} />
                    </td>
                  ))}
                  <td className="px-4 py-2 text-right">
                    {row.standing ? (
                      <span className="atlas-mono text-[0.78125rem] tabular-nums text-[var(--color-ink)]">{row.standing}</span>
                    ) : (
                      <span className="text-[0.78125rem] text-[var(--color-faint)]">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-panel)]">
          <EmptyState
            art="atlas"
            title="Nothing to grade yet"
            detail={
              gradebook.rows.length === 0
                ? "No one is enrolled in this course yet."
                : "This course has no assignments yet."
            }
          />
        </div>
      )}
    </>
  );
}

/** The cell states the submission's fact: a score, submitted, missing, or nothing. */
function CellFact({ cell }: { cell: GradebookCell | null }) {
  if (!cell || cell.status === "open") {
    return <span className="text-[0.78125rem] text-[var(--color-faint)]">-</span>;
  }
  if (cell.status === "missing") {
    return <span className="text-[0.6875rem] font-medium text-[var(--color-danger)]">Missing</span>;
  }
  if (cell.status === "submitted") {
    return (
      <span title="Submitted, not graded" className="inline-flex text-[var(--color-muted)]">
        <Check size={14} strokeWidth={2} aria-hidden />
        <span className="sr-only">Submitted, not graded</span>
      </span>
    );
  }
  return (
    <span className="atlas-mono text-[0.78125rem] tabular-nums text-[var(--color-ink)]">
      {typeof cell.score === "number" ? Math.round(cell.score) : cell.grade ?? ""}
    </span>
  );
}
