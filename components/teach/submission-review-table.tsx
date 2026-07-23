"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { gradeSubmission, markSubmissionMissing } from "@/lib/instructor/actions";
import { cn } from "@/lib/utils";

export type SubmissionReviewRow = {
  rowId: string;
  studentId: string | null;
  studentName: string;
  standing: string;
  status: "graded" | "submitted" | "missing" | "open";
  submittedAt: string | null;
  gradedAt: string | null;
  score: number | null;
  grade: string | null;
  body: string | null;
  sessionSubmissionId: string | null;
  draftScore: number | null;
  draftReportStatus: "draft" | "final" | null;
};

type SubmissionFilter = "all" | SubmissionReviewRow["status"];

const statusLabel: Record<SubmissionReviewRow["status"], string> = {
  graded: "Graded",
  submitted: "Submitted",
  missing: "Missing",
  open: "Not submitted",
};

const statusDot: Record<SubmissionReviewRow["status"], string> = {
  graded: "bg-[var(--color-good)]",
  submitted: "bg-[var(--color-accent)]",
  missing: "bg-[var(--color-warn)]",
  open: "bg-[var(--color-faint)]",
};

const filterOptions: Array<{ value: SubmissionFilter; label: string }> = [
  { value: "all", label: "All students" },
  { value: "submitted", label: "Submitted" },
  { value: "graded", label: "Graded" },
  { value: "missing", label: "Missing" },
  { value: "open", label: "Not submitted" },
];

