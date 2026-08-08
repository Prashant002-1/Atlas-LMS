"use client";

import { useState } from "react";
import { ExternalLink, FileText } from "lucide-react";
import { ActionButton } from "@/components/atlas/primitives";
import { Markdown } from "@/components/agent/markdown";
import { RichTextEditor } from "@/components/teach/rich-text-editor";
import { assignmentSubmissionFileAccept, FilePicker } from "@/components/teach/file-picker";
import {
  MAX_ASSIGNMENT_SUBMISSION_FILES,
  MAX_ASSIGNMENT_SUBMISSION_UPLOAD_BYTES,
} from "@/lib/course/materials";

type SubmittedFile = {
  attachmentId: string;
  fileId: string;
  displayName: string;
  filename: string | null;
  sizeBytes: number | null;
};

export function AssignmentWork({
  assignmentId,
  returnTo,
  response,
  url,
  files,
  submittedLabel,
  canSubmit,
  canRevise,
  action,
}: {
  assignmentId: string;
  returnTo: string;
  response?: string | null;
  url?: string | null;
  files: SubmittedFile[];
  submittedLabel?: string | null;
  canSubmit: boolean;
  canRevise: boolean;
  action: (formData: FormData) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draftResponse, setDraftResponse] = useState(response ?? "");
  const [draftUrl, setDraftUrl] = useState(url ?? "");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const hasResponse = Boolean(response?.trim());
  const hasUrl = Boolean(url?.trim());
  const hasFiles = files.length > 0;
  const canEdit = canSubmit || canRevise;
  const hasDraftWork = Boolean(draftResponse.trim() || draftUrl.trim() || hasFiles || selectedFiles.length > 0);

  function cancelEditing() {
    setDraftResponse(response ?? "");
    setDraftUrl(url ?? "");
    setSelectedFiles([]);
    setEditing(false);
  }

  return (
    <section className="mt-7 max-w-3xl border-t border-[var(--color-border)] pt-5" aria-labelledby="student-work-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="student-work-heading" className="text-[1rem] font-semibold text-[var(--color-ink)]">
            Your work
          </h2>
          <p className="mt-1 text-[0.75rem] text-[var(--color-muted)]">
            {submittedLabel ?? "Nothing submitted yet."}
          </p>
        </div>

        {canEdit && !editing ? (
          <ActionButton
            type="button"
            size="sm"
            variant={canRevise ? "secondary" : "primary"}
            onClick={() => setEditing(true)}
          >
            {canRevise ? "Edit submission" : "Add work"}
          </ActionButton>
        ) : null}
      </div>

      {hasResponse && !editing ? (
        <Markdown className="mt-4 text-[0.875rem] leading-7">{response ?? ""}</Markdown>
      ) : null}

      {!editing && hasUrl ? (
        <p className="mt-4">
          <a
            href={url ?? ""}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-[0.8125rem] font-medium text-[var(--color-ink)] underline decoration-[color-mix(in_oklch,var(--color-ink)_24%,transparent)] underline-offset-[3px] transition hover:text-[var(--color-accent-strong)]"
          >
            <ExternalLink size={14} aria-hidden />
            Open submitted link
          </a>
        </p>
      ) : null}

      {!editing && hasFiles ? <SubmissionFiles files={files} /> : null}

      {editing ? (
        <form action={action} className="mt-4">
          <input type="hidden" name="assignmentId" value={assignmentId} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <RichTextEditor
            name="body"
            label="Your response"
            labelHidden
            autoFocus
            rows={6}
            maxLength={12000}
            countMode="near-limit"
            defaultValue={response ?? ""}
            onValueChange={setDraftResponse}
            placeholder="Write here, attach files, or add a link."
          />
          <div className="mt-5 grid gap-4 border-t border-[var(--color-border)] pt-4">
            <div>
              <p className="mb-2 text-[0.75rem] font-medium text-[var(--color-ink)]">Files</p>
              {hasFiles ? <SubmissionFiles files={files} compact /> : null}
              <div className={hasFiles ? "mt-3" : undefined}>
                <FilePicker
                  name="files"
                  label="Choose files"
                  accept={assignmentSubmissionFileAccept}
                  multiple
                  maxFiles={MAX_ASSIGNMENT_SUBMISSION_FILES}
                  maxTotalBytes={MAX_ASSIGNMENT_SUBMISSION_UPLOAD_BYTES}
                  existingFiles={files.length}
                  onFilesChange={setSelectedFiles}
                />
              </div>
            </div>
            <label className="grid gap-1.5 text-[0.75rem] font-medium text-[var(--color-ink)]">
              Link
              <input
                name="url"
                type="url"
                inputMode="url"
                value={draftUrl}
                onChange={(event) => setDraftUrl(event.currentTarget.value)}
                placeholder="https://"
                className="min-h-10 rounded-control border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 text-[0.8125rem] text-[var(--color-ink)] outline-none transition placeholder:text-[var(--color-faint)] focus:border-[var(--color-accent-strong)] focus:bg-[var(--color-surface)]"
              />
            </label>
          </div>
          <div className="mt-4 flex justify-end gap-2 border-t border-[var(--color-border)] pt-4">
            <ActionButton type="button" variant="quiet" onClick={cancelEditing}>
              Cancel
            </ActionButton>
            <ActionButton disabled={!hasDraftWork}>{canRevise ? "Update submission" : "Submit assignment"}</ActionButton>
          </div>
        </form>
      ) : null}
    </section>
  );
}

function SubmissionFiles({ files, compact = false }: { files: SubmittedFile[]; compact?: boolean }) {
  return (
    <ul className={`${compact ? "" : "mt-4"} divide-y divide-[var(--color-border)]`}>
      {files.map((file) => (
        <li key={file.attachmentId} className="flex items-start gap-2.5 py-2.5">
          <FileText size={14} aria-hidden className="mt-0.5 shrink-0 text-[var(--color-muted)]" />
          <div className="min-w-0">
            <a
              href={`/student/documents/${file.fileId}`}
              className="text-[0.8125rem] font-medium text-[var(--color-ink)] underline decoration-[color-mix(in_oklch,var(--color-ink)_24%,transparent)] underline-offset-[3px] transition hover:text-[var(--color-accent-strong)]"
            >
              {file.displayName}
            </a>
            <p className="mt-0.5 text-[0.6875rem] text-[var(--color-faint)]">
              {[file.filename, formatBytes(file.sizeBytes)].filter(Boolean).join(" / ")}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function formatBytes(bytes: number | null) {
  if (typeof bytes !== "number") return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
