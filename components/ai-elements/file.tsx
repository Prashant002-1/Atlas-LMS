import {
  ExternalLinkIcon,
  FileAudioIcon,
  FileIcon,
  FileImageIcon,
  FileTextIcon,
  FileVideoIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type AtlasFile = {
  url: string;
  mediaType: string;
  filename?: string;
  label?: string;
};

function mediaGroup(mediaType: string) {
  return mediaType.split("/", 1)[0].toLowerCase();
}

export function safeFileUrl(file: Pick<AtlasFile, "url" | "mediaType">): string | null {
  const value = file.url.trim();
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  if (value.startsWith("blob:")) return value;
  if (value.startsWith("data:")) {
    const group = mediaGroup(file.mediaType);
    return ["image", "audio", "video", "text", "application"].includes(group) && value.toLowerCase().startsWith(`data:${group}/`)
      ? value
      : null;
  }
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function FilePart({ file, className }: { file: AtlasFile; className?: string }) {
  const url = safeFileUrl(file);
  const group = mediaGroup(file.mediaType);
  const title = file.filename?.trim() || file.label?.trim() || defaultFileLabel(group);

  if (url && group === "image") {
    return (
      <figure className={cn("w-full max-w-[42rem] overflow-hidden rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)]", className)}>
        {/* Explicit AI SDK file parts are allowed media. Markdown images remain blocked. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={title}
          loading="lazy"
          referrerPolicy="no-referrer"
          crossOrigin={url.startsWith("https://") ? "anonymous" : undefined}
          className="max-h-[32rem] w-full bg-[var(--color-surface-muted)] object-contain"
        />
        <figcaption className="flex min-h-10 items-center justify-between gap-3 border-t border-[var(--color-border)] px-3 text-[0.71875rem] text-[var(--color-muted)]">
          <span className="flex min-w-0 items-center gap-2"><FileImageIcon size={13} aria-hidden /><span className="truncate">{title}</span></span>
          <OpenFileLink url={url} label={`Open ${title}`} />
        </figcaption>
      </figure>
    );
  }

  if (url && group === "audio") {
    return (
      <section className={cn("w-full max-w-[42rem] rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)] p-3", className)}>
        <div className="mb-2 flex items-center gap-2 text-[0.75rem] text-[var(--color-muted)]"><FileAudioIcon size={14} aria-hidden /><span className="truncate">{title}</span></div>
        <audio controls preload="metadata" src={url} className="h-10 w-full" />
      </section>
    );
  }

  if (url && group === "video") {
    return (
      <figure className={cn("w-full max-w-[42rem] overflow-hidden rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)]", className)}>
        <video controls preload="metadata" src={url} className="max-h-[32rem] w-full bg-black object-contain" />
        <figcaption className="flex min-h-10 items-center justify-between gap-3 border-t border-[var(--color-border)] px-3 text-[0.71875rem] text-[var(--color-muted)]">
          <span className="flex min-w-0 items-center gap-2"><FileVideoIcon size={13} aria-hidden /><span className="truncate">{title}</span></span>
          <OpenFileLink url={url} label={`Open ${title}`} />
        </figcaption>
      </figure>
    );
  }

  const Icon = group === "text" ? FileTextIcon : FileIcon;
  return (
    <section className={cn("flex min-h-12 w-full max-w-[42rem] items-center justify-between gap-3 rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2", className)}>
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-row bg-[var(--color-surface-muted)] text-[var(--color-faint)]"><Icon size={15} aria-hidden /></span>
        <div className="min-w-0">
          <p className="truncate text-[0.78125rem] font-medium text-[var(--color-ink)]">{title}</p>
          <p className="truncate text-[0.65625rem] text-[var(--color-faint)]">{file.mediaType || "File"}</p>
        </div>
      </div>
      {url ? <OpenFileLink url={url} label={`Open ${title}`} /> : <span className="shrink-0 text-[0.65625rem] text-[var(--color-faint)]">Unavailable</span>}
    </section>
  );
}

function OpenFileLink({ url, label }: { url: string; label: string }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" aria-label={label} title={label} className="inline-flex size-8 shrink-0 items-center justify-center rounded-control text-[var(--color-muted)] transition hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-accent-strong)]">
      <ExternalLinkIcon size={14} aria-hidden />
    </a>
  );
}

function defaultFileLabel(group: string) {
  if (group === "image") return "Generated image";
  if (group === "audio") return "Audio";
  if (group === "video") return "Video";
  return "File";
}
