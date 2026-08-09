"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { ArchiveIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type ServerFormAction = (formData: FormData) => void | Promise<void>;
type MarqueeStyle = CSSProperties & {
  "--atlas-title-travel": string;
  "--atlas-title-duration": string;
};

export function ChatThreadRow({
  id,
  title,
  href,
  active,
  secondary,
  archiveAction,
  activeChatId,
  archiveDisabled = false,
}: {
  id: string;
  title: string;
  href: string;
  active: boolean;
  secondary?: string;
  archiveAction: ServerFormAction;
  activeChatId: string;
  archiveDisabled?: boolean;
}) {
  return (
    <li className={cn("group/thread flex min-h-11 items-stretch rounded-row transition", active ? "bg-[var(--color-surface-muted)]" : "hover:bg-[var(--color-surface-muted)] focus-within:bg-[var(--color-surface-muted)]")}>
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        title={title}
        className="min-w-0 flex-1 px-2.5 py-2.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-accent-strong)]"
      >
        <ScrollingTitle title={title} active={active} />
        {secondary ? <span className="mt-1 block text-[0.65625rem] text-[var(--color-faint)]">{secondary}</span> : null}
      </Link>
      <form action={archiveAction} className="flex w-9 shrink-0 items-center justify-center">
        <input type="hidden" name="chatId" value={id} />
        <input type="hidden" name="activeChatId" value={activeChatId} />
        <button
          type="submit"
          disabled={archiveDisabled}
          aria-label={`Archive ${title}`}
          title="Archive chat"
          className="inline-flex size-7 items-center justify-center rounded-control text-[var(--color-faint)] opacity-100 transition hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-30 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-accent-strong)] md:opacity-0 md:group-hover/thread:opacity-100 md:group-focus-within/thread:opacity-100"
        >
          <ArchiveIcon size={13} aria-hidden />
        </button>
      </form>
    </li>
  );
}

function ScrollingTitle({ title, active }: { title: string; active: boolean }) {
  const viewportRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [travel, setTravel] = useState(0);

  useEffect(() => {
    const viewport = viewportRef.current;
    const text = textRef.current;
    if (!viewport || !text) return;
    const measure = () => setTravel(Math.max(0, Math.ceil(text.scrollWidth - viewport.clientWidth)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(text);
    return () => observer.disconnect();
  }, [title]);

  const style: MarqueeStyle = {
    "--atlas-title-travel": `${travel}px`,
    "--atlas-title-duration": `${Math.min(14, Math.max(4, travel / 24 + 2.5))}s`,
  };

  return (
    <span ref={viewportRef} className="block min-w-0 overflow-hidden">
      <span
        ref={textRef}
        data-overflow={travel > 0 ? "true" : "false"}
        style={style}
        className={cn("atlas-thread-title block w-max min-w-full whitespace-nowrap text-[0.78125rem]", active ? "font-medium text-[var(--color-ink)]" : "text-[var(--color-muted)]")}
      >
        {title}
      </span>
    </span>
  );
}
