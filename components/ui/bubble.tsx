import type { ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Bubble (shadcn chat components, June 2026). The message surface, with
 * variants and alignment. Atlas uses the user variant for typed commands and
 * leaves assistant narration to flow as plain prose under the Message row.
 */
const bubbleVariants = cva("w-fit max-w-[82%] whitespace-pre-wrap text-[14px] leading-6", {
  variants: {
    variant: {
      user: "rounded-[12px_12px_4px_12px] bg-[var(--color-indigo-soft)] px-3.5 py-2.5 text-[var(--color-ink)]",
      assistant: "rounded-[4px_12px_12px_12px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 text-[var(--color-ink)]",
      plain: "",
    },
  },
  defaultVariants: { variant: "assistant" },
});

export function Bubble({
  children,
  variant,
  className,
}: { children: ReactNode; className?: string } & VariantProps<typeof bubbleVariants>) {
  return <div className={cn(bubbleVariants({ variant }), className)}>{children}</div>;
}
