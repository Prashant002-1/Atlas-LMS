"use client";

import { useEffect, useState, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Message (AI SDK Elements). One row in the thread, aligned by author. The
 * user variant gets a soft bubble (right-aligned); the assistant variant runs
 * full width so tools, blocks, and prose can breathe. Faithful to the registry
 * API (Message + MessageContent), on Atlas tokens.
 */
export function Message({
  from,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { from: "user" | "assistant" | "system" }) {
  return (
    <div
      className={cn(
        "group flex w-full max-w-[95%] flex-col gap-2",
        from === "user" ? "is-user ml-auto items-end" : "is-assistant",
        className
      )}
      {...props}
    />
  );
}

export function MessageContent({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex w-fit min-w-0 max-w-full flex-col gap-3 overflow-hidden text-[0.875rem] leading-6",
        "group-[.is-user]:ml-auto group-[.is-user]:rounded-panel group-[.is-user]:bg-[var(--color-indigo-soft)] group-[.is-user]:px-3.5 group-[.is-user]:py-2.5 group-[.is-user]:text-[var(--color-ink)]",
        "group-[.is-assistant]:w-full group-[.is-assistant]:text-[var(--color-ink)]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
/** Past this, a time of day stops locating a message and the date does. */
const RELATIVE_WINDOW_MS = 6 * HOUR_MS;

/**
 * How long ago, at the precision that is actually useful. Inside six hours the
 * distance is what the reader wants; past that the distance stops meaning
 * anything and the wall clock takes over, dropping the date while the message
 * is still from today.
 */
export function messageTimestampLabel(date: Date, now: Date = new Date()): string {
  const elapsed = now.getTime() - date.getTime();

  if (elapsed >= 0 && elapsed < MINUTE_MS) return "Just now";
  if (elapsed >= 0 && elapsed < HOUR_MS) {
    const minutes = Math.floor(elapsed / MINUTE_MS);
    return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  }
  if (elapsed >= 0 && elapsed < RELATIVE_WINDOW_MS) {
    const hours = Math.floor(elapsed / HOUR_MS);
    return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  }

  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * The hover timestamp, held back until the message is finished.
 *
 * A clock beside half a written sentence reads as a completed thing and makes
 * the reader check whether the answer is done, so `pending` withholds the
 * stamp entirely while a response streams and reveals it when the response
 * lands. The reserved height keeps the reveal from shifting the thread.
 *
 * The label also refreshes on a slow interval while it is still relative,
 * because a "3 minutes ago" that never becomes "4 minutes ago" is worse than
 * no label. Once the message is past that window its text is fixed and the
 * interval is not started.
 */
export function MessageTimestamp({ createdAt, pending = false }: { createdAt?: string; pending?: boolean }) {
  const time = createdAt ? new Date(createdAt).getTime() : Number.NaN;
  const valid = Number.isFinite(time);

  /* Hold the row height so revealing the stamp never nudges the thread. */
  if (!valid || pending) return <span className="block min-h-4" aria-hidden />;

  return <LiveMessageTimestamp key={time} time={time} />;
}

function LiveMessageTimestamp({ time }: { time: number }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    /* Relative labels need refreshing; absolute ones never change. */
    if (Date.now() - time >= RELATIVE_WINDOW_MS) return;
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [time]);

  const date = new Date(time);
  const label = messageTimestampLabel(date, new Date(now));
  return (
    <time
      dateTime={date.toISOString()}
      title={date.toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })}
      className={cn(
        "min-h-4 text-[0.625rem] leading-4 text-[var(--color-faint)] opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100",
        "group-[.is-user]:text-right group-[.is-assistant]:text-left"
      )}
    >
      {label}
    </time>
  );
}
