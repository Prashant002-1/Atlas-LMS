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
import { ArrowDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Conversation (AI SDK Elements). The scroll container for an agent thread:
 * auto-follows while pinned to the bottom, preserves position when the reader
 * scrolls up, and reveals a scroll-to-bottom control otherwise.
 *
 * Dependency-free implementation of the documented API (Conversation /
 * ConversationContent / ConversationScrollButton / ConversationEmptyState),
 * so the registry component (which uses use-stick-to-bottom) drops in 1:1.
 */

type ConversationCtx = {
  scrollRef: RefObject<HTMLDivElement | null>;
  contentRef: RefObject<HTMLDivElement | null>;
  atBottom: boolean;
  scrollToBottom: (behavior?: ScrollBehavior) => void;
};

const Context = createContext<ConversationCtx | null>(null);

function useConversation() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("Conversation parts must render inside <Conversation>.");
  return ctx;
}

export function Conversation({ className, children }: { className?: string; children: ReactNode }) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const atBottomRef = useRef(true);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      const next = distance <= 28;
      atBottomRef.current = next;
      setAtBottom(next);
    };
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const content = contentRef.current;
    const observer = content
      ? new ResizeObserver(() => {
          if (atBottomRef.current) el.scrollTo({ top: el.scrollHeight });
        })
      : null;
    if (content && observer) observer.observe(content);
    return () => {
      el.removeEventListener("scroll", measure);
      observer?.disconnect();
    };
  }, []);

  return (
    <Context.Provider value={{ scrollRef, contentRef, atBottom, scrollToBottom }}>
      <div ref={scrollRef} role="log" aria-relevant="additions" className={cn("relative flex min-h-0 flex-1 flex-col overflow-y-auto", className)}>
        {children}
      </div>
    </Context.Provider>
  );
}

export function ConversationContent({ className, children }: { className?: string; children: ReactNode }) {
  const { contentRef } = useConversation();
  return (
    <div ref={contentRef} className={cn("flex flex-col gap-5 p-5", className)}>
      {children}
    </div>
  );
}

export function ConversationEmptyState({
  className,
  title = "No messages yet",
  description = "Start a conversation to see messages here",
  icon,
  children,
}: {
  className?: string;
  title?: string;
  description?: string;
  icon?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className={cn("flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center", className)}>
      {children ?? (
        <>
          {icon ? <div className="text-[var(--color-faint)]">{icon}</div> : null}
          <div className="space-y-1">
            <h3 className="text-[14px] font-medium text-[var(--color-ink)]">{title}</h3>
            {description ? <p className="text-[13px] text-[var(--color-muted)]">{description}</p> : null}
          </div>
        </>
      )}
    </div>
  );
}

export function ConversationScrollButton({ className, label = "Scroll to latest" }: { className?: string; label?: string }) {
  const { atBottom, scrollToBottom } = useConversation();
  if (atBottom) return null;
  return (
    <div className="pointer-events-none sticky bottom-4 z-10 flex justify-center">
      <button
        type="button"
        onClick={() => scrollToBottom("smooth")}
        aria-label={label}
        className={cn(
          "pointer-events-auto inline-flex items-center gap-1.5 rounded-row border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-1.5 text-[12px] font-medium text-[var(--color-muted)] shadow-[var(--shadow-floating)] transition hover:text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)]",
          className
        )}
      >
        <ArrowDownIcon size={13} strokeWidth={2} aria-hidden />
        {label}
      </button>
    </div>
  );
}
