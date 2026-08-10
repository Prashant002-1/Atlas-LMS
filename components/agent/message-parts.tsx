"use client";

import type { ReactNode } from "react";
import type {
  DynamicToolUIPart,
  SourceDocumentUIPart,
  SourceUrlUIPart,
  UIMessage,
} from "ai";
import {
  BracesIcon,
  CheckCircle2Icon,
  CircleAlertIcon,
  CircleSlash2Icon,
  FileQuestionIcon,
  ShieldAlertIcon,
} from "lucide-react";
import { Markdown } from "@/components/agent/markdown";
import { Artifact, artifactsFromValue, type AtlasArtifact } from "@/components/ai-elements/artifact";
import { FilePart, type AtlasFile } from "@/components/ai-elements/file";
import { Reasoning } from "@/components/ai-elements/reasoning";
import { ThinkingIndicator } from "@/components/ai-elements/agent-status";
import { Sources, type AtlasSourcePart } from "@/components/ai-elements/sources";
import { Terminal, type TerminalProps } from "@/components/ai-elements/terminal";
import type { ToolState } from "@/components/ai-elements/tool";

export type AtlasLoosePart = {
  type?: unknown;
  state?: unknown;
  input?: unknown;
  output?: unknown;
  data?: unknown;
  text?: unknown;
  errorText?: unknown;
  toolName?: unknown;
  toolCallId?: unknown;
  approval?: unknown;
  id?: unknown;
  url?: unknown;
  filename?: unknown;
  mediaType?: unknown;
  sourceId?: unknown;
  title?: unknown;
} & Record<string, unknown>;

type PartRenderContext = { index: number; streaming: boolean };

export type AtlasMessagePartsProps = {
  message: UIMessage;
  streaming?: boolean;
  toolTitle?: (part: AtlasLoosePart) => string;
  renderDataPart?: (part: AtlasLoosePart, context: PartRenderContext) => ReactNode | undefined;
  renderToolResult?: (part: AtlasLoosePart, context: PartRenderContext) => ReactNode | undefined;
  onToolApproval?: (approval: { id: string; approved: boolean }) => void;
};

const INTERNAL_DATA_TYPES = new Set(["data-atlas-ref", "data-planning-ref", "data-run-context"]);
const TOOL_STATES = new Set<ToolState>([
  "input-streaming",
  "input-available",
  "approval-requested",
  "approval-responded",
  "output-available",
  "output-error",
  "output-denied",
]);

/**
 * Exhaustive application-facing UIMessage renderer.
 *
 * Domain surfaces may add rich cards for intentional user-facing outputs.
 * Reasoning text, tool inputs, tool outputs, and unknown payloads are never
 * inspection surfaces. They resolve to quiet activity or opaque fallbacks.
 */
export function AtlasMessageParts({
  message,
  streaming = false,
  toolTitle,
  renderDataPart,
  renderToolResult,
  onToolApproval,
}: AtlasMessagePartsProps) {
  const parts = (message.parts ?? []) as AtlasLoosePart[];
  const sourceParts = parts.filter(isSourcePart) as AtlasSourcePart[];
  const firstSourceIndex = parts.findIndex(isSourcePart);

  return (
    <>
      {parts.map((part, index) => {
        const type = partType(part);
        const key = partKey(part, index);
        const context = { index, streaming };

        if (type === "step-start") {
          const stepNumber = parts.slice(0, index + 1).filter((candidate) => candidate.type === "step-start").length;
          return <span key={key} className="sr-only" data-atlas-step-start>Agent step {stepNumber}</span>;
        }

        if (type === "text" && typeof part.text === "string") {
          return <Markdown key={key} streaming={streaming && (part.state === "streaming" || index === parts.length - 1)}>{part.text}</Markdown>;
        }

        if (type === "reasoning" && typeof part.text === "string") {
          return <Reasoning key={key} streaming={part.state === "streaming" || (streaming && index === parts.length - 1)}>{part.text}</Reasoning>;
        }

        if (isSourcePart(part)) {
          return index === firstSourceIndex ? <Sources key="message-sources" sources={sourceParts} /> : null;
        }

        if (type === "file" && typeof part.url === "string" && typeof part.mediaType === "string") {
          return <FilePart key={key} file={{ url: part.url, mediaType: part.mediaType, filename: stringOrUndefined(part.filename) }} />;
        }

        if (type === "reasoning-file" && typeof part.url === "string" && typeof part.mediaType === "string") {
          return null;
        }

        if (isToolPart(part)) {
          const terminal = terminalFromToolPart(part, streaming);
          const files = filesFromToolOutput(part);
          const artifacts = artifactsFromToolOutput(part);
          const custom = renderToolResult?.(part, context);
          return (
            <div key={key} className="contents">
              <ToolPart part={part} title={toolTitle?.(part)} onToolApproval={onToolApproval} />
              {terminal ? <Terminal {...terminal} /> : null}
              {files.map((file, fileIndex) => <FilePart key={`${key}-file-${fileIndex}-${file.url}`} file={file} />)}
              {artifacts.map((artifact, artifactIndex) => <Artifact key={artifact.id || `${key}-artifact-${artifactIndex}`} artifact={artifact} />)}
              {custom}
            </div>
          );
        }

        if (type.startsWith("data-")) {
          const custom = renderDataPart?.(part, context);
          if (custom !== undefined) return <div key={key} className="contents">{custom}</div>;
          if (INTERNAL_DATA_TYPES.has(type)) return <span key={key} className="sr-only" data-atlas-internal-part={type} />;
          if (type === "data-terminal") {
            const terminal = terminalFromData(part.data, streaming);
            return terminal ? <Terminal key={key} {...terminal} /> : <UnsupportedPart key={key} part={part} />;
          }
          if (type === "data-artifact") {
            const artifacts = artifactsFromValue(part.data);
            return artifacts.length > 0
              ? <div key={key} className="contents">{artifacts.map((artifact, artifactIndex) => <Artifact key={artifact.id || `${key}-${artifactIndex}`} artifact={artifact} />)}</div>
              : <UnsupportedPart key={key} part={part} />;
          }
          if (type === "data-session-end" || type === "data-session-status") {
            return <SessionStatus key={key} data={part.data} />;
          }
          return <DataPart key={key} part={part} />;
        }

        if (type === "custom") {
          return <CustomPart key={key} kind={typeof part.kind === "string" ? part.kind : "Provider content"} />;
        }

        return <UnsupportedPart key={key} part={part} />;
      })}
    </>
  );
}

