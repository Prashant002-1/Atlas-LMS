import { Download, ExternalLink } from "lucide-react";
import { BackLink } from "@/components/atlas/primitives";
import { Markdown } from "@/components/agent/markdown";
import { PageHeader } from "@/components/teach/page-header";
import { documentOriginalPath } from "@/lib/course/document-routes";
import type { DocumentDetail } from "@/lib/course/documents";

export function DocumentViewer({ document, backHref }: { document: DocumentDetail; backHref: string }) {
  const originalHref = documentOriginalPath({
    fileId: document.fileId,
    filename: document.filename ?? document.displayName,
  });
  const facts = [
    document.filename,
    document.pageCount ? `${document.pageCount} ${document.pageCount === 1 ? "page" : "pages"}` : formatBytes(document.sizeBytes),
    statusLabel(document.processingStatus),
  ].filter(Boolean).join(" / ");

  return (
    <>
      <BackLink href={backHref}>Back</BackLink>
      <div className="mt-3">
        <PageHeader
          title={document.displayName}
          course={facts}
          action={
            <div className="flex flex-wrap items-center gap-2">
              {document.hasOriginal ? (
                <>
                  <a href={originalHref} target="_blank" rel="noopener noreferrer" className={secondaryActionClass}>
                    <ExternalLink size={13} aria-hidden />
                    Open original
                  </a>
                  <a href={documentOriginalPath({ fileId: document.fileId, filename: document.filename ?? document.displayName, download: true })} className={secondaryActionClass}>
                    <Download size={13} aria-hidden />
                    Download
                  </a>
                </>
              ) : null}
              <button type="button" disabled title="Notes are planned" className={futureActionClass}>Notes</button>
              <button type="button" disabled title="Annotations are planned" className={futureActionClass}>Annotate</button>
            </div>
          }
        />
      </div>

      {document.processingStatus === "failed" ? (
        <p role="status" className="mb-6 max-w-3xl border-l-2 border-[var(--color-danger)] py-1 pl-3 text-[0.8125rem] leading-6 text-[var(--color-muted)]">
          Atlas could not prepare the readable version. The original remains available.{document.processingError ? ` ${document.processingError}` : ""}
        </p>
      ) : document.processingStatus !== "ready" ? (
        <p role="status" className="mb-6 text-[0.8125rem] text-[var(--color-muted)]">Readable content is {document.processingStatus}.</p>
      ) : !document.extraction ? (
        <p role="status" className="mb-6 text-[0.8125rem] text-[var(--color-muted)]">
          {document.hasOriginal
            ? "No readable artifact has been prepared for this existing course file. Open the original to read it."
            : "No readable artifact or durable original is available for this existing course file."}
        </p>
      ) : null}

      {document.extraction ? (
        <div className="max-w-4xl">
          <section aria-labelledby="document-summary-heading" className="pb-7">
            <h2 id="document-summary-heading" className="text-[0.75rem] font-medium text-[var(--color-muted)]">Summary</h2>
            <p className="mt-2 text-[0.9375rem] leading-7 text-[var(--color-ink)]">{document.extraction.summary}</p>
          </section>

          {document.extraction.sections.length > 0 ? (
            <section aria-labelledby="document-outline-heading" className="py-7">
              <h2 id="document-outline-heading" className="text-[1rem] font-semibold text-[var(--color-ink)]">Outline</h2>
              <ol className="mt-3 divide-y divide-[var(--color-border)]">
                {document.extraction.sections.map((section, index) => (
                  <li key={`${section.title}-${index}`} className="flex items-baseline justify-between gap-4 px-2 py-2.5 text-[0.8125rem]">
                    <span className="font-medium text-[var(--color-ink)]">{section.title}</span>
                    {section.pageStart ? <span className="shrink-0 text-[0.6875rem] text-[var(--color-faint)]">{pageLabel(section.pageStart, section.pageEnd)}</span> : null}
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          <section aria-labelledby="document-content-heading" className="py-7">
            <h2 id="document-content-heading" className="text-[1rem] font-semibold text-[var(--color-ink)]">Content</h2>
            <div className="mt-5">
              <Markdown className="text-[0.875rem] leading-7">{document.extraction.contentMarkdown}</Markdown>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function statusLabel(status: DocumentDetail["processingStatus"]) {
  return { queued: "Queued", processing: "Processing", ready: "Ready", failed: "Failed" }[status];
}

function pageLabel(start: number, end: number | null) {
  return end && end !== start ? `pp. ${start}-${end}` : `p. ${start}`;
}

function formatBytes(bytes: number | null) {
  if (typeof bytes !== "number") return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const secondaryActionClass = "inline-flex min-h-9 items-center gap-1.5 rounded-control border border-[var(--color-border)] px-3 text-[0.8125rem] font-medium text-[var(--color-muted)] transition hover:border-[var(--color-border-strong)] hover:text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)]";
const futureActionClass = "inline-flex min-h-9 cursor-not-allowed items-center rounded-control border border-[var(--color-border)] px-3 text-[0.8125rem] font-medium text-[var(--color-faint)] opacity-65";
