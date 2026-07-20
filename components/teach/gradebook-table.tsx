"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronDown, Search } from "lucide-react";

export type GradebookTableColumn = {
  id: string;
  name: string;
  points: number | null;
  dueAt: string | null;
  published: boolean;
};

export type GradebookTableCell = {
  status: "graded" | "submitted" | "missing" | "open";
  score: number | null;
  grade: string | null;
} | null;

export type GradebookTableRow = {
  studentId: string;
  name: string;
  standing: string | null;
  cells: GradebookTableCell[];
};

type GradebookStatus = "all" | "graded" | "submitted" | "missing" | "open";

const statusOptions: Array<{ value: GradebookStatus; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "graded", label: "Graded" },
  { value: "submitted", label: "Submitted" },
  { value: "missing", label: "Missing" },
  { value: "open", label: "Not submitted" },
];

export function GradebookTable({ columns, rows }: { columns: GradebookTableColumn[]; rows: GradebookTableRow[] }) {
  const [query, setQuery] = useState("");
  const [assignmentId, setAssignmentId] = useState("all");
  const [status, setStatus] = useState<GradebookStatus>("all");

  const selectedColumns = useMemo(
    () => columns.map((column, index) => ({ column, index })).filter(({ column }) => assignmentId === "all" || column.id === assignmentId),
    [assignmentId, columns]
  );

  const visibleRows = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("en-US");
    return rows.filter((row) => {
      const matchesName = !normalized || row.name.toLocaleLowerCase("en-US").includes(normalized);
      const matchesStatus = status === "all" || selectedColumns.some(({ index }) => cellStatus(row.cells[index] ?? null) === status);
      return matchesName && matchesStatus;
    });
  }, [query, rows, selectedColumns, status]);

  const visibleCells = visibleRows.flatMap((row) => selectedColumns.map(({ index }) => row.cells[index] ?? null));
  const graded = visibleCells.filter((cell) => cell?.status === "graded").length;
  const submitted = visibleCells.filter((cell) => cell?.status === "submitted").length;
  const missing = visibleCells.filter((cell) => cell?.status === "missing").length;

  return (
    <section aria-labelledby="gradebook-table-heading">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 id="gradebook-table-heading" className="text-[1rem] font-semibold text-[var(--color-ink)]">Course grades</h2>
          <p className="mt-1 text-[0.75rem] text-[var(--color-muted)]">{visibleRows.length} of {rows.length} students / {selectedColumns.length} assignments</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <label className="relative block">
            <span className="sr-only">Search students</span>
            <Search size={14} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-faint)]" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search students"
              className="min-h-9 w-full rounded-control border border-[var(--color-border)] bg-[var(--color-surface)] pl-9 pr-3 text-[0.8125rem] text-[var(--color-ink)] outline-none transition placeholder:text-[var(--color-faint)] focus:border-[var(--color-accent-strong)] sm:w-52"
            />
          </label>
          <SelectControl label="Filter assignment" value={assignmentId} onChange={setAssignmentId} className="sm:w-52">
            <option value="all">All assignments</option>
            {columns.map((column) => <option key={column.id} value={column.id}>{column.name}</option>)}
          </SelectControl>
          <SelectControl label="Filter grade status" value={status} onChange={(value) => setStatus(value as GradebookStatus)} className="sm:w-40">
            {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </SelectControl>
        </div>
      </div>

      <dl className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 border-y border-[var(--color-border)] py-2.5 text-[0.71875rem] text-[var(--color-muted)]">
        <GradebookFact label="Graded" value={graded} />
        <GradebookFact label="Submitted" value={submitted} />
        <GradebookFact label="Missing" value={missing} />
      </dl>

      <div className="overflow-x-auto border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <table className="w-full min-w-[52rem] border-collapse text-left">
          <caption className="sr-only">Students by assignment with submission status, score, and course standing.</caption>
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-muted)]">
              <th scope="col" className="sticky left-0 z-20 min-w-[12rem] border-r border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3 text-[0.71875rem] font-semibold text-[var(--color-muted)]">Student</th>
              {selectedColumns.map(({ column, index }) => (
                <th key={column.id} scope="col" className="min-w-[10.5rem] border-r border-[var(--color-border)] px-3 py-3 align-bottom last:border-r-0">
                  <Link href={`/teach/assignments/${column.id}`} className="group/col block rounded-row focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)]">
                    <span className="atlas-mono block text-[0.625rem] font-medium tabular-nums text-[var(--color-faint)]">{String(index + 1).padStart(2, "0")}</span>
                    <span className="mt-1 block text-[0.75rem] font-semibold leading-4 text-[var(--color-ink)] transition group-hover/col:text-[var(--color-accent-strong)]">{column.name}</span>
                    <span className="mt-1 block text-[0.65625rem] font-normal leading-4 text-[var(--color-faint)]">{assignmentMeta(column)}</span>
                  </Link>
                </th>
              ))}
              <th scope="col" className="sticky right-0 z-20 min-w-[6.5rem] border-l border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3 text-right text-[0.71875rem] font-semibold text-[var(--color-muted)]">Standing</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {visibleRows.map((row) => (
              <tr key={row.studentId} className="group/grade-row hover:bg-[var(--color-surface-muted)]">
                <th scope="row" className="sticky left-0 z-10 border-r border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-left font-normal group-hover/grade-row:bg-[var(--color-surface-muted)]">
                  <Link href={`/teach/student/${row.studentId}`} className="rounded-row text-[0.8125rem] font-medium text-[var(--color-ink)] underline decoration-[color-mix(in_oklch,var(--color-ink)_22%,transparent)] underline-offset-[3px] transition hover:text-[var(--color-accent-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)]">{row.name}</Link>
                </th>
                {selectedColumns.map(({ column, index }) => (
                  <td key={column.id} className="border-r border-[var(--color-border)] px-3 py-3 text-right last:border-r-0">
                    <CellFact cell={row.cells[index] ?? null} points={column.points} />
                  </td>
                ))}
                <td className="sticky right-0 z-10 border-l border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-right group-hover/grade-row:bg-[var(--color-surface-muted)]">
                  {row.standing ? <span className="atlas-mono text-[0.78125rem] font-medium tabular-nums text-[var(--color-ink)]">{row.standing}</span> : <span className="text-[0.75rem] text-[var(--color-faint)]">-</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {visibleRows.length === 0 ? <p className="py-6 text-center text-[0.8125rem] text-[var(--color-muted)]">No students match these filters.</p> : null}
    </section>
  );
}

function SelectControl({ label, value, onChange, className, children }: { label: string; value: string; onChange: (value: string) => void; className: string; children: ReactNode }) {
  return (
    <label className="relative block">
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className={`min-h-9 w-full appearance-none rounded-control border border-[var(--color-border)] bg-[var(--color-surface)] pl-3 pr-10 text-[0.8125rem] text-[var(--color-ink)] outline-none transition focus:border-[var(--color-accent-strong)] ${className}`}>
        {children}
      </select>
      <ChevronDown size={14} aria-hidden className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
    </label>
  );
}

function GradebookFact({ label, value }: { label: string; value: number }) {
  return <div className="flex items-baseline gap-1.5"><dt>{label}</dt><dd className="atlas-mono font-medium tabular-nums text-[var(--color-ink)]">{value}</dd></div>;
}

function cellStatus(cell: GradebookTableCell): Exclude<GradebookStatus, "all"> {
  if (!cell || cell.status === "open") return "open";
  return cell.status;
}

function assignmentMeta(column: GradebookTableColumn) {
  const facts: string[] = [];
  if (column.dueAt) facts.push(new Date(column.dueAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }));
  if (typeof column.points === "number") facts.push(`${Math.round(column.points)} pts`);
  if (!column.published) facts.push("Draft");
  return facts.join(" / ") || "No due date";
}

function CellFact({ cell, points }: { cell: GradebookTableCell; points: number | null }) {
  if (!cell || cell.status === "open") return <span className="text-[0.75rem] text-[var(--color-faint)]">-</span>;
  if (cell.status === "missing") return <span className="text-[0.71875rem] font-medium text-[var(--color-danger)]">Missing</span>;
  if (cell.status === "submitted") return <span className="text-[0.71875rem] font-medium text-[var(--color-muted)]">Submitted</span>;
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