function ToolPart({
  part,
  title,
  onToolApproval,
}: {
  part: AtlasLoosePart;
  title?: string;
  onToolApproval?: AtlasMessagePartsProps["onToolApproval"];
}) {
  const state = toolState(part);
  const approval = approvalFrom(part);
  if (state === "input-streaming" || state === "input-available") {
    return <ThinkingIndicator label={title || defaultToolTitle(part)} />;
  }
  if (state === "approval-requested" && approval) {
    return (
      <div className="flex w-full max-w-[42rem] flex-wrap items-center gap-2 py-1 text-[0.75rem] leading-5 text-[var(--color-muted)]">
        <ShieldAlertIcon size={14} className="shrink-0 text-[var(--color-warn)]" aria-hidden />
        <span>Approval is needed to continue.</span>
        {onToolApproval ? (
          <span className="ml-auto flex gap-1.5">
            <button type="button" onClick={() => onToolApproval({ id: approval.id, approved: false })} className="rounded-control px-2.5 py-1 text-[0.71875rem] font-medium text-[var(--color-muted)] transition hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]">Deny</button>
            <button type="button" onClick={() => onToolApproval({ id: approval.id, approved: true })} className="rounded-control bg-[var(--color-ink)] px-2.5 py-1 text-[0.71875rem] font-medium text-[var(--color-surface)] transition hover:opacity-85">Approve</button>
          </span>
        ) : null}
      </div>
    );
  }
  if (state === "output-error") {
    return <SafeToolNotice icon={<CircleAlertIcon size={13} aria-hidden />} label="Atlas could not complete that step." tone="danger" />;
  }
  if (state === "output-denied") {
    return <SafeToolNotice icon={<CircleSlash2Icon size={13} aria-hidden />} label="That step was not approved." tone="muted" />;
  }
  return null;
}

function SafeToolNotice({ icon, label, tone }: { icon: ReactNode; label: string; tone: "danger" | "muted" }) {
  return (
    <p className={tone === "danger"
      ? "flex w-full max-w-[42rem] items-center gap-1.5 py-1 text-[0.75rem] text-[var(--color-danger)]"
      : "flex w-full max-w-[42rem] items-center gap-1.5 py-1 text-[0.75rem] text-[var(--color-muted)]"}>
      {icon}
      <span>{label}</span>
    </p>
  );
}

function DataPart({ part }: { part: AtlasLoosePart }) {
  const label = humanizePartType(partType(part).replace(/^data-/, ""));
  return (
    <div className="flex min-h-10 w-full max-w-[42rem] items-center gap-2 text-[0.75rem] text-[var(--color-muted)]">
      <BracesIcon size={13} className="shrink-0 text-[var(--color-faint)]" aria-hidden />
      <span className="truncate">{label}</span>
    </div>
  );
}

function CustomPart({ kind }: { kind: string }) {
  return (
    <div className="flex min-h-10 w-full max-w-[42rem] items-center gap-2 rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[0.75rem] text-[var(--color-muted)]">
      <BracesIcon size={13} className="shrink-0 text-[var(--color-faint)]" aria-hidden />
      <span className="truncate">{humanizePartType(kind)}</span>
    </div>
  );
}

function UnsupportedPart({ part }: { part: AtlasLoosePart }) {
  return (
    <div className="flex min-h-10 w-full max-w-[42rem] items-center gap-2 text-[0.75rem] text-[var(--color-muted)]">
      <FileQuestionIcon size={14} className="shrink-0 text-[var(--color-warn)]" aria-hidden />
      <span className="truncate">Unsupported output · {humanizePartType(partType(part))}</span>
    </div>
  );
}

