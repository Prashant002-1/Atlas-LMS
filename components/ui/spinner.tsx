import { Loader2Icon, type LucideProps } from "lucide-react";
import { cn } from "@/lib/utils";

/** shadcn Spinner used by AI Elements submitted and tool-waiting states. */
export function Spinner({ className, ...props }: LucideProps) {
  return <Loader2Icon aria-label="Loading" className={cn("animate-spin", className)} {...props} />;
}
