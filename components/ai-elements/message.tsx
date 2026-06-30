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
        "flex w-fit min-w-0 max-w-full flex-col gap-3 overflow-hidden text-[14px] leading-6",
        "group-[.is-user]:ml-auto group-[.is-user]:rounded-[12px] group-[.is-user]:bg-[var(--color-indigo-soft)] group-[.is-user]:px-3.5 group-[.is-user]:py-2.5 group-[.is-user]:text-[var(--color-ink)]",
        "group-[.is-assistant]:w-full group-[.is-assistant]:text-[var(--color-ink)]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
