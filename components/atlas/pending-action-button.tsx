"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PendingActionButton({
  children,
  pendingLabel,
  className,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      aria-busy={pending}
      disabled={disabled || pending}
      className={cn("transition-[color,background-color,border-color,opacity,transform] active:translate-y-px disabled:cursor-wait disabled:opacity-65", className)}
      {...props}
    >
      {pending ? <><Loader2 size={13} className="animate-spin" aria-hidden />{pendingLabel}</> : children}
    </button>
  );
}
