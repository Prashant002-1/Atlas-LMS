"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { JourneyGridCounts, JourneyGridRow, JourneyState } from "@/lib/instructor/cockpit";

const SESSION_STATE_LABEL: Record<JourneyState, string> = {
  review_requested: "Review requested",
  draft: "Draft grade",
  pending_grading: "Submitted",
  in_session: "In progress",
  not_started: "Not started",
  final: "Graded",
};

const stateDot: Record<JourneyState, string> = {
  review_requested: "bg-[var(--color-warn)]",
  draft: "bg-[var(--color-accent)]",
  pending_grading: "bg-[var(--color-muted)]",
  in_session: "bg-[var(--color-accent)]",
  not_started: "bg-[var(--color-faint)]",
  final: "bg-[var(--color-good)]",
};

const filters: Array<{ value: "all" | JourneyState; label: string }> = [
  { value: "all", label: "All students" },
  { value: "review_requested", label: "Review requested" },
  { value: "draft", label: "Draft grades" },
  { value: "pending_grading", label: "Submitted" },
  { value: "in_session", label: "In progress" },
  { value: "not_started", label: "Not started" },
  { value: "final", label: "Graded" },
];

export function SessionSummary({ counts }: { counts: JourneyGridCounts }) {
  const toReview = counts.draft + counts.reviewRequested;
  return (
    <p className="flex flex-wrap gap-x-4 gap-y-1 text-[0.78125rem] text-[var(--color-muted)]">
      <span><strong className="font-semibold tabular-nums text-[var(--color-ink)]">{counts.submitted}</strong> submitted</span>
      <span><strong className="font-semibold tabular-nums text-[var(--color-ink)]">{toReview}</strong> draft grade{toReview === 1 ? "" : "s"}</span>
      <span><strong className="font-semibold tabular-nums text-[var(--color-ink)]">{counts.final}</strong> graded</span>
    </p>
  );
}

export function SessionTable({ rows, maxScore }: { rows: JourneyGridRow[]; maxScore: number }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | JourneyState>("all");

  const visibleRows = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return rows.filter((row) => {
      const matchesName = !normalizedQuery || row.studentName.toLocaleLowerCase().includes(normalizedQuery);
      const matchesStatus = filter === "all" || row.state === filter;
      return matchesName && matchesStatus;
    });
  }, [filter, query, rows]);

  if (rows.length === 0) {
    return <p className="py-5 text-[0.84375rem] text-[var(--color-muted)]">No students are enrolled.</p>;
  }

  return (
    <section aria-labelledby="student-sessions-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="student-sessions-heading" className="text-[1.125rem] font-semibold text-[var(--color-ink)]">Student sessions</h2>
          <p className="mt-1 text-[0.78125rem] text-[var(--color-muted)]">
            {visibleRows.length} of {rows.length} students
          </p>
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
          <label>
            <span className="sr-only">Filter session status</span>
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as "all" | JourneyState)}
              className="min-h-9 w-full rounded-control border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[0.8125rem] text-[var(--color-ink)] outline-none transition focus:border-[var(--color-accent-strong)] sm:w-44"
            >
              {filters.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="mt-4 overflow-hidden border-y border-[var(--color-border)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] border-collapse text-left">
            <thead>
              <tr className="text-[0.71875rem] font-medium text-[var(--color-muted)]">
                <th scope="col" className="px-3 py-2.5 font-medium">Student</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Session</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Submitted</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Grade</th>
                <th scope="col" className="w-12 px-3 py-2.5"><span className="sr-only">Open</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {visibleRows.map((row) => {
                const href = row.submissionId ? `/teach/ai-assignments/session/${row.submissionId}` : null;
                return (
                  <tr key={row.userId} className={cn("text-[0.8125rem]", href && "transition hover:bg-[var(--color-surface-muted)]")}>
                    <th scope="row" className="px-3 py-3.5 font-medium text-[var(--color-ink)]">
                      {href ? (
                        <Link href={href} className="rounded-row underline decoration-[color-mix(in_oklch,var(--color-ink)_25%,transparent)] underline-offset-[3px] hover:text-[var(--color-accent-strong)]">
                          {row.studentName}
                        </Link>
                      ) : row.studentName}
                    </th>
                    <td className="px-3 py-3.5">
                      <span className="inline-flex items-center gap-2 text-[var(--color-muted)]">
                        <span className={cn("size-1.5 rounded-full", stateDot[row.state])} aria-hidden />
                        {SESSION_STATE_LABEL[row.state]}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 tabular-nums text-[var(--color-muted)]">
                      {row.submittedAt ? shortDate(row.submittedAt) : "-"}
                    </td>
                    <td className="px-3 py-3.5 text-right font-medium tabular-nums text-[var(--color-ink)]">
                      {row.overallScore === null ? "-" : `${Math.round(row.overallScore)} / ${Math.round(maxScore)}`}
                    </td>
                    <td className="px-3 py-3.5 text-right">
                      {href ? (
                        <Link href={href} aria-label={`Open ${row.studentName}'s session`} className="inline-flex rounded-row text-[var(--color-faint)] transition hover:translate-x-0.5 hover:text-[var(--color-ink)]">
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
      </div>

      {visibleRows.length === 0 ? (
        <p className="py-5 text-center text-[0.8125rem] text-[var(--color-muted)]">No students match this filter.</p>
      ) : null}
    </section>
  );
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
