"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { setCourseScope } from "@/lib/workspace/scope-actions";
import { shortTermLabel } from "@/lib/workspace/term-label";

/**
 * The course in view, and the one control that changes it.
 *
 * You select a course, not two things. The old menu listed courses and then
 * terms as two parallel choices, which made the term look like a second thing
 * to pick and left the reader wondering what happens if the pair disagrees.
 * A term is a container: it groups the courses. So the menu groups by term and
 * every item is a course, and picking a course in another term moves the term
 * with it.
 *
 * Selection is shown by weight and a rule, not a checkmark. A tick beside the
 * current course reads as a completed action rather than a current state, and
 * it was doubly misleading when two ticks appeared at once.
 *
 * The eyebrow is the scope, abbreviated: SU '26 / ECON-241, term outside and
 * course inside, so the code stays where the eye lands.
 */

export type SwitchCourse = { id: string; code: string; name: string; termName?: string | null };
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

  const activeCourse = courses.find((course) => course.id === activeCourseId) ?? courses[0];
  const activeTerm = terms.find((term) => term.slug === activeTermSlug) ?? terms[0];
  if (!activeCourse) return null;

  /*
   * One group per term, in the order the terms were given, with any course
   * whose term is unknown collected under the term in view. Groups appear only
   * when there is more than one, so a single-term install shows a plain list.
   */
  const groups = groupCoursesByTerm(courses, terms, activeTerm?.name ?? null);
  const showTermHeadings = groups.length > 1;
  const scope = [shortTermLabel(activeTerm?.name), activeCourse.code].filter(Boolean).join(" / ");

  return (
    <div className="relative min-w-0">
      {open ? (
        <button type="button" aria-hidden tabIndex={-1} className="fixed inset-0 z-30 cursor-default" onClick={() => setOpen(false)} />
      ) : null}

      <p className="atlas-mono text-[0.6875rem] uppercase tracking-[0.1em] text-[var(--color-faint)]">{scope}</p>
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
            {groups.map((group, groupIndex) => (
              <div key={group.termName ?? `group-${groupIndex}`} className={groupIndex > 0 ? "mt-1 border-t border-[var(--color-border)] pt-1" : undefined}>
                {showTermHeadings ? (
                  <p className="px-2.5 pb-1 pt-1.5 text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-[var(--color-faint)]">
                    {group.termName}
                  </p>
                ) : null}
                {group.courses.map((course) => {
                  const current = course.id === activeCourse.id;
                  return (
                    <button
                      key={course.id}
                      type="submit"
                      name="course"
                      value={course.id}
                      role="menuitemradio"
                      aria-checked={current}
                      /*
                       * Current state is a left rule plus weight. No icon: a
                       * checkmark reads as "done", not as "you are here".
                       */
                      className={`flex w-full items-center gap-2.5 border-l-2 py-2 pl-2 pr-2.5 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-accent-strong)] ${
                        current
                          ? "border-[var(--color-accent-strong)] bg-[var(--color-indigo-soft)]"
                          : "border-transparent hover:bg-[var(--color-surface-muted)]"
                      }`}
                    >
                      <span className="atlas-mono shrink-0 text-[0.65625rem] uppercase tracking-[0.06em] text-[var(--color-faint)]">
                        {course.code}
                      </span>
                      <span
                        className={`min-w-0 flex-1 truncate text-[0.8125rem] ${
                          current ? "font-semibold text-[var(--color-ink)]" : "font-medium text-[var(--color-muted)]"
                        }`}
                      >
                        {course.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </form>
        </div>
      ) : null}
    </div>
  );
}

type CourseGroup = { termName: string | null; courses: SwitchCourse[] };

/**
 * Group courses under their term. Terms with no courses are omitted, because
 * an empty heading invites a click that cannot do anything.
 */
function groupCoursesByTerm(
  courses: SwitchCourse[],
  terms: SwitchTerm[],
  activeTermName: string | null
): CourseGroup[] {
  const byTerm = new Map<string, SwitchCourse[]>();
  const order: string[] = [];

  const push = (termName: string, course: SwitchCourse) => {
    const list = byTerm.get(termName);
    if (list) list.push(course);
    else {
      byTerm.set(termName, [course]);
      order.push(termName);
    }
  };

  /* Seed the order from the term list so groups follow the registrar's order. */
  for (const term of terms) {
    if (courses.some((course) => (course.termName ?? activeTermName) === term.name)) {
      byTerm.set(term.name, []);
      order.push(term.name);
    }
  }
  for (const course of courses) push(course.termName ?? activeTermName ?? "", course);

  return order
    .map((termName) => ({ termName: termName || null, courses: byTerm.get(termName) ?? [] }))
    .filter((group) => group.courses.length > 0);
}