function SessionStatus({ data }: { data: unknown }) {
  const record = objectValue(data);
  const reason = stringOrUndefined(record?.reason) || stringOrUndefined(record?.detail) || stringOrUndefined(record?.state) || "Session updated";
  return (
    <div className="flex min-h-10 w-full max-w-[42rem] items-center gap-2 rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[0.75rem] text-[var(--color-muted)]">
      <CheckCircle2Icon size={13} className="shrink-0 text-[var(--color-good)]" aria-hidden />
      <span>{humanizePartType(reason)}</span>
    </div>
  );
}

function isSourcePart(part: AtlasLoosePart): part is AtlasLoosePart & (SourceUrlUIPart | SourceDocumentUIPart) {
  return part.type === "source-url" || part.type === "source-document";
}

function isToolPart(part: AtlasLoosePart): part is AtlasLoosePart & DynamicToolUIPart {
  const type = partType(part);
  return type === "dynamic-tool" || type.startsWith("tool-");
}

function partType(part: AtlasLoosePart) {
  return typeof part.type === "string" ? part.type : "unknown";
}

function partKey(part: AtlasLoosePart, index: number) {
  const stable = [part.toolCallId, part.sourceId, part.id].find((value) => typeof value === "string");
  return stable ? `${partType(part)}-${stable}` : `${partType(part)}-${index}`;
}

function toolState(part: AtlasLoosePart): ToolState {
  const output = objectValue(part.output);
  if (output?.ok === false) return "output-error";
  const state = typeof part.state === "string" ? part.state as ToolState : "input-streaming";
  return TOOL_STATES.has(state) ? state : "input-streaming";
}

function defaultToolTitle(part: AtlasLoosePart) {
  void part;
  return "Working";
}

function humanizePartType(value: string) {
  const text = value.replace(/[._-]+/g, " ").replace(/\s+/g, " ").trim();
  return text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : "Agent output";
}

function stringOrUndefined(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function approvalFrom(part: AtlasLoosePart): { id: string; reason?: string } | null {
  const approval = objectValue(part.approval);
  const id = stringOrUndefined(approval?.id);
  return id ? { id, reason: stringOrUndefined(approval?.reason) } : null;
}

function terminalFromToolPart(part: AtlasLoosePart, streaming: boolean): TerminalProps | null {
  const type = partType(part);
  const output = objectValue(part.output);
  const terminalLike = /terminal|execute|run[_-]?code|python|shell|command/i.test(type)
    || typeof output?.stdout === "string"
    || typeof output?.stderr === "string"
    || typeof output?.exitCode === "number";
  if (!terminalLike) return null;
  const input = objectValue(part.input);
  return {
    command: stringOrUndefined(output?.command) || stringOrUndefined(input?.command) || stringOrUndefined(input?.code),
    stdout: stringOrUndefined(output?.stdout) || (typeof part.output === "string" ? part.output : undefined),
    stderr: stringOrUndefined(output?.stderr),
    exitCode: typeof output?.exitCode === "number" ? output.exitCode : null,
    isStreaming: streaming && (toolState(part) === "input-streaming" || toolState(part) === "input-available"),
    title: stringOrUndefined(output?.title) || "Terminal",
  };
}

function terminalFromData(value: unknown, streaming: boolean): TerminalProps | null {
  const data = objectValue(value);
  if (!data) return null;
  return {
    command: stringOrUndefined(data.command),
    stdout: stringOrUndefined(data.stdout) || stringOrUndefined(data.output),
    stderr: stringOrUndefined(data.stderr),
    exitCode: typeof data.exitCode === "number" ? data.exitCode : null,
    isStreaming: data.state === "streaming" || data.isStreaming === true || (streaming && data.state === undefined && data.exitCode === undefined),
    title: stringOrUndefined(data.title) || "Terminal",
  };
}

function filesFromToolOutput(part: AtlasLoosePart): AtlasFile[] {
  if (toolState(part) !== "output-available") return [];
  const output = objectValue(part.output);
  if (!output) return [];
  const candidates = Array.isArray(output.files) ? output.files : output.file ? [output.file] : [];
  return candidates.flatMap((candidate) => {
    const file = objectValue(candidate);
    const url = stringOrUndefined(file?.url);
    const mediaType = stringOrUndefined(file?.mediaType) || stringOrUndefined(file?.mimeType);
    return url && mediaType ? [{ url, mediaType, filename: stringOrUndefined(file?.filename) || stringOrUndefined(file?.name) }] : [];
  });
}

function artifactsFromToolOutput(part: AtlasLoosePart): AtlasArtifact[] {
  if (toolState(part) !== "output-available") return [];
  const output = objectValue(part.output);
  if (!output) return [];
  if (!("artifact" in output || "artifacts" in output || /artifact|generate[_-]?(file|image|document)/i.test(partType(part)))) return [];
  return artifactsFromValue(output);
}
