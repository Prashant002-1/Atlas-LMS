import type { ReactNode } from "react";

/** One quiet header per page: what this page is, in the course in view. */
export function PageHeader({ title, course, action }: { title: string; course?: string; action?: ReactNode }) {
  return (
    <header className="mb-7 flex flex-wrap items-end justify-between gap-3 border-b border-[var(--color-border)] pb-5">
      <div>
        {course ? <p className="text-[0.6875rem] font-medium text-[var(--color-faint)]">{course}</p> : null}
        <h1 className="atlas-serif mt-1.5 text-[1.5rem] font-semibold leading-7 text-[var(--color-ink)]">{title}</h1>
      </div>
      {action ? <div>{action}</div> : null}
    </header>
  );
}
