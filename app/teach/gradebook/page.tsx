import Link from "next/link";
import { auth } from "@/lib/auth";
import { loadInstructorGradebook, type GradebookCell } from "@/lib/instructor/workspace";
import { PageHeader } from "@/components/teach/page-header";
import { EmptyState } from "@/components/atlas/record";

/**
 * The gradebook: one table, one student per row, one assignment per column.
 * Grading happens on the assignment page linked from each column heading.
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

  const cells = gradebook.rows.flatMap((row) => row.cells).filter((cell): cell is GradebookCell => Boolean(cell));
  const graded = cells.filter((cell) => cell.status === "graded").length;
  const submitted = cells.filter((cell) => cell.status === "submitted").length;
  const missing = cells.filter((cell) => cell.status === "missing").length;

  return (
    <>
      <PageHeader title="Gradebook" course={`${gradebook.course.code} / ${gradebook.course.term}`} />

      {gradebook.columns.length > 0 && gradebook.rows.length > 0 ? (
        <section aria-labelledby="gradebook-table-heading">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
            <div>
              <h2 id="gradebook-table-heading" className="text-[0.875rem] font-semibold text-[var(--color-ink)]">Course grades</h2>
              <p className="mt-0.5 text-[0.75rem] text-[var(--color-muted)]">
                {gradebook.rows.length} students / {gradebook.columns.length} assignments
              </p>
            </div>
            <dl className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.71875rem] text-[var(--color-muted)]">
              <GradebookFact label="Graded" value={graded} />
              <GradebookFact label="Submitted" value={submitted} />
              <GradebookFact label="Missing" value={missing} />
            </dl>
          </div>

          <div className="overflow-x-auto border-y border-[var(--color-border)] bg-[var(--color-surface)]">
            <table className="w-full min-w-[52rem] border-collapse text-left">
              <caption className="sr-only">Students by assignment with submission status, score, and course standing.</caption>
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-muted)]">
                  <th scope="col" className="sticky left-0 z-20 min-w-[12rem] border-r border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3 text-[0.71875rem] font-semibold text-[var(--color-muted)]">
                    Student
                  </th>
                  {gradebook.columns.map((column, index) => (
                    <th key={column.id} scope="col" className="min-w-[10.5rem] border-r border-[var(--color-border)] px-3 py-3 align-bottom last:border-r-0">
                      <Link
                        href={`/teach/work/${column.id}`}
                        className="group/col block rounded-row focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)]"
                      >
                        <span className="atlas-mono block text-[0.625rem] font-medium tabular-nums text-[var(--color-faint)]">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span className="mt-1 block text-[0.75rem] font-semibold leading-4 text-[var(--color-ink)] transition group-hover/col:text-[var(--color-accent-strong)]">
                          {column.name}
                        </span>
                        <span className="mt-1 block text-[0.65625rem] font-normal leading-4 text-[var(--color-faint)]">
                          {assignmentMeta(column)}
                        </span>
                      </Link>
                    </th>
                  ))}
                  <th scope="col" className="sticky right-0 z-20 min-w-[6.5rem] border-l border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3 text-right text-[0.71875rem] font-semibold text-[var(--color-muted)]">
                    Standing
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {gradebook.rows.map((row) => (
                  <tr key={row.studentId} className="group/grade-row hover:bg-[var(--color-surface-muted)]">
                    <th scope="row" className="sticky left-0 z-10 border-r border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-left font-normal group-hover/grade-row:bg-[var(--color-surface-muted)]">
                      <Link
                        href={`/teach/student/${row.studentId}`}
                        className="rounded-row text-[0.8125rem] font-medium text-[var(--color-ink)] underline decoration-[color-mix(in_oklch,var(--color-ink)_22%,transparent)] decoration-1 underline-offset-[3px] transition hover:text-[var(--color-accent-strong)] hover:decoration-[var(--color-accent-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)]"
                      >
                        {row.name}
                      </Link>
                    </th>
                    {row.cells.map((cell, index) => (
                      <td key={gradebook.columns[index]?.id ?? index} className="border-r border-[var(--color-border)] px-3 py-3 text-right last:border-r-0">
                        <CellFact cell={cell} points={gradebook.columns[index]?.points ?? null} />
                      </td>
                    ))}
                    <td className="sticky right-0 z-10 border-l border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-right group-hover/grade-row:bg-[var(--color-surface-muted)]">
                      {row.standing ? (
                        <span className="atlas-mono text-[0.78125rem] font-medium tabular-nums text-[var(--color-ink)]">{row.standing}</span>
                      ) : (
                        <span className="text-[0.75rem] text-[var(--color-faint)]">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <div className="rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-panel)]">
          <EmptyState
            art="atlas"
            title="Nothing to grade yet"
            detail={gradebook.rows.length === 0 ? "No one is enrolled in this course yet." : "This course has no assignments yet."}
          />
        </div>
      )}
    </>
  );
}

function GradebookFact({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt>{label}</dt>
      <dd className="atlas-mono font-medium tabular-nums text-[var(--color-ink)]">{value}</dd>
    </div>
  );
}

function assignmentMeta(column: { points: number | null; dueAt: Date | null; published: boolean }) {
  const facts: string[] = [];
  if (column.dueAt) facts.push(column.dueAt.toLocaleDateString("en-US", { month: "short", day: "numeric" }));
  if (typeof column.points === "number") facts.push(`${Math.round(column.points)} pts`);
  if (!column.published) facts.push("Draft");
  return facts.join(" / ") || "No due date";
}

/** The cell states the submission's fact: a score, submitted, missing, or nothing. */
function CellFact({ cell, points }: { cell: GradebookCell | null; points: number | null }) {
  if (!cell || cell.status === "open") {
    return <span className="text-[0.75rem] text-[var(--color-faint)]">-</span>;
  }
  if (cell.status === "missing") {
    return <span className="text-[0.71875rem] font-medium text-[var(--color-danger)]">Missing</span>;
  }
  if (cell.status === "submitted") {
    return <span className="text-[0.71875rem] font-medium text-[var(--color-muted)]">Submitted</span>;
  }

  const score = typeof cell.score === "number" ? Math.round(cell.score) : null;
  return (
    <span className="inline-flex min-w-[3rem] flex-col items-end">
      <span className="atlas-mono text-[0.78125rem] font-medium tabular-nums text-[var(--color-ink)]">
        {score ?? cell.grade ?? "-"}
        {score !== null && typeof points === "number" ? <span className="font-normal text-[var(--color-faint)]">/{Math.round(points)}</span> : null}
      </span>
      {score !== null && cell.grade ? <span className="mt-0.5 text-[0.625rem] text-[var(--color-faint)]">{cell.grade}</span> : null}
    </span>
  );
}
