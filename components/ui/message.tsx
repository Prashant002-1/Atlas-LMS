import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Message (shadcn chat components, June 2026). Lays out one row in the
 * conversation: avatar, alignment, and content. Compose with Bubble, Marker,
 * and arbitrary content (Atlas renders typed blocks inside the content slot).
 */
export function Message({
  from = "assistant",
  className,
  children,
}: {
  from?: "user" | "assistant" | "system";
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      data-from={from}
      className={cn("flex w-full gap-3", from === "user" ? "justify-end" : "justify-start", className)}
    >
      {children}
    </div>
  );
}

export function MessageAvatar({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-accent-strong)]",
        className
      )}
    >
      {children}
    </span>
  );
}

export function MessageContent({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("min-w-0 flex-1 space-y-3", className)}>{children}</div>;
}
