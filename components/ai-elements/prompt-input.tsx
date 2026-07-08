"use client";

import {
  type ButtonHTMLAttributes,
  type FormEvent,
  type FormEventHandler,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { ArrowUpIcon, Loader2Icon, SquareIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * PromptInput (AI SDK Elements). A composer: a bordered surface with an
 * auto-resizing textarea (Enter submits, Shift+Enter newlines) and a toolbar
 * holding tools and a status-aware submit/stop button. Faithful to the registry
 * API surface Atlas uses (PromptInput / PromptInputTextarea / PromptInputToolbar
 * / PromptInputTools / PromptInputButton / PromptInputSubmit) on Atlas tokens.
 */
export type PromptInputMessage = { text: string; files?: File[] };
export type ChatStatus = "submitted" | "streaming" | "ready" | "error";

export function PromptInput({
  className,
  onSubmit,
  children,
}: {
  className?: string;
  onSubmit: (message: PromptInputMessage, event: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
}) {
  const handleSubmit: FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    const text = String(new FormData(event.currentTarget).get("message") ?? "");
    onSubmit({ text, files: [] }, event);
  };
  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "flex flex-col rounded-[12px] border border-[var(--color-border-strong)] bg-[var(--color-surface)] shadow-[var(--shadow-panel)] transition focus-within:border-[var(--color-accent-strong)]",
        className
      )}
    >
      {children}
    </form>
  );
}

export function PromptInputTextarea({
  className,
  name = "message",
  onChange,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      name={name}
      rows={1}
      onChange={(event) => {
        const el = event.currentTarget;
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
        onChange?.(event);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          event.currentTarget.form?.requestSubmit();
        }
      }}
      className={cn(
        "max-h-[200px] w-full resize-none bg-transparent px-3.5 pt-3 pb-1 text-[14px] leading-6 text-[var(--color-ink)] outline-none placeholder:text-[var(--color-faint)] disabled:opacity-60",
        className
      )}
      {...props}
    />
  );
}

export function PromptInputToolbar({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("flex items-center justify-between gap-2 px-2 pb-2", className)}>{children}</div>;
}

export function PromptInputTools({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("flex items-center gap-1", className)}>{children}</div>;
}

export function PromptInputButton({ className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-[8px] px-2.5 text-[12.5px] font-medium text-[var(--color-muted)] transition hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function PromptInputSubmit({
  status = "ready",
  disabled,
  className,
}: {
  status?: ChatStatus;
  disabled?: boolean;
  className?: string;
}) {
  const busy = status === "streaming" || status === "submitted";
  return (
    <button
      type="submit"
      disabled={disabled && !busy}
      aria-label={busy ? "Stop" : "Send"}
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-[8px] border border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-bg)] transition hover:border-[var(--color-accent-strong)] hover:bg-[var(--color-accent-strong)] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)]",
        className
      )}
    >
      {status === "submitted" ? (
        <Loader2Icon className="size-4 animate-spin" aria-hidden />
      ) : busy ? (
        <SquareIcon className="size-3.5" aria-hidden />
      ) : (
        <ArrowUpIcon className="size-4" strokeWidth={2.2} aria-hidden />
      )}
    </button>
  );
}
