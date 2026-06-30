"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { ChevronDownIcon, SearchIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Task (AI SDK Elements). A collapsible trace of what the agent did, defaulting
 * open. Faithful to the registry API (Task / TaskTrigger / TaskContent /
 * TaskItem) on Atlas tokens, with a self-contained collapsible.
 */
const TaskContext = createContext<{ open: boolean; setOpen: (v: boolean) => void } | null>(null);

export function Task({ defaultOpen = true, className, children }: { defaultOpen?: boolean; className?: string; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <TaskContext.Provider value={{ open, setOpen }}>
      <div className={cn(className)}>{children}</div>
    </TaskContext.Provider>
  );
}

export function TaskTrigger({ title, className }: { title: string; className?: string }) {
  const ctx = useContext(TaskContext);
  return (
    <button
      type="button"
      onClick={() => ctx?.setOpen(!ctx.open)}
      className={cn("flex w-full cursor-pointer items-center gap-2 text-[13px] text-[var(--color-muted)] transition-colors hover:text-[var(--color-ink)]", className)}
    >
      <SearchIcon className="size-3.5 shrink-0" aria-hidden />
      <span className="min-w-0 truncate">{title}</span>
      <ChevronDownIcon className={cn("ml-auto size-4 shrink-0 transition-transform", ctx?.open ? "rotate-180" : "")} aria-hidden />
    </button>
  );
}

export function TaskContent({ className, children }: { className?: string; children: ReactNode }) {
  const ctx = useContext(TaskContext);
  if (!ctx?.open) return null;
  return <div className={cn("mt-3 space-y-2 border-l-2 border-[var(--color-border)] pl-4", className)}>{children}</div>;
}

export function TaskItem({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("text-[12.5px] leading-5 text-[var(--color-muted)]", className)}>{children}</div>;
}
