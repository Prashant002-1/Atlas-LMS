"use client";

import { useEffect, useState } from "react";
import type { UIMessage } from "ai";
import { cn } from "@/lib/utils";
import { Shimmer } from "@/components/ai-elements/shimmer";

type LoosePart = { type?: unknown; text?: unknown } & Record<string, unknown>;

export type PromptCheckpoint = { id: string; label: string };

export function messageHasVisibleOutput(message: UIMessage | undefined): boolean {
  if (!message || message.role !== "assistant") return false;
  return (message.parts as LoosePart[]).some((part) => {
    const type = String(part.type ?? "");
    if (type === "text") return typeof part.text === "string" && part.text.trim().length > 0;
    if (type === "step-start" || type === "data-atlas-ref" || type === "data-planning-ref" || type === "data-run-context") return false;
    return type === "reasoning"
      || type === "file"
      || type === "reasoning-file"
      || type === "source-url"
      || type === "source-document"
      || type === "custom"
      || type === "dynamic-tool"
      || type.startsWith("tool-")
      || type.startsWith("data-");
  });
}

export function ThinkingIndicator({ label }: { label: string }) {
  const activity = sentenceCaseActivity(label);
  return (
    <div className="flex min-h-10 items-center py-1" role="status" aria-live="polite">
      <Shimmer as="span" duration={1.6} spread={1.5} className="text-[0.78125rem] font-medium">{activity}</Shimmer>
    </div>
  );
}

export function sentenceCaseActivity(label: string): string {
  const activity = label.trim();
  if (!activity) return "Working";
  return activity.charAt(0).toLocaleUpperCase("en-US") + activity.slice(1);
}

export function promptAnchorId(messageId: string) {
  return `atlas-prompt-${encodeURIComponent(messageId)}`;
}

export function promptCheckpointLabel(message: UIMessage, index: number) {
  const text = (message.parts as LoosePart[])
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => String(part.text))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  const excerpt = text.length > 72 ? `${text.slice(0, 69)}...` : text;
  return excerpt || `Prompt ${index + 1}`;
}

export function PromptCheckpointRail({ checkpoints }: { checkpoints: PromptCheckpoint[] }) {
  const checkpointKey = checkpoints.map((checkpoint) => checkpoint.id).join("\u001f");
  const [activeId, setActiveId] = useState<string | null>(() => checkpoints.at(-1)?.id ?? null);

  useEffect(() => {
    const ids = checkpointKey ? checkpointKey.split("\u001f") : [];
    const anchors = ids.flatMap((id) => {
      const element = document.getElementById(promptAnchorId(id));
      return element ? [{ id, element }] : [];
    });
    const scrollRoot = anchors[0]?.element.closest('[role="log"]') as HTMLElement | null;
    if (!scrollRoot || anchors.length === 0) return;

    const measure = () => {
      const rootTop = scrollRoot.getBoundingClientRect().top;
      const threshold = rootTop + Math.min(120, scrollRoot.clientHeight * 0.2);
      const atBottom = scrollRoot.scrollHeight - scrollRoot.scrollTop - scrollRoot.clientHeight <= 32;
      let nextId = anchors[0].id;
      for (const anchor of anchors) {
        if (anchor.element.getBoundingClientRect().top <= threshold) nextId = anchor.id;
        else break;
      }
      if (atBottom) nextId = anchors.at(-1)?.id ?? nextId;
      setActiveId((current) => current === nextId ? current : nextId);
    };

    const frame = requestAnimationFrame(measure);
    scrollRoot.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(frame);
      scrollRoot.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [checkpointKey]);

  const jumpToPrompt = (id: string) => {
    const prompt = document.getElementById(promptAnchorId(id));
    if (!prompt) return;
    setActiveId(id);
    prompt.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    });
  };

  return (
    <nav aria-label="Prompt checkpoints" className="pointer-events-none absolute inset-y-0 left-1.5 z-10 hidden items-center md:flex">
      <ol className="pointer-events-auto flex max-h-[76%] flex-col py-2">
        {checkpoints.map((checkpoint, index) => {
          const active = checkpoint.id === activeId;
          const tooltipId = `${promptAnchorId(checkpoint.id)}-tooltip`;
          return (
            <li key={checkpoint.id} className="relative">
              <button
                type="button"
                onClick={() => jumpToPrompt(checkpoint.id)}
                aria-label={`Jump to prompt ${index + 1}`}
                aria-describedby={tooltipId}
                aria-current={active ? "location" : undefined}
                className="group/checkpoint flex h-4 w-5 items-center rounded-row focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-accent-strong)]"
              >
                <span className={cn("h-0.5 w-2 rounded-full bg-[var(--color-border-strong)] opacity-60 transition-[width,background-color,opacity] group-hover/checkpoint:w-2.5 group-hover/checkpoint:bg-[var(--color-muted)] group-hover/checkpoint:opacity-100", active && "w-2.5 bg-[var(--color-muted)] opacity-90")} aria-hidden />
                <span id={tooltipId} role="tooltip" className="pointer-events-none absolute left-full top-1/2 z-20 ml-1.5 w-max max-w-[18rem] -translate-y-1/2 rounded-control border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-left text-[0.6875rem] font-normal leading-4 text-[var(--color-muted)] opacity-0 shadow-[var(--shadow-floating)] transition-opacity delay-150 group-hover/checkpoint:opacity-100 group-focus-visible/checkpoint:opacity-100">
                  {checkpoint.label}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
