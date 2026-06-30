import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Shimmer (shadcn chat components, June 2026). A text shimmer for live status -
 * "Thinking...", running tools, streaming markers. The animation lives in the
 * .atlas-shimmer scope in globals.css and is disabled under reduced-motion.
 */
export function Shimmer({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("atlas-shimmer", className)}>{children}</span>;
}
