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
        "flex flex-col rounded-panel border border-[var(--color-border-strong)] bg-[var(--color-surface)] shadow-[var(--shadow-panel)] transition focus-within:border-[var(--color-accent-strong)]",
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
        "max-h-[12.5rem] w-full resize-none bg-transparent px-3.5 pb-1 pt-3 text-[0.875rem] leading-6 text-[var(--color-ink)] outline-none placeholder:text-[var(--color-faint)] disabled:opacity-60",
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
        "inline-flex h-8 items-center gap-1.5 rounded-control px-2.5 text-[0.78125rem] font-medium text-[var(--color-muted)] transition hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-50",
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
  onStop,
  allowSubmitWhileBusy = false,
}: {
  status?: ChatStatus;
  disabled?: boolean;
  className?: string;
  onStop?: () => void;
  /** Keep the composer as a steering queue while the current run is active. */
  allowSubmitWhileBusy?: boolean;
}) {
  const busy = status === "streaming" || status === "submitted";
  const steering = busy && allowSubmitWhileBusy;
  return (
    <button
      type={busy && !steering ? "button" : "submit"}
      onClick={busy && !steering ? onStop : undefined}
      disabled={busy && !steering ? !onStop : disabled}
      aria-label={steering ? "Queue steering message" : busy ? (onStop ? "Stop" : "Generating") : "Send"}
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-control border border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-bg)] transition hover:border-[var(--color-accent-strong)] hover:bg-[var(--color-accent-strong)] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)]",
        className
      )}
    >
      {steering ? (
        <ArrowUpIcon className="size-4" strokeWidth={2.2} aria-hidden />
      ) : busy && onStop ? (
        <SquareIcon className="size-3.5" aria-hidden />
      ) : busy ? (
        <Loader2Icon className="size-4 animate-spin" aria-hidden />
      ) : (
        <ArrowUpIcon className="size-4" strokeWidth={2.2} aria-hidden />
      )}
    </button>
  );
}
