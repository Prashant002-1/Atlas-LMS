import { BookOpenIcon, ExternalLinkIcon, FileTextIcon } from "lucide-react";
import type { SourceDocumentUIPart, SourceUrlUIPart } from "ai";

export type AtlasSourcePart = SourceUrlUIPart | SourceDocumentUIPart;

function safeSourceHref(value: string): string | null {
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function Sources({ sources }: { sources: AtlasSourcePart[] }) {
  const unique = [...new Map(sources.map((source) => [source.sourceId, source])).values()];
  if (unique.length === 0) return null;

  return (
    <section className="w-full max-w-[42rem] rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <div className="flex items-center gap-2 text-[0.71875rem] font-medium text-[var(--color-muted)]">
        <BookOpenIcon size={13} className="text-[var(--color-faint)]" aria-hidden />
        {unique.length} {unique.length === 1 ? "source" : "sources"}
      </div>
      <ol className="mt-2 space-y-1.5">
        {unique.map((source, index) => {
          if (source.type === "source-url") {
            const href = safeSourceHref(source.url);
            const label = source.title?.trim() || source.url;
            return (
              <li key={source.sourceId} className="flex min-w-0 items-start gap-2 text-[0.75rem] leading-5">
                <span className="mt-0.5 shrink-0 text-[0.65625rem] tabular-nums text-[var(--color-faint)]">{index + 1}</span>
                {href ? (
                  <a href={href} target={href.startsWith("https://") ? "_blank" : undefined} rel={href.startsWith("https://") ? "noopener noreferrer" : undefined} className="min-w-0 text-[var(--color-accent-strong)] underline decoration-[var(--color-border-strong)] underline-offset-2 hover:text-[var(--color-ink)]">
                    <span className="break-words">{label}</span>
                    <ExternalLinkIcon size={11} className="ml-1 inline" aria-hidden />
                  </a>
                ) : <span className="break-words text-[var(--color-muted)]">{label}</span>}
              </li>
            );
          }
          return (
            <li key={source.sourceId} className="flex min-w-0 items-start gap-2 text-[0.75rem] leading-5 text-[var(--color-muted)]">
              <span className="mt-0.5 shrink-0 text-[0.65625rem] tabular-nums text-[var(--color-faint)]">{index + 1}</span>
              <FileTextIcon size={12} className="mt-1 shrink-0 text-[var(--color-faint)]" aria-hidden />
              <span className="min-w-0 break-words">{source.title || source.filename || "Document source"}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
