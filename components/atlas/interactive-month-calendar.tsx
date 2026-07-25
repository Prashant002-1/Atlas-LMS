"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { addDays, dayKey, sameDay, type MonthEntry } from "@/components/atlas/month-calendar";

const MAX_VISIBLE_DAY_ENTRIES = 3;

const DOT_TONE: Record<MonthEntry["tone"], string> = {
  accent: "bg-[var(--color-accent)]",
  outline: "border border-[var(--color-faint)] bg-transparent",
  danger: "bg-[var(--color-danger)]",
  faint: "bg-[var(--color-faint)]",
};

/** A selectable month grid with the complete record for the chosen day below it. */
export function InteractiveMonthCalendar({
  year,
  month,
  today,
  entries,
}: {
  year: number;
  month: number;
  today: Date;
  entries: MonthEntry[];
}) {
  const monthStart = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weeks = Math.ceil((monthStart.getDay() + daysInMonth) / 7);
  const gridStart = addDays(monthStart, -monthStart.getDay());
  const days = Array.from({ length: weeks * 7 }, (_, index) => addDays(gridStart, index));
  const detailsRef = useRef<HTMLElement>(null);

  const byDay = useMemo(() => {
    const grouped = new Map<string, MonthEntry[]>();
    for (const entry of entries) {
      const key = dayKey(entry.date);
      const bucket = grouped.get(key);
      if (bucket) bucket.push(entry);
      else grouped.set(key, [entry]);
    }
    return grouped;
  }, [entries]);

  const initialDay =
    today.getFullYear() === year && today.getMonth() === month
      ? today
      : entries.find((entry) => entry.date.getFullYear() === year && entry.date.getMonth() === month)?.date ?? monthStart;
  const [selectedKey, setSelectedKey] = useState(() => dayKey(initialDay));
  const selectedDay = days.find((day) => dayKey(day) === selectedKey) ?? initialDay;
  const selectedEntries = byDay.get(selectedKey) ?? [];

  function selectDay(key: string) {
    setSelectedKey(key);
    window.requestAnimationFrame(() => {
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      detailsRef.current?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "nearest" });
    });
  }

  return (
    <>
      <div className="overflow-hidden rounded-panel border border-[var(--color-border)] bg-[var(--color-border)] shadow-[var(--shadow-panel)]">
        <div className="grid grid-cols-7 gap-px">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((weekday) => (
            <div key={weekday} className="bg-[var(--color-surface)] px-2 py-1.5">
              <span className="atlas-mono text-[0.65625rem] uppercase tracking-[0.08em] text-[var(--color-faint)]">{weekday}</span>
            </div>
          ))}
          {days.map((day) => {
            const key = dayKey(day);
            const inMonth = day.getMonth() === month;
            const isToday = sameDay(day, today);
            const isSelected = key === selectedKey;
            const dayEntries = byDay.get(key) ?? [];
            const hiddenCount = Math.max(dayEntries.length - MAX_VISIBLE_DAY_ENTRIES, 0);
            const dayLabel = day.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

            return (
              <div
                key={key}
                data-selected={isSelected ? "true" : "false"}
                className={`min-h-[6.25rem] p-1.5 transition ${
                  isSelected
                    ? "bg-[var(--color-surface-muted)] shadow-[inset_0_0_0_1px_var(--color-accent)]"
                    : inMonth
                      ? "bg-[var(--color-surface)]"
                      : "bg-[var(--color-bg)]"
                }`}
              >
                <button
                  type="button"
                  data-calendar-day={key}
                  aria-controls="calendar-day-details"
                  aria-pressed={isSelected}
                  aria-label={`View ${dayLabel}, ${eventCountLabel(dayEntries.length)}`}
                  onClick={() => selectDay(key)}
                  className="flex w-full cursor-pointer items-center rounded-row text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)]"
                >
                  <span
                    aria-hidden
                    className={`atlas-mono inline-flex size-5 items-center justify-center rounded-row text-[0.6875rem] tabular-nums ${
                      isToday
                        ? "bg-[var(--color-accent)] font-semibold text-[var(--color-bg)]"
                        : isSelected
                          ? "font-semibold text-[var(--color-ink)]"
                          : inMonth
                            ? "text-[var(--color-muted)]"
                            : "text-[var(--color-faint)]"
                    }`}
                  >
                    {day.getDate()}
                  </span>
                </button>

                {dayEntries.length > 0 ? (
                  <div className="mt-1 space-y-0.5">
                    {dayEntries.slice(0, MAX_VISIBLE_DAY_ENTRIES).map((entry) => (
                      <Link
                        key={entry.id}
                        href={entry.href}
                        title={`${entry.code ? `${entry.code} ` : ""}${entry.title} · ${entry.fact}`}
                        className="group/chip flex items-center gap-1.5 rounded-row px-1 py-0.5 transition hover:bg-[var(--color-bg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-accent-strong)]"
                      >
                        <span aria-hidden className={`size-1.5 shrink-0 rounded-full ${DOT_TONE[entry.tone]}`} />
                        <span className="truncate text-[0.6875rem] font-medium text-[var(--color-muted)] transition group-hover/chip:text-[var(--color-ink)]">
                          {entry.title}
                        </span>
                      </Link>
                    ))}
                    {hiddenCount > 0 ? (
                      <button
                        type="button"
                        onClick={() => selectDay(key)}
                        className="flex w-full items-center gap-1.5 rounded-row px-1 py-0.5 text-left text-[0.6875rem] font-medium text-[var(--color-faint)] transition hover:bg-[var(--color-bg)] hover:text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-accent-strong)]"
                      >
                        <span aria-hidden className="size-1.5 shrink-0" />
                        <span>+{hiddenCount} more</span>
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <section
        ref={detailsRef}
        id="calendar-day-details"
        aria-labelledby="calendar-day-heading"
        aria-live="polite"
        className="mt-4 overflow-hidden rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-panel)]"
      >
        <div className="flex items-baseline justify-between gap-4 border-b border-[var(--color-border)] px-4 py-3">
          <h2 id="calendar-day-heading" className="text-[0.9375rem] font-semibold">
            {selectedDay.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </h2>
          <span className="atlas-mono shrink-0 text-[0.6875rem] text-[var(--color-faint)]">
            {eventCountLabel(selectedEntries.length)}
          </span>
        </div>

        {selectedEntries.length > 0 ? (
          <div className="divide-y divide-[var(--color-border)]">
            {selectedEntries.map((entry) => (
              <Link
                key={`${entry.id}-detail`}
                href={entry.href}
                className="group/row grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 transition hover:bg-[var(--color-surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-accent-strong)]"
              >
                <span className="flex min-w-0 items-start gap-2.5">
                  <span aria-hidden className={`mt-1.5 size-1.5 shrink-0 rounded-full ${DOT_TONE[entry.tone]}`} />
                  <span className="min-w-0">
                    <span className="block text-[0.84375rem] font-medium text-[var(--color-ink)]">{entry.title}</span>
                    <span
                      className={`mt-0.5 block text-[0.71875rem] ${
                        entry.tone === "danger" ? "font-medium text-[var(--color-danger)]" : "text-[var(--color-muted)]"
                      }`}
                    >
                      {[entry.code, entry.fact].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </span>
                <span className="atlas-mono shrink-0 text-[0.71875rem] tabular-nums text-[var(--color-faint)]">
                  {entry.date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="px-4 py-5 text-[0.8125rem] text-[var(--color-muted)]">No events</p>
        )}
      </section>
    </>
  );
}

function eventCountLabel(count: number): string {
  return `${count} ${count === 1 ? "event" : "events"}`;
}