export function SubmissionReviewTable({
  assignmentId,
  pointsPossible,
  rows,
}: {
  assignmentId: string;
  pointsPossible: number | null;
  rows: SubmissionReviewRow[];
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<SubmissionFilter>("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const visibleRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesName = !normalizedQuery || row.studentName.toLowerCase().includes(normalizedQuery);
      const matchesFilter = filter === "all" || row.status === filter;
      return matchesName && matchesFilter;
    });
  }, [filter, query, rows]);

  if (rows.length === 0) {
    return <p className="py-6 text-[0.84375rem] text-[var(--color-muted)]">No students are enrolled.</p>;
  }

  return (
    <section aria-labelledby="submissions-heading">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 id="submissions-heading" className="text-[1.125rem] font-semibold text-[var(--color-ink)]">Student submissions</h2>
          <p className="mt-1 text-[0.78125rem] text-[var(--color-muted)]">{visibleRows.length} of {rows.length} students</p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
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
          <label className="relative block">
            <span className="sr-only">Filter submissions</span>
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as SubmissionFilter)}
              className="min-h-9 w-full appearance-none rounded-control border border-[var(--color-border)] bg-[var(--color-surface)] pl-3 pr-10 text-[0.8125rem] text-[var(--color-ink)] outline-none transition focus:border-[var(--color-accent-strong)] sm:w-44"
            >
              {filterOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <ChevronDown size={14} aria-hidden className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
          </label>
        </div>
      </div>

      <div className="mt-4 overflow-hidden border-y border-[var(--color-border)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[54rem] border-collapse text-left">
            <thead>
              <tr className="text-[0.71875rem] text-[var(--color-muted)]">
                <th scope="col" className="px-3 py-2.5 font-medium">Student</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Response</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Submitted</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Grade</th>
                <th scope="col" className="w-12 px-3 py-2.5"><span className="sr-only">Review</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {visibleRows.map((row) => {
                const key = rowKey(row);
                const open = expanded === key;
                return (
                  <Fragment key={key}>
                    <tr className={cn("text-[0.8125rem] transition", open ? "bg-[var(--color-surface-muted)]" : "hover:bg-[var(--color-surface-muted)]")}>
                      <th scope="row" className="px-3 py-3.5 font-medium text-[var(--color-ink)]">
                        {row.sessionSubmissionId ? (
                          <Link href={`/teach/ai-assignments/session/${row.sessionSubmissionId}`} className="underline decoration-[color-mix(in_oklch,var(--color-ink)_25%,transparent)] underline-offset-[3px] transition hover:text-[var(--color-accent-strong)]">
                            {row.studentName}
                          </Link>
                        ) : row.studentName}
                        <span className="mt-0.5 block text-[0.71875rem] font-normal text-[var(--color-faint)]">{row.standing}</span>
                      </th>
                      <td className="max-w-xs px-3 py-3.5 text-[var(--color-muted)]">{responsePreview(row.body)}</td>
                      <td className="px-3 py-3.5">
                        <span className="inline-flex items-center gap-2 text-[var(--color-muted)]"><span className={cn("size-1.5 rounded-full", statusDot[row.status])} aria-hidden />{statusLabel[row.status]}</span>
                      </td>
                      <td className="px-3 py-3.5 tabular-nums text-[var(--color-muted)]">{row.submittedAt ? shortDate(row.submittedAt) : "-"}</td>
                      <td className="px-3 py-3.5 text-right font-medium tabular-nums text-[var(--color-ink)]">{gradeLabel(row, pointsPossible)}</td>
                      <td className="px-3 py-3.5 text-right">
                        <button type="button" onClick={() => setExpanded(open ? null : key)} aria-expanded={open} aria-label={`${open ? "Close" : "Review"} ${row.studentName}`} className="inline-flex rounded-row text-[var(--color-faint)] transition hover:text-[var(--color-ink)]">
                          <ChevronRight size={15} aria-hidden className={cn("transition-transform", open && "rotate-90")} />
                        </button>
                      </td>
                    </tr>
                    {open ? (
                      <tr className="bg-[var(--color-surface-muted)]">
                        <td colSpan={6} className="px-3 pb-5 pt-1">
                          <SubmissionReview
                            assignmentId={assignmentId}
                            pointsPossible={pointsPossible}
                            row={row}
                          />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {visibleRows.length === 0 ? <p className="py-6 text-center text-[0.8125rem] text-[var(--color-muted)]">No students match this filter.</p> : null}
    </section>
  );
}

function SubmissionReview({
  assignmentId,
  pointsPossible,
  row,
}: {
  assignmentId: string;
  pointsPossible: number | null;
  row: SubmissionReviewRow;
}) {
  const canGrade = Boolean(row.studentId && (row.status === "submitted" || row.status === "graded"));
  const canMarkMissing = Boolean(row.studentId && row.status === "open");

  return (
    <div className="grid gap-5 border-t border-[var(--color-border)] pt-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.65fr)]">
      <section aria-label={`${row.studentName} response`}>
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[0.75rem] font-semibold text-[var(--color-ink)]">Student response</h3>
          {row.sessionSubmissionId ? <Link href={`/teach/ai-assignments/session/${row.sessionSubmissionId}`} className="text-[0.71875rem] font-medium text-[var(--color-accent-strong)] underline underline-offset-[3px]">Open full session</Link> : null}
        </div>
        {row.body?.trim() ? (
          <p className="mt-2 max-w-3xl whitespace-pre-wrap border-l-2 border-[var(--color-border-strong)] pl-3 text-[0.84375rem] leading-6 text-[var(--color-muted)]">{row.body}</p>
        ) : (
          <p className="mt-2 text-[0.8125rem] text-[var(--color-faint)]">No response submitted.</p>
        )}
      </section>

      <section aria-label={`${row.studentName} grade`} className="border-t border-[var(--color-border)] pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
        <h3 className="text-[0.75rem] font-semibold text-[var(--color-ink)]">{row.status === "graded" ? "Update grade" : "Grade"}</h3>
        {row.sessionSubmissionId ? (
          <div className="mt-3">
            <p className="text-[0.8125rem] text-[var(--color-muted)]">
              {row.draftScore !== null
                ? `${row.draftReportStatus === "final" ? "Posted" : "Agent draft"}: ${Math.round(row.draftScore)}${typeof pointsPossible === "number" ? ` / ${Math.round(pointsPossible)}` : ""}`
                : "The automatic draft grade is still being prepared."}
            </p>
            <Link href={`/teach/ai-assignments/session/${row.sessionSubmissionId}`} className="mt-3 inline-flex min-h-9 items-center rounded-control border border-[var(--color-ink)] bg-[var(--color-ink)] px-3 text-[0.8125rem] font-medium text-[var(--color-bg)] transition hover:border-[var(--color-accent-strong)] hover:bg-[var(--color-accent-strong)]">Review session grade</Link>
          </div>
        ) : canGrade && row.studentId ? (
          <form action={gradeSubmission} className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
            <input type="hidden" name="assignmentId" value={assignmentId} />
            <input type="hidden" name="studentId" value={row.studentId} />
            <input type="hidden" name="returnTo" value={`/teach/assignments/${assignmentId}`} />
            <label className="grid gap-1 text-[0.71875rem] font-medium text-[var(--color-muted)]">
              Score
              <input name="score" type="number" min={0} max={pointsPossible ?? undefined} step="0.01" defaultValue={row.score ?? ""} required className="min-h-9 rounded-control border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[0.8125rem] text-[var(--color-ink)] outline-none focus:border-[var(--color-accent-strong)]" />
            </label>
            <label className="grid gap-1 text-[0.71875rem] font-medium text-[var(--color-muted)]">
              Letter grade
              <input name="grade" type="text" defaultValue={row.grade ?? ""} className="min-h-9 rounded-control border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[0.8125rem] text-[var(--color-ink)] outline-none focus:border-[var(--color-accent-strong)]" />
            </label>
            <div className="sm:col-span-2">
              <button type="submit" className="inline-flex min-h-9 items-center rounded-control border border-[var(--color-ink)] bg-[var(--color-ink)] px-3 text-[0.8125rem] font-medium text-[var(--color-bg)] transition hover:border-[var(--color-accent-strong)] hover:bg-[var(--color-accent-strong)]">{row.status === "graded" ? "Save grade" : "Post grade"}</button>
            </div>
          </form>
        ) : canMarkMissing && row.studentId ? (
          <form action={markSubmissionMissing} className="mt-3">
            <input type="hidden" name="assignmentId" value={assignmentId} />
            <input type="hidden" name="studentId" value={row.studentId} />
            <input type="hidden" name="returnTo" value={`/teach/assignments/${assignmentId}`} />
            <button type="submit" className="inline-flex min-h-9 items-center rounded-control border border-[var(--color-border-strong)] px-3 text-[0.8125rem] font-medium text-[var(--color-muted)] transition hover:border-[var(--color-warn)] hover:text-[var(--color-warn)]">Mark missing</button>
          </form>
        ) : (
          <p className="mt-2 text-[0.8125rem] text-[var(--color-muted)]">{row.status === "missing" ? "Marked missing" : "A submission is required before grading."}</p>
        )}
      </section>
    </div>
  );
}

function rowKey(row: SubmissionReviewRow): string {
  return row.rowId;
}

function responsePreview(body: string | null): string {
  const text = body?.replace(/\s+/g, " ").trim();
  if (!text) return "No response";
  return text.length > 88 ? `${text.slice(0, 88)}...` : text;
}

function gradeLabel(row: SubmissionReviewRow, pointsPossible: number | null): string {
  if (row.grade) return row.grade;
  if (row.draftScore !== null) {
    const score = Math.round(row.draftScore);
    return typeof pointsPossible === "number" ? `Draft ${score} / ${Math.round(pointsPossible)}` : `Draft ${score}`;
  }
  if (row.score === null) return "-";
  return typeof pointsPossible === "number"
    ? `${Math.round(row.score)} / ${Math.round(pointsPossible)}`
    : String(Math.round(row.score));
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
