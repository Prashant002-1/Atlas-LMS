import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Message (AI SDK Elements). One row in the thread, aligned by author. The
 * user variant gets a soft bubble (right-aligned); the assistant variant runs
 * full width so tools, blocks, and prose can breathe. Faithful to the registry
 * API (Message + MessageContent), on Atlas tokens.
 */
export function Message({
  from,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { from: "user" | "assistant" | "system" }) {
  return (
    <div
      className={cn(
        "group flex w-full max-w-[95%] flex-col gap-2",
        from === "user" ? "is-user ml-auto items-end" : "is-assistant",
        className
      )}
      {...props}
    />
  );
}

export function MessageContent({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex w-fit min-w-0 max-w-full flex-col gap-3 overflow-hidden text-[0.875rem] leading-6",
        "group-[.is-user]:ml-auto group-[.is-user]:rounded-panel group-[.is-user]:bg-[var(--color-indigo-soft)] group-[.is-user]:px-3.5 group-[.is-user]:py-2.5 group-[.is-user]:text-[var(--color-ink)]",
        "group-[.is-assistant]:w-full group-[.is-assistant]:text-[var(--color-ink)]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function MessageTimestamp({ createdAt }: { createdAt?: string }) {
  if (!createdAt) return null;
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return null;
  const label = date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <time
      dateTime={date.toISOString()}
      className={cn(
        "min-h-4 text-[0.625rem] leading-4 text-[var(--color-faint)] opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100",
        "group-[.is-user]:text-right group-[.is-assistant]:text-left"
      )}
    >
      {label}
    </time>
  );
}
