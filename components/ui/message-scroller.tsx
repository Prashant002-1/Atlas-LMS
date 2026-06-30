"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * MessageScroller (shadcn chat components, June 2026).
 *
 * The scroll container for a conversation. It owns the behaviour that is easy
 * to get wrong - auto-follow while pinned to the bottom, position preservation
 * when the reader scrolls up, and a jump-to-latest control - without owning the
 * messages, transport, or model state. You bring the content renderer.
 *
 * This is a faithful, dependency-free implementation of the documented API
 * (Provider / MessageScroller / Viewport / Content / Button), API-compatible
 * with the registry component so it can be swapped in later.
 */

type ScrollerContext = {
  viewportRef: RefObject<HTMLDivElement | null>;
  atBottom: boolean;
  setAtBottom: (value: boolean) => void;
  scrollToBottom: (behavior?: ScrollBehavior) => void;
};

const Context = createContext<ScrollerContext | null>(null);

function useScroller() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("MessageScroller parts must render inside <MessageScrollerProvider>.");
  return ctx;
}

export function MessageScrollerProvider({ children }: { children: ReactNode }) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [atBottom, setAtBottom] = useState(true);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = viewportRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  return (
    <Context.Provider value={{ viewportRef, atBottom, setAtBottom, scrollToBottom }}>
      {children}
    </Context.Provider>
  );
}

export function MessageScroller({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("relative flex min-h-0 flex-1 flex-col", className)}>{children}</div>;
}

const BOTTOM_THRESHOLD = 28;

export function MessageScrollerViewport({ children, className }: { children: ReactNode; className?: string }) {
  const { viewportRef, setAtBottom } = useScroller();
  const innerRef = useRef<HTMLDivElement | null>(null);
  const atBottomRef = useRef(true);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const measure = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      const next = distance <= BOTTOM_THRESHOLD;
      atBottomRef.current = next;
      setAtBottom(next);
    };

    measure();
    el.addEventListener("scroll", measure, { passive: true });

    // Auto-follow: when content grows and the reader is already pinned to the
    // bottom, keep the latest in view. If they have scrolled up, leave them be.
    const inner = innerRef.current;
    const observer = inner
      ? new ResizeObserver(() => {
          if (atBottomRef.current) el.scrollTo({ top: el.scrollHeight });
        })
      : null;
    if (inner && observer) observer.observe(inner);

    return () => {
      el.removeEventListener("scroll", measure);
      observer?.disconnect();
    };
  }, [viewportRef, setAtBottom]);

  return (
    <div ref={viewportRef} className={cn("min-h-0 flex-1 overflow-y-auto", className)}>
      <div ref={innerRef}>{children}</div>
    </div>
  );
}

export function MessageScrollerContent({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div role="log" aria-relevant="additions" aria-live="polite" className={className}>
      {children}
    </div>
  );
}

export function MessageScrollerButton({
  className,
  label = "Jump to latest",
}: {
  className?: string;
  label?: string;
}) {
  const { atBottom, scrollToBottom } = useScroller();
  if (atBottom) return null;
  return (
    <button
      type="button"
      onClick={() => scrollToBottom("smooth")}
      className={cn(
        "absolute bottom-4 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-1.5 text-[12px] font-medium text-[var(--color-muted)] shadow-[var(--shadow-floating)] transition hover:text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)]",
        className
      )}
    >
      <ArrowDown size={13} strokeWidth={2} aria-hidden />
      {label}
    </button>
  );
}
