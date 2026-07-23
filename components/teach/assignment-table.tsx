"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { publishAssignment } from "@/lib/instructor/actions";
import { ActionButton } from "@/components/atlas/primitives";

export type AssignmentTableRow = {
  id: string;
  title: string;
  dueAt: string | null;
  points: number | null;
  published: boolean;
  aiAssignment: boolean;
  submitted: number;
  graded: number;
  missing: number;
  open: number;
};

type AssignmentTiming = "past_due" | "upcoming" | "no_due" | "draft";
type AssignmentFilter = "all" | AssignmentTiming;

const filterOptions: Array<{ value: AssignmentFilter; label: string }> = [
  { value: "all", label: "All assignments" },
  { value: "past_due", label: "Past due" },
  { value: "upcoming", label: "Upcoming" },
  { value: "no_due", label: "No due date" },
  { value: "draft", label: "Draft" },
];

const statusLabel: Record<AssignmentTiming, string> = {
  past_due: "Past due",
  upcoming: "Upcoming",
  no_due: "No due date",
  draft: "Draft",
};

const statusDot: Record<AssignmentTiming, string> = {
  past_due: "bg-[var(--color-danger)]",
  upcoming: "bg-[var(--color-accent)]",
  no_due: "bg-[var(--color-faint)]",
  draft: "bg-[var(--color-muted)]",
};

export function AssignmentTable({ rows, nowIso }: { rows: AssignmentTableRow[]; nowIso: string }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<AssignmentFilter>("all");

  const visibleRows = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("en-US");
    return rows.filter((row) => {
      const timing = assignmentTiming(row, nowIso);
      const matchesQuery = !normalized || row.title.toLocaleLowerCase("en-US").includes(normalized);
      return matchesQuery && (filter === "all" || timing === filter);
    });
  }, [filter, nowIso, query, rows]);

  return (
    <section aria-labelledby="assignment-table-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="assignment-table-heading" className="text-[1rem] font-semibold text-[var(--color-ink)]">Assignments</h2>
          <p className="mt-1 text-[0.75rem] text-[var(--color-muted)]">{visibleRows.length} of {rows.length}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="relative block">
            <span className="sr-only">Search assignments</span>
            <Search size={14} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-faint)]" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search assignments"
              className="min-h-9 w-full rounded-control border border-[var(--color-border)] bg-[var(--color-surface)] pl-9 pr-3 text-[0.8125rem] text-[var(--color-ink)] outline-none transition placeholder:text-[var(--color-faint)] focus:border-[var(--color-accent-strong)] sm:w-56"
            />
          </label>
          <label className="relative block">
            <span className="sr-only">Filter assignments</span>
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as AssignmentFilter)}
              className="min-h-9 w-full appearance-none rounded-control border border-[var(--color-border)] bg-[var(--color-surface)] pl-3 pr-10 text-[0.8125rem] text-[var(--color-ink)] outline-none transition focus:border-[var(--color-accent-strong)] sm:w-44"
            >
              {filterOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <ChevronDown size={14} aria-hidden className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
          </label>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto border-y border-[var(--color-border)]">
        <table className="w-full min-w-[58rem] border-collapse text-left">
          <thead>
            <tr className="text-[0.71875rem] text-[var(--color-muted)]">
              <th scope="col" className="px-3 py-2.5 font-medium">Assignment</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Due</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Submitted</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Ungraded</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Missing</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Not submitted</th>
              <th scope="col" className="w-24 px-3 py-2.5 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {visibleRows.map((row) => {
              const timing = assignmentTiming(row, nowIso);
              const ungraded = Math.max(0, row.submitted - row.graded);
              return (
                <tr key={row.id} className="text-[0.8125rem] transition hover:bg-[var(--color-surface-muted)]">
                  <th scope="row" className="px-3 py-3.5 font-medium text-[var(--color-ink)]">
                    <Link href={`/teach/assignments/${row.id}`} className="rounded-row underline decoration-[color-mix(in_oklch,var(--color-ink)_25%,transparent)] underline-offset-[3px] hover:text-[var(--color-accent-strong)]">
                      {row.title}
                    </Link>
                    <span className="mt-0.5 block text-[0.6875rem] font-normal text-[var(--color-faint)]">
                      {row.aiAssignment ? "AI assignment, " : ""}{typeof row.points === "number" ? `${Math.round(row.points)} points` : "Points not set"}
                    </span>
                  </th>
                  <td className="px-3 py-3.5 tabular-nums text-[var(--color-muted)]">{dueLabel(row.dueAt)}</td>
                  <td className="px-3 py-3.5">
                    <span className={`inline-flex items-center gap-2 ${timing === "past_due" ? "font-medium text-[var(--color-danger)]" : "text-[var(--color-muted)]"}`}>
                      <span className={`size-1.5 rounded-full ${statusDot[timing]}`} aria-hidden />
                      {statusLabel[timing]}
                    </span>
                  </td>
                  <td className="px-3 py-3.5 text-right tabular-nums text-[var(--color-ink)]">{row.published ? row.submitted : "-"}</td>
                  <td className="px-3 py-3.5 text-right tabular-nums text-[var(--color-ink)]">{row.published ? ungraded : "-"}</td>
                  <td className="px-3 py-3.5 text-right tabular-nums text-[var(--color-ink)]">{row.published ? row.missing : "-"}</td>
                  <td className="px-3 py-3.5 text-right tabular-nums text-[var(--color-ink)]">{row.published ? row.open : "-"}</td>
                  <td className="px-3 py-3.5 text-right">
                    {row.published ? (
                      <Link href={`/teach/assignments/${row.id}`} aria-label={`Open ${row.title}`} className="inline-flex rounded-row text-[var(--color-faint)] transition hover:translate-x-0.5 hover:text-[var(--color-ink)]">
                        <ChevronRight size={15} aria-hidden />
                      </Link>
                    ) : (
                      <form action={publishAssignment}>
                        <input type="hidden" name="assignmentId" value={row.id} />
                        <input type="hidden" name="returnTo" value="/teach/assignments" />
                        <ActionButton size="sm" variant="secondary" ariaLabel={`Publish ${row.title}`}>Publish</ActionButton>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {visibleRows.length === 0 ? <p className="py-6 text-center text-[0.8125rem] text-[var(--color-muted)]">No assignments match this filter.</p> : null}
    </section>
  );
}

function assignmentTiming(row: AssignmentTableRow, nowIso: string): AssignmentTiming {
  if (!row.published) return "draft";
  if (!row.dueAt) return "no_due";
  return new Date(row.dueAt).getTime() < new Date(nowIso).getTime() ? "past_due" : "upcoming";
}

function dueLabel(iso: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
