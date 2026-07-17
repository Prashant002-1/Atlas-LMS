"use client";

import { useMemo, useState } from "react";
import {
  ClipboardCheck,
  ExternalLink,
  File,
  FileText,
  Film,
  Link2,
  PackageOpen,
  Presentation,
  Search,
} from "lucide-react";
import { setCourseMaterialVisibility } from "@/lib/instructor/course-material-actions";

export type CourseMaterialRow = {
  id: string;
  displayName: string;
  filename: string | null;
  contentType: string | null;
  sizeBytes: number | null;
  url: string | null;
  materialKind: string;
  ingestionSource: string;
  processingStatus: string;
  processingError: string | null;
  visibility: string;
  pageCount: number | null;
  updatedAt: string;
};

const KIND_OPTIONS = ["all", "document", "slides", "assessment", "media", "link", "package", "other"] as const;
const STATUS_OPTIONS = ["all", "ready", "processing", "queued", "failed"] as const;

export function CourseMaterialTable({ rows }: { rows: CourseMaterialRow[] }) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<(typeof KIND_OPTIONS)[number]>("all");
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>("all");

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (kind !== "all" && row.materialKind !== kind) return false;
      if (status !== "all" && row.processingStatus !== status) return false;
      if (!normalized) return true;
      return [row.displayName, row.filename, row.contentType, row.ingestionSource]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized));
    });
  }, [kind, query, rows, status]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-y border-[var(--color-border)] px-3 py-2.5">
        <label className="relative min-w-[15rem] flex-1">
          <span className="sr-only">Search course materials</span>
          <Search size={14} aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-faint)]" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search materials"
            className="min-h-9 w-full rounded-control border border-[var(--color-border)] bg-[var(--color-surface)] pl-8 pr-3 text-[0.78125rem] text-[var(--color-ink)] outline-none placeholder:text-[var(--color-faint)] focus:border-[var(--color-accent-strong)]"
          />
        </label>
        <label>
          <span className="sr-only">Material type</span>
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value as (typeof KIND_OPTIONS)[number])}
            className="min-h-9 rounded-control border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 text-[0.75rem] text-[var(--color-muted)] outline-none focus:border-[var(--color-accent-strong)]"
          >
            {KIND_OPTIONS.map((option) => (
              <option key={option} value={option}>{option === "all" ? "All types" : materialKindLabel(option)}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Processing status</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as (typeof STATUS_OPTIONS)[number])}
            className="min-h-9 rounded-control border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 text-[0.75rem] text-[var(--color-muted)] outline-none focus:border-[var(--color-accent-strong)]"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>{option === "all" ? "All states" : statusLabel(option)}</option>
            ))}
          </select>
        </label>
        <span className="ml-auto text-[0.71875rem] tabular-nums text-[var(--color-faint)]">{visible.length} of {rows.length}</span>
      </div>

      {visible.length > 0 ? (
        <div className="overflow-x-auto border-b border-[var(--color-border)]">
          <table className="w-full min-w-[52rem] border-collapse text-left">
            <thead>
              <tr className="text-[0.6875rem] text-[var(--color-faint)]">
                <th scope="col" className="px-3 py-2.5 font-medium">Material</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Type</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Source</th>
                <th scope="col" className="px-3 py-2.5 font-medium">State</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Access</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Open</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)] text-[0.78125rem]">
              {visible.map((row) => (
                <MaterialRow key={row.id} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="border-b border-[var(--color-border)] px-3 py-8 text-center text-[0.78125rem] text-[var(--color-muted)]">No course materials match these filters.</p>
      )}
    </div>
  );
}

