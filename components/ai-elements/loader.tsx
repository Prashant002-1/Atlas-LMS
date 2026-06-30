import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Loader (AI SDK Elements). A spinner for live agent status - "Reading the
 * course record", running a tool, waiting on a stream.
 */
export function Loader({ size = 15, className }: { size?: number; className?: string }) {
  return <Loader2 size={size} strokeWidth={2} aria-label="Loading" className={cn("animate-spin text-[var(--color-accent-strong)]", className)} />;
}
