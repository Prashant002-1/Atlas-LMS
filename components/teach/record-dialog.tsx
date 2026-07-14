"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Pencil, Plus, X } from "lucide-react";

export function RecordDialog({
  mode,
  triggerLabel,
  title,
  description,
  children,
  triggerVariant = "secondary",
  defaultOpen = false,
}: {
  mode: "create" | "edit";
  triggerLabel: string;
  title: string;
  description?: string;
  children: ReactNode;
  triggerVariant?: "primary" | "secondary" | "quiet";
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const Icon = mode === "create" ? Plus : Pencil;
  const triggerTone = {
    primary: "border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-bg)] hover:border-[var(--color-accent-strong)] hover:bg-[var(--color-accent-strong)]",
    secondary: "border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:border-[var(--color-ink)]",
    quiet: "border-transparent bg-transparent text-[var(--color-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]",
  }[triggerVariant];

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex min-h-9 items-center gap-2 rounded-control border px-3 text-[0.8125rem] font-medium transition active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)] ${triggerTone}`}
      >
        <Icon size={14} strokeWidth={2} aria-hidden />
        {triggerLabel}
      </button>

      {open ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8">
          <button
            type="button"
            aria-label="Close dialog"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="record-dialog-title"
            className="relative z-10 flex max-h-[calc(100vh-3rem)] w-full max-w-2xl flex-col overflow-hidden rounded-panel border border-[var(--color-border-strong)] bg-[var(--color-surface)] shadow-[var(--shadow-floating)]"
          >
            <header className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] px-5 py-4">
              <div>
                <h2 id="record-dialog-title" className="text-[1rem] font-semibold text-[var(--color-ink)]">{title}</h2>
                {description ? <p className="mt-1 max-w-xl text-[0.75rem] leading-5 text-[var(--color-muted)]">{description}</p> : null}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-control text-[var(--color-muted)] transition hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)]"
              >
                <X size={15} strokeWidth={2} aria-hidden />
              </button>
            </header>
            <div className="overflow-y-auto p-5">{children}</div>
          </section>
        </div>
      ) : null}
    </>
  );
}