function MaterialRow({ row }: { row: CourseMaterialRow }) {
  const Icon = iconFor(row.materialKind);
  const nextVisibility = row.visibility === "course" ? "instructors" : "course";
  return (
    <tr className="transition hover:bg-[var(--color-surface-muted)]">
      <th scope="row" className="max-w-[24rem] px-3 py-3 align-top font-normal">
        <div className="flex min-w-0 items-start gap-2.5">
          <Icon size={15} strokeWidth={1.8} aria-hidden className="mt-0.5 shrink-0 text-[var(--color-muted)]" />
          <div className="min-w-0">
            <p className="font-medium leading-5 text-[var(--color-ink)]">{row.displayName}</p>
            <p className="mt-0.5 truncate text-[0.6875rem] text-[var(--color-faint)]" title={row.filename ?? undefined}>
              {[row.filename, materialMeasure(row), `Updated ${formatDate(row.updatedAt)}`].filter(Boolean).join(" / ")}
            </p>
            {row.processingStatus === "failed" && row.processingError ? (
              <p className="mt-1 line-clamp-2 text-[0.6875rem] leading-4 text-[var(--color-danger)]">{row.processingError}</p>
            ) : null}
          </div>
        </div>
      </th>
      <td className="px-3 py-3 align-top text-[var(--color-muted)]">{materialKindLabel(row.materialKind)}</td>
      <td className="px-3 py-3 align-top text-[var(--color-muted)]">{materialSourceLabel(row.ingestionSource)}</td>
      <td className="px-3 py-3 align-top">
        <span className={row.processingStatus === "failed" ? "text-[var(--color-danger)]" : row.processingStatus === "ready" ? "text-[var(--color-muted)]" : "text-[var(--color-warn)]"}>
          {statusLabel(row.processingStatus)}
        </span>
      </td>
      <td className="px-3 py-3 align-top">
        <form action={setCourseMaterialVisibility}>
          <input type="hidden" name="materialId" value={row.id} />
          <input type="hidden" name="visibility" value={nextVisibility} />
          <button
            type="submit"
            className="rounded-control text-[0.75rem] font-medium text-[var(--color-muted)] underline decoration-[color-mix(in_oklch,var(--color-ink)_25%,transparent)] underline-offset-[3px] transition hover:text-[var(--color-ink)]"
            aria-label={`Change ${row.displayName} access to ${nextVisibility === "course" ? "course" : "instructors only"}`}
          >
            {row.visibility === "course" ? "Course" : "Instructors"}
          </button>
        </form>
      </td>
      <td className="px-3 py-3 text-right align-top">
        {row.url ? (
          <a
            href={row.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open ${row.displayName}`}
            className="inline-flex size-7 items-center justify-center rounded-control text-[var(--color-muted)] transition hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)]"
          >
            <ExternalLink size={13} aria-hidden />
          </a>
        ) : <span className="text-[var(--color-faint)]">-</span>}
      </td>
    </tr>
  );
}

const KIND_ICONS: Record<string, typeof File> = {
  document: FileText,
  slides: Presentation,
  assessment: ClipboardCheck,
  media: Film,
  link: Link2,
  package: PackageOpen,
  other: File,
};

const KIND_LABELS: Record<string, string> = {
  document: "Document",
  slides: "Slides",
  assessment: "Assessment",
  media: "Media",
  link: "Link",
  package: "Course package",
  other: "Material",
};

const SOURCE_LABELS: Record<string, string> = {
  upload: "Upload",
  common_cartridge: "Common Cartridge",
  qti: "QTI",
  lms_import: "LMS import",
  external: "External link",
  seed: "Course seed",
};

const STATUS_LABELS: Record<string, string> = {
  ready: "Ready",
  processing: "Processing",
  queued: "Queued",
  failed: "Failed",
};

function iconFor(kind: string) {
  return KIND_ICONS[kind] ?? File;
}

function materialKindLabel(kind: string) {
  return KIND_LABELS[kind] ?? "Material";
}

function materialSourceLabel(source: string) {
  return SOURCE_LABELS[source] ?? "Course";
}

function statusLabel(status: string) {
  return STATUS_LABELS[status] ?? status;
}

function materialMeasure(row: CourseMaterialRow) {
  if (row.pageCount) return `${row.pageCount} ${row.pageCount === 1 ? "page" : "pages"}`;
  if (typeof row.sizeBytes === "number") return formatBytes(row.sizeBytes);
  return null;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
