"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { setCourseScope, setTermScope } from "@/lib/workspace/scope-actions";

/**
 * The overview header is the course in view, so it is also where you change
 * it: the eyebrow and the course name render exactly as a page header does,
 * and clicking the name opens one menu with every course and, below a
 * hairline, every term. Items are plain submit buttons into the scope
 * actions, current choices checked.
 */

export type SwitchCourse = { id: string; code: string; name: string };
export type SwitchTerm = { slug: string; name: string };

export function CourseSwitch({
  courses,
  activeCourseId,
  terms,
  activeTermSlug,
  returnTo,
}: {
  courses: SwitchCourse[];
  activeCourseId: string;
  terms: SwitchTerm[];
  activeTermSlug: string;
  returnTo: string;
}) {
  const [open, setOpen] = useState(false);

  const activeCourse = courses.find((c) => c.id === activeCourseId) ?? courses[0];
  const activeTerm = terms.find((t) => t.slug === activeTermSlug) ?? terms[0];
  if (!activeCourse) return null;

  return (
    <div className="relative min-w-0">
      {open ? (
        <button type="button" aria-hidden tabIndex={-1} className="fixed inset-0 z-30 cursor-default" onClick={() => setOpen(false)} />
      ) : null}

      <p className="atlas-mono text-[0.6875rem] uppercase tracking-[0.1em] text-[var(--color-faint)]">
        {activeCourse.code}
        {activeTerm ? ` / ${activeTerm.name}` : ""}
      </p>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="group/switch mt-1.5 flex max-w-full items-center gap-2 rounded-row text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-accent-strong)]"
      >
        <span className="atlas-serif min-w-0 truncate text-[1.5rem] font-semibold leading-7 text-[var(--color-ink)]">
          {activeCourse.name}
        </span>
        <ChevronDown
          size={16}
          strokeWidth={2}
          aria-hidden
          className={`shrink-0 text-[var(--color-faint)] transition group-hover/switch:text-[var(--color-ink)] ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute left-0 top-full z-40 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)] p-1 shadow-[var(--shadow-floating)]"
        >
          <form action={setCourseScope}>
            <input type="hidden" name="returnTo" value={returnTo} />
            {courses.map((course) => {
              const current = course.id === activeCourse.id;
              return (
                <button
                  key={course.id}
                  type="submit"
                  name="course"
                  value={course.id}
                  role="menuitemradio"
                  aria-checked={current}
                  className="flex w-full items-center gap-2.5 rounded-row px-2.5 py-2 text-left transition hover:bg-[var(--color-surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-accent-strong)]"
                >
                  <span className="atlas-mono shrink-0 text-[0.65625rem] uppercase tracking-[0.06em] text-[var(--color-faint)]">
                    {course.code}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-medium text-[var(--color-ink)]">
                    {course.name}
                  </span>
                  {current ? (
                    <Check size={13} strokeWidth={2} aria-hidden className="shrink-0 text-[var(--color-accent-strong)]" />
                  ) : null}
                </button>
              );
            })}
          </form>

          {terms.length > 0 ? (
            <>
              <div className="mx-1 my-1 h-px bg-[var(--color-border)]" aria-hidden />
              <form action={setTermScope}>
                <input type="hidden" name="returnTo" value={returnTo} />
                {terms.map((term) => {
                  const current = term.slug === activeTerm?.slug;
                  return (
                    <button
                      key={term.slug}
                      type="submit"
                      name="term"
                      value={term.slug}
                      role="menuitemradio"
                      aria-checked={current}
                      className="flex w-full items-center gap-2.5 rounded-row px-2.5 py-1.5 text-left transition hover:bg-[var(--color-surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-accent-strong)]"
                    >
                      <span className="min-w-0 flex-1 truncate text-[0.75rem] font-medium text-[var(--color-muted)]">
                        {term.name}
                      </span>
                      {current ? (
                        <Check size={13} strokeWidth={2} aria-hidden className="shrink-0 text-[var(--color-accent-strong)]" />
                      ) : null}
                    </button>
                  );
                })}
              </form>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
