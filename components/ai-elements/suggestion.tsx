"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Suggestion (AI SDK Elements). Quick-reply chips. Faithful to the registry API
 * (Suggestions wrapper + Suggestion button) on Atlas tokens; uses flex-wrap
 * instead of a ScrollArea so it needs no extra primitive.
 */
export function Suggestions({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("flex flex-wrap items-center gap-2", className)}>{children}</div>;
}

export function Suggestion({
  suggestion,
  onClick,
  className,
  children,
}: {
  suggestion: string;
  onClick?: (suggestion: string) => void;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick?.(suggestion)}
      className={cn(
        "cursor-pointer rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-1.5 text-[12.5px] font-medium text-[var(--color-muted)] transition hover:border-[var(--color-border-strong)] hover:text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)]",
        className
      )}
    >
      {children || suggestion}
    </button>
  );
}
