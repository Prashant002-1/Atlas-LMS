import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Marker (shadcn chat components, June 2026). A status update / system note /
 * labeled separator for streaming state, tool activity, and breaks. Atlas uses
 * it for the "worked from the record" note and the live reading state.
 */
export function Marker({
  children,
  icon,
  className,
}: {
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2 text-[12px] text-[var(--color-muted)]", className)}>
      {icon ? <span className="grid shrink-0 place-items-center">{icon}</span> : null}
      <span className="min-w-0">{children}</span>
    </div>
  );
}
