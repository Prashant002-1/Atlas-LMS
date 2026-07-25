"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The class against one assignment: who submitted, when, and what they got.
 *
 * Rows navigate rather than expand. A submission is not a table cell, it is a
 * file or a link or a page of prose or a whole session transcript, and the
 * expanding row put all of that inside a cell while the score box fought it for
 * width. Clicking a student opens that student's submission, where the work has
 * the room it needs and the grade and feedback sit beside it.
 *
 * The old "Response" column is gone with it. A truncated prose preview only
 * ever described one kind of submission, and reading eighty characters of an
 * answer tells a grader nothing they can act on.
 */

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
  /** What the student actually handed in, so the row can say so. */
  submissionKind?: "text" | "file" | "link" | "session" | "none";
  hasFeedback?: boolean;
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

const kindLabel: Record<NonNullable<SubmissionReviewRow["submissionKind"]>, string> = {
  text: "Written",
  file: "File",
  link: "Link",
  session: "Session",
  none: "-",
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

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[52rem] border-collapse text-left">
          <thead>
            <tr className="text-[0.71875rem] text-[var(--color-muted)]">
              <th scope="col" className="px-3 py-2.5 font-medium">Student</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Submission</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Submitted</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Feedback</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Grade</th>
              <th scope="col" className="w-10 px-3 py-2.5"><span className="sr-only">Open</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {visibleRows.map((row) => {
              /*
               * The session record is the canonical view for an assessed
               * session; everything else opens the ordinary submission page.
               */
              const href = row.sessionSubmissionId
                ? `/teach/ai-assignments/session/${row.sessionSubmissionId}`
                : row.studentId
                  ? `/teach/assignments/${assignmentId}/submissions/${row.studentId}`
                  : null;

              return (
                <tr key={row.rowId} className="group/row text-[0.8125rem] transition hover:bg-[var(--color-surface-muted)]">
                  <th scope="row" className="px-3 py-3.5 font-medium text-[var(--color-ink)]">
                    {href ? (
                      <Link
                        href={href}
                        className="rounded-row underline decoration-[color-mix(in_oklch,var(--color-ink)_25%,transparent)] underline-offset-[3px] transition hover:text-[var(--color-accent-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)]"
                      >
                        {row.studentName}
                      </Link>
                    ) : (
                      row.studentName
                    )}
                    <span className="mt-0.5 block text-[0.71875rem] font-normal text-[var(--color-faint)]">{row.standing}</span>
                  </th>
                  <td className="px-3 py-3.5 text-[var(--color-muted)]">
                    {kindLabel[row.submissionKind ?? inferKind(row)]}
                  </td>
                  <td className="px-3 py-3.5">
                    <span className="inline-flex items-center gap-2 text-[var(--color-muted)]">
                      <span className={cn("size-1.5 rounded-full", statusDot[row.status])} aria-hidden />
                      {statusLabel[row.status]}
                    </span>
                  </td>
                  <td className="px-3 py-3.5 tabular-nums text-[var(--color-muted)]">{row.submittedAt ? shortDate(row.submittedAt) : "-"}</td>
                  <td className="px-3 py-3.5 text-[var(--color-muted)]">{row.hasFeedback ? "Written" : "-"}</td>
                  <td className="px-3 py-3.5 text-right font-medium tabular-nums text-[var(--color-ink)]">{gradeLabel(row, pointsPossible)}</td>
                  <td className="px-3 py-3.5 text-right">
                    {href ? (
                      <Link
                        href={href}
                        aria-label={`Open ${row.studentName}`}
                        className="inline-flex rounded-row text-[var(--color-faint)] transition group-hover/row:translate-x-0.5 group-hover/row:text-[var(--color-ink)]"
                      >
                        <ChevronRight size={15} aria-hidden />
                      </Link>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {visibleRows.length === 0 ? <p className="py-6 text-center text-[0.8125rem] text-[var(--color-muted)]">No students match this filter.</p> : null}
    </section>
  );
}

/** Older rows carry no explicit kind, so read it off what the row has. */
function inferKind(row: SubmissionReviewRow): NonNullable<SubmissionReviewRow["submissionKind"]> {
  if (row.sessionSubmissionId) return "session";
  if (row.body && row.body.trim().length > 0) return "text";
  return "none";
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
