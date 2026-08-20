import { BoxIcon, CheckCircle2Icon, Clock3Icon } from "lucide-react";
import { Markdown } from "@/components/agent/markdown";
import { FilePart } from "@/components/ai-elements/file";
import { displayJson, fencedCode } from "@/components/ai-elements/tool";
import { cn } from "@/lib/utils";

export type AtlasArtifact = {
  id?: string;
  title: string;
  description?: string;
  status?: string;
  mediaType?: string;
  filename?: string;
  url?: string;
  content?: string;
  language?: string;
  data?: unknown;
};

export function artifactsFromValue(value: unknown): AtlasArtifact[] {
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const candidates = Array.isArray(record.artifacts)
    ? record.artifacts
    : record.artifact
      ? [record.artifact]
      : looksLikeArtifact(record)
        ? [record]
        : [];
  return candidates.flatMap((candidate, index) => {
    if (!candidate || typeof candidate !== "object") return [];
    const item = candidate as Record<string, unknown>;
    const title = stringValue(item.title) || stringValue(item.filename) || `Artifact ${index + 1}`;
    return [{
      id: stringValue(item.id),
      title,
      description: stringValue(item.description) || stringValue(item.summary),
      status: stringValue(item.status),
      mediaType: stringValue(item.mediaType) || stringValue(item.mimeType),
      filename: stringValue(item.filename),
      url: stringValue(item.url),
      content: stringValue(item.content),
      language: stringValue(item.language),
      data: item.data,
    }];
  });
}

function looksLikeArtifact(value: Record<string, unknown>) {
  return typeof value.title === "string" && (typeof value.content === "string" || typeof value.url === "string" || value.data !== undefined);
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

export function Artifact({ artifact, className }: { artifact: AtlasArtifact; className?: string }) {
  const mediaType = artifact.mediaType || mediaTypeFromArtifact(artifact);
  if (artifact.url) {
    return <FilePart className={className} file={{ url: artifact.url, mediaType, filename: artifact.filename || artifact.title, label: artifact.title }} />;
  }

  return (
    <section className={cn("w-full max-w-[42rem] overflow-hidden rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)]", className)}>
      <header className="flex min-h-11 items-center justify-between gap-3 border-b border-[var(--color-border)] px-3">
        <div className="flex min-w-0 items-center gap-2">
          <BoxIcon size={14} className="shrink-0 text-[var(--color-accent-strong)]" aria-hidden />
          <div className="min-w-0">
            <p className="truncate text-[0.78125rem] font-medium text-[var(--color-ink)]">{artifact.title}</p>
            {artifact.description ? <p className="truncate text-[0.65625rem] text-[var(--color-faint)]">{artifact.description}</p> : null}
          </div>
        </div>
        {artifact.status ? <ArtifactStatus status={artifact.status} /> : null}
      </header>
      {artifact.content ? (
        <div className="max-h-[34rem] overflow-auto px-3 py-3">
          <Markdown>{(artifact.language || isCodeMediaType(mediaType)) ? fencedCode(artifact.content, artifact.language || languageFromMediaType(mediaType)) : artifact.content}</Markdown>
        </div>
      ) : artifact.data !== undefined ? (
        <div className="max-h-[34rem] overflow-auto px-3 py-3">
          <Markdown>{fencedCode(displayJson(artifact.data), "json")}</Markdown>
        </div>
      ) : null}
    </section>
  );
}

function ArtifactStatus({ status }: { status: string }) {
  const complete = /^(complete|completed|done|ready|success)$/i.test(status);
  const Icon = complete ? CheckCircle2Icon : Clock3Icon;
  return <span className="inline-flex shrink-0 items-center gap-1 rounded-row border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-2 py-0.5 text-[0.65625rem] text-[var(--color-muted)]"><Icon size={11} className={complete ? "text-[var(--color-good)]" : "text-[var(--color-faint)]"} aria-hidden />{status}</span>;
}

function mediaTypeFromArtifact(artifact: AtlasArtifact) {
  if (artifact.language) return `text/x-${artifact.language}`;
  return "text/markdown";
}

function isCodeMediaType(mediaType: string) {
  return /json|javascript|typescript|python|java|sql|shell|x-/i.test(mediaType);
}

function languageFromMediaType(mediaType: string) {
  const match = /(?:x-|application\/)([a-z0-9.+-]+)/i.exec(mediaType);
  return match?.[1]?.replace("javascript", "js").replace("typescript", "ts") || "text";
}
