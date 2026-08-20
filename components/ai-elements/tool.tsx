"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import {
  CheckCircleIcon,
  ChevronDownIcon,
  CircleIcon,
  ClockIcon,
  ShieldCheckIcon,
  ShieldXIcon,
  WrenchIcon,
  XCircleIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/agent/markdown";

/**
 * Tool (AI SDK Elements). A collapsible surface for a single agent tool call:
 * a header with the tool name + status badge, and collapsible input/output.
 * Faithful to the registry API (Tool / ToolHeader / ToolContent / ToolInput /
 * ToolOutput) on Atlas tokens, with a self-contained collapsible.
 */
export type ToolState =
  | "input-streaming"
  | "input-available"
  | "approval-requested"
  | "approval-responded"
  | "output-available"
  | "output-error"
  | "output-denied";

const ToolContext = createContext<{ open: boolean; setOpen: (v: boolean) => void } | null>(null);

export function Tool({ className, defaultOpen = false, children }: { className?: string; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <ToolContext.Provider value={{ open, setOpen }}>
      <div className={cn("w-full overflow-hidden rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)]", className)}>
        {children}
      </div>
    </ToolContext.Provider>
  );
}

const statusLabels: Record<ToolState, string> = {
  "input-streaming": "Preparing",
  "input-available": "Running",
  "approval-requested": "Approval needed",
  "approval-responded": "Decision sent",
  "output-available": "Done",
  "output-error": "Error",
  "output-denied": "Denied",
};

function StatusIcon({ state }: { state: ToolState }) {
  if (state === "output-available") return <CheckCircleIcon className="size-3.5 text-[var(--color-good)]" />;
  if (state === "output-error") return <XCircleIcon className="size-3.5 text-[var(--color-danger)]" />;
  if (state === "output-denied") return <ShieldXIcon className="size-3.5 text-[var(--color-warn)]" />;
  if (state === "approval-requested") return <ClockIcon className="size-3.5 text-[var(--color-warn)]" />;
  if (state === "approval-responded") return <ShieldCheckIcon className="size-3.5 text-[var(--color-accent-strong)]" />;
  if (state === "input-available") return <ClockIcon className="size-3.5 animate-pulse text-[var(--color-accent-strong)]" />;
  return <CircleIcon className="size-3.5 text-[var(--color-faint)]" />;
}

export function ToolHeader({
  type,
  state,
  title,
  className,
}: {
  type?: string;
  state: ToolState;
  title?: string;
  className?: string;
}) {
  const ctx = useContext(ToolContext);
  const name = title ?? (type ? type.split("-").slice(1).join("-") || type : "tool");
  return (
    <button
      type="button"
      onClick={() => ctx?.setOpen(!ctx.open)}
      aria-expanded={ctx?.open ?? false}
      className={cn("flex min-h-10 w-full items-center justify-between gap-3 px-3 py-2 text-left transition hover:bg-[var(--color-surface-muted)]", className)}
    >
      <span className="flex min-w-0 items-center gap-2">
        <WrenchIcon className="size-3.5 shrink-0 text-[var(--color-faint)]" aria-hidden />
        <span className="truncate text-[0.8125rem] font-medium text-[var(--color-ink)]">{name}</span>
        <span className="inline-flex items-center gap-1 rounded-row border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-2 py-0.5 text-[0.65625rem] font-medium text-[var(--color-muted)]">
          <StatusIcon state={state} />
          {statusLabels[state]}
        </span>
      </span>
      <ChevronDownIcon className={cn("size-4 shrink-0 text-[var(--color-faint)] transition-transform", ctx?.open ? "rotate-180" : "")} aria-hidden />
    </button>
  );
}

export function ToolContent({ className, children }: { className?: string; children: ReactNode }) {
  const ctx = useContext(ToolContext);
  if (!ctx?.open) return null;
  return <div className={cn("space-y-3 px-3 py-3 text-[0.78125rem] text-[var(--color-muted)]", className)}>{children}</div>;
}

export function ToolInput({ input, className }: { input: unknown; className?: string }) {
  const json = displayJson(input);
  return (
    <div className={cn("space-y-1.5", className)}>
      <h4 className="atlas-mono text-[0.625rem] uppercase tracking-[0.08em] text-[var(--color-faint)]">Parameters</h4>
      <Markdown className="text-[0.75rem]">{fencedCode(json, "json")}</Markdown>
    </div>
  );
}

export function ToolOutput({ output, errorText, className }: { output?: ReactNode; errorText?: string; className?: string }) {
  if (output == null && !errorText) return null;
  return (
    <div className={cn("space-y-1.5", className)}>
      <h4 className="atlas-mono text-[0.625rem] uppercase tracking-[0.08em] text-[var(--color-faint)]">{errorText ? "Error" : "Result"}</h4>
      <div
        className={cn(
          "rounded-row px-2.5 py-2 text-[0.78125rem] leading-5",
          errorText
            ? "border border-[color-mix(in_oklch,var(--color-danger)_38%,transparent)] bg-[color-mix(in_oklch,var(--color-danger)_10%,transparent)] text-[var(--color-danger)]"
            : "border border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-ink)]"
        )}
      >
        {errorText || output}
      </div>
    </div>
  );
}

const HIDDEN_KEY = /(^|[-_])(api[-_]?key|authorization|cookie|password|secret|token)($|[-_])/i;

export function displayJson(value: unknown): string {
  const seen = new WeakSet<object>();
  const json = JSON.stringify(
    value,
    (key, entry) => {
      if (key === "providerMetadata" || HIDDEN_KEY.test(key)) return "[hidden]";
      if (typeof entry === "bigint") return entry.toString();
      if (entry && typeof entry === "object") {
        if (seen.has(entry)) return "[circular]";
        seen.add(entry);
      }
      return entry;
    },
    2
  );
  const text = json ?? String(value ?? "");
  return text.length > 24_000 ? `${text.slice(0, 24_000)}\n… output truncated` : text;
}

export function fencedCode(value: string, language: string): string {
  const longestRun = Math.max(2, ...Array.from(value.matchAll(/`+/g), (match) => match[0].length));
  const fence = "`".repeat(longestRun + 1);
  return `${fence}${language}\n${value}\n${fence}`;
}
