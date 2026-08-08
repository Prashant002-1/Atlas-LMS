import Link from "next/link";
import { FileText } from "lucide-react";
import { ActionButton } from "@/components/atlas/primitives";
import { RecordDialog } from "@/components/teach/record-dialog";
import { documentFileAccept, FilePicker } from "@/components/teach/file-picker";
import type { DocumentAttachmentItem } from "@/lib/course/documents";
import { uploadOwnedDocument } from "@/lib/instructor/document-actions";

export function DocumentAttachmentSection({
  items,
  audience,
  owner,
  title = "Documents",
}: {
  items: DocumentAttachmentItem[];
  audience: "instructor" | "student";
  owner?: { type: "syllabus" | "assignment"; id: string; returnTo: string };
  title?: string;
}) {
  const documentBase = audience === "instructor" ? "/teach/documents" : "/student/documents";
  return (
    /*
      The header spans the content column so the action lands on the same right
      edge as every other page action. Constraining the whole section to
      max-w-4xl pulled the button inward and made it read as floating.
    */
    <section aria-labelledby="attached-documents-heading" className="mt-7 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="attached-documents-heading" className="text-[0.8125rem] font-semibold text-[var(--color-ink)]">{title}</h2>
        {owner ? <DocumentUploadDialog owner={owner} /> : null}
      </div>
      {items.length > 0 ? (
        <ul className="mt-3 max-w-4xl divide-y divide-[var(--color-border)]">
          {items.map((item) => (
            <li key={item.attachmentId} className="flex items-start gap-3 px-2 py-3">
              <FileText size={15} strokeWidth={1.8} aria-hidden className="mt-0.5 shrink-0 text-[var(--color-muted)]" />
              <div className="min-w-0 flex-1">
                <Link href={`${documentBase}/${item.fileId}`} className="text-[0.8125rem] font-medium text-[var(--color-ink)] underline decoration-[color-mix(in_oklch,var(--color-ink)_24%,transparent)] underline-offset-[3px] transition hover:text-[var(--color-accent-strong)]">
                  {item.displayName}
                </Link>
                <p className="mt-0.5 text-[0.6875rem] text-[var(--color-faint)]">
                  {[item.filename, measure(item), audience === "instructor" ? statusLabel(item.processingStatus) : null].filter(Boolean).join(" / ")}
                </p>
                {audience === "instructor" && item.processingStatus === "failed" ? (
                  <p className="mt-1 text-[0.6875rem] leading-5 text-[var(--color-danger)]">
                    Readable content failed. The original is still available.{item.processingError ? ` ${item.processingError}` : ""}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 max-w-4xl py-3 text-[0.78125rem] text-[var(--color-muted)]">No documents attached.</p>
      )}
    </section>
  );
}

function DocumentUploadDialog({ owner }: { owner: { type: "syllabus" | "assignment"; id: string; returnTo: string } }) {
  return (
    <RecordDialog mode="create" triggerLabel="Attach document" title="Attach document" triggerVariant="secondary">
      <form action={uploadOwnedDocument} className="grid gap-4">
        <input type="hidden" name="ownerType" value={owner.type} />
        <input type="hidden" name="ownerId" value={owner.id} />
        <input type="hidden" name="returnTo" value={owner.returnTo} />
        <FilePicker name="file" required accept={documentFileAccept} />
        <label className="grid gap-1.5 text-[0.75rem] font-medium text-[var(--color-ink)]">
          Display name <span className="font-normal text-[var(--color-faint)]">Optional</span>
          <input name="displayName" type="text" maxLength={240} className={fieldClass} />
        </label>
        <p className="text-[0.71875rem] leading-5 text-[var(--color-muted)]">
          PDF, Office, spreadsheet, plain text, and code files up to 25 MB. Atlas keeps the original and prepares a readable version when processing succeeds.
        </p>
        <div className="flex justify-end pt-2"><ActionButton>Attach</ActionButton></div>
      </form>
    </RecordDialog>
  );
}

function statusLabel(status: DocumentAttachmentItem["processingStatus"]) {
  return { queued: "Queued", processing: "Processing", ready: "Ready", failed: "Failed" }[status];
}

function measure(item: DocumentAttachmentItem) {
  if (item.pageCount) return `${item.pageCount} ${item.pageCount === 1 ? "page" : "pages"}`;
  if (typeof item.sizeBytes !== "number") return null;
  if (item.sizeBytes < 1024) return `${item.sizeBytes} B`;
  if (item.sizeBytes < 1024 * 1024) return `${Math.round(item.sizeBytes / 1024)} KB`;
  return `${(item.sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

const fieldClass = "min-h-10 rounded-control border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 text-[0.8125rem] text-[var(--color-ink)] outline-none transition focus:border-[var(--color-accent-strong)] focus:bg-[var(--color-surface)]";
