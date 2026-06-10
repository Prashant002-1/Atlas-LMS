"use client";

import { useRef } from "react";
import { setCourseScope, setTermScope } from "@/lib/workspace/scope-actions";
import type { WorkspaceScope } from "@/lib/workspace/scope";

/**
 * Semester + course pickers — quiet selects in the header. Choosing one submits
 * a server action that pins the scope cookie and reloads the record in view.
 */

const selectStyle =
  "min-h-9 max-w-44 cursor-pointer appearance-none truncate rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface)] py-0 pl-3 pr-7 text-[13px] font-medium text-[var(--color-muted)] transition hover:border-[var(--color-border-strong)] hover:text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)]";

const chevronBg = {
  backgroundImage:
    "url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6' fill='none'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23667085' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E\")",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 10px center",
} as const;

export function ScopePicker({ scope, returnTo }: { scope: WorkspaceScope; returnTo: string }) {
  const termFormRef = useRef<HTMLFormElement>(null);
  const courseFormRef = useRef<HTMLFormElement>(null);

  if (scope.terms.length === 0) return null;

  return (
    <div className="hidden items-center gap-2 md:flex">
      {scope.courses.length > 1 ? (
        <form ref={courseFormRef} action={setCourseScope}>
          <input type="hidden" name="returnTo" value={returnTo} />
          <label className="sr-only" htmlFor="scope-course">
            Course
          </label>
          <select
            id="scope-course"
            name="course"
            value={scope.course?.id ?? ""}
            onChange={() => courseFormRef.current?.requestSubmit()}
            className={selectStyle}
            style={chevronBg}
          >
            {scope.courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.code} — {course.name}
              </option>
            ))}
          </select>
        </form>
      ) : null}

      <form ref={termFormRef} action={setTermScope}>
        <input type="hidden" name="returnTo" value={returnTo} />
        <label className="sr-only" htmlFor="scope-term">
          Semester
        </label>
        <select
          id="scope-term"
          name="term"
          value={scope.term?.slug ?? ""}
          onChange={() => termFormRef.current?.requestSubmit()}
          className={selectStyle}
          style={chevronBg}
        >
          {scope.terms.map((term) => (
            <option key={term.slug} value={term.slug}>
              {term.name}
              {term.current ? " · now" : ""}
            </option>
          ))}
        </select>
      </form>
    </div>
  );
}
