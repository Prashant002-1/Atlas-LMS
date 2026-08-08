"use client";

import { useId, useState } from "react";

export const documentFileAccept = ".pdf,.doc,.docx,.docm,.ppt,.pps,.pot,.pptx,.pptm,.ppsx,.ppsm,.xls,.xlsx,.xlsm,.xlsb,.odt,.ods,.odp,.rtf,.epub,.csv,.txt,.md,.xml,.json,.jsonl,.yaml,.yml,.html,.css,.js,.jsx,.ts,.tsx,.mjs,.cjs,.py,.java,.c,.cc,.cpp,.h,.hpp,.go,.rs,.rb,.php,.swift,.kt,.kts,.sql,.sh,.zsh,.bash";
export const courseMaterialFileAccept = `${documentFileAccept},.mp3,.m4a,.wav,.mp4,.mov,.webm,.imscc,.qti,.zip`;

export function FilePicker({
  name,
  accept,
  label = "Choose file",
  required = false,
  multiple = false,
  maxFiles,
  maxTotalBytes,
  onFilesChange,
}: {
  name: string;
  accept?: string;
  label?: string;
  required?: boolean;
  multiple?: boolean;
  maxFiles?: number;
  maxTotalBytes?: number;
  onFilesChange?: (files: File[]) => void;
}) {
  const inputId = useId();
  const [selection, setSelection] = useState({ names: [] as string[], totalBytes: 0, error: "" });
  const count = selection.names.length;
  const nearCountLimit = Boolean(maxFiles && count >= Math.max(1, maxFiles - 2));
  const nearSizeLimit = Boolean(maxTotalBytes && selection.totalBytes >= maxTotalBytes * 0.8);
  const showBoundary = nearCountLimit || nearSizeLimit;

  return (
    <label
      htmlFor={inputId}
      className="flex min-h-14 cursor-pointer items-center justify-center gap-3 rounded-control border border-[var(--color-border-strong)] bg-[var(--color-surface-muted)] px-4 py-3 text-center transition hover:border-[var(--color-ink)] hover:bg-[var(--color-surface)] focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--color-accent-strong)]"
    >
      <input
        id={inputId}
        name={name}
        type="file"
        required={required}
        multiple={multiple}
        accept={accept}
        className="sr-only"
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files ?? []);
          const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
          const error = maxFiles && files.length > maxFiles
            ? `Choose ${maxFiles} or fewer files.`
            : maxTotalBytes && totalBytes > maxTotalBytes
              ? `Choose files totaling ${formatBytes(maxTotalBytes)} or less.`
              : "";
          event.currentTarget.setCustomValidity(error);
          setSelection({ names: files.map((file) => file.name), totalBytes, error });
          onFilesChange?.(files);
        }}
      />
      <span className="shrink-0 rounded-control border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-1.5 text-[0.75rem] font-medium text-[var(--color-ink)]">
        {label}
      </span>
      {count > 0 ? (
        <span
          aria-live="polite"
          className={`min-w-0 truncate text-[0.75rem] ${selection.error ? "text-[var(--color-danger)]" : "text-[var(--color-muted)]"}`}
        >
          {selection.error
            ? selection.error
            : showBoundary
              ? boundaryLabel({ count, totalBytes: selection.totalBytes, maxFiles, maxTotalBytes })
              : count === 1 ? selection.names[0] : `${count} files selected`}
        </span>
      ) : null}
    </label>
  );
}

function boundaryLabel({
  count,
  totalBytes,
  maxFiles,
  maxTotalBytes,
}: {
  count: number;
  totalBytes: number;
  maxFiles?: number;
  maxTotalBytes?: number;
}) {
  return [
    maxFiles ? `${count} of ${maxFiles} files` : `${count} files`,
    maxTotalBytes ? `${formatBytes(totalBytes)} of ${formatBytes(maxTotalBytes)}` : null,
  ].filter(Boolean).join(" / ");
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}
