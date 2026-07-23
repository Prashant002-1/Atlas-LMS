"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";

export type AnnouncementListRow = {
  id: string;
  title: string;
  message: string | null;
  authorName: string;
  postedAt: string | null;
  publication: "published" | "scheduled" | "draft";
};

export function AnnouncementList({ rows }: { rows: AnnouncementListRow[] }) {
  const [query, setQuery] = useState("");
  const visibleRows = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("en-US");
    if (!normalized) return rows;
    return rows.filter((row) => [row.title, row.message ?? "", row.authorName].some((value) => value.toLocaleLowerCase("en-US").includes(normalized)));
  }, [query, rows]);

  return (
    <section aria-labelledby="announcements-list-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="announcements-list-heading" className="text-[1rem] font-semibold text-[var(--color-ink)]">Archive</h2>
          <p className="mt-1 text-[0.75rem] tabular-nums text-[var(--color-muted)]">{visibleRows.length} of {rows.length}</p>
        </div>
        <label className="relative block">
          <span className="sr-only">Search announcements</span>
          <Search size={14} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-faint)]" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search announcements"
            className="min-h-9 w-full rounded-control border border-[var(--color-border)] bg-[var(--color-surface)] pl-9 pr-3 text-[0.8125rem] text-[var(--color-ink)] outline-none transition placeholder:text-[var(--color-faint)] focus:border-[var(--color-accent-strong)] sm:w-60"
          />
        </label>
      </div>

      <div className="mt-4 overflow-hidden border-b border-[var(--color-border)]">
        <div className="hidden grid-cols-[minmax(0,1fr)_10rem_12rem_1rem] gap-4 border-b border-[var(--color-border)] px-3 py-2.5 text-[0.71875rem] font-medium text-[var(--color-muted)] sm:grid">
          <span>Announcement</span>
          <span>Author</span>
          <span>Publication</span>
          <span className="sr-only">Open</span>
        </div>
        <div className="divide-y divide-[var(--color-border)]">
          {visibleRows.map((row) => (
            <Link
              key={row.id}
              href={`/teach/announcements/${row.id}`}
              className="group/announcement grid gap-2 px-3 py-3.5 transition hover:bg-[var(--color-surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-accent-strong)] sm:grid-cols-[minmax(0,1fr)_10rem_12rem_1rem] sm:items-center sm:gap-4"
            >
              <span className="min-w-0">
                <span className="block truncate text-[0.8125rem] font-semibold text-[var(--color-ink)]">{row.title}</span>
                <span className="mt-0.5 block truncate text-[0.75rem] text-[var(--color-muted)]">{messagePreview(row.message)}</span>
              </span>
              <span className="truncate text-[0.75rem] font-medium text-[var(--color-muted)]">{row.authorName}</span>
              <time dateTime={row.postedAt ?? undefined} className="text-[0.71875rem] tabular-nums text-[var(--color-muted)]">
                {row.publication === "draft" ? "Draft" : (
                  <>
                    {row.publication === "scheduled" ? <span className="mr-1.5 text-[var(--color-warn)]">Scheduled</span> : null}
                    {timestamp(row.postedAt)}
                  </>
                )}
              </time>
              <ChevronRight size={15} aria-hidden className="hidden text-[var(--color-faint)] transition group-hover/announcement:translate-x-0.5 group-hover/announcement:text-[var(--color-ink)] sm:block" />
            </Link>
          ))}
        </div>
      </div>

      {visibleRows.length === 0 ? <p className="py-6 text-center text-[0.8125rem] text-[var(--color-muted)]">No announcements match this search.</p> : null}
    </section>
  );
}

function messagePreview(message: string | null) {
  const text = message?.replace(/\s+/g, " ").trim();
  return text || "No message";
}

function timestamp(iso: string | null) {
  if (!iso) return "Draft";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
