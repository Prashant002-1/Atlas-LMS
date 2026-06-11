import type { ReactNode } from "react";

/** One quiet header per page: what this page is, in the course in view. */
export function PageHeader({ title, course, action }: { title: string; course?: string; action?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        {course ? <p className="atlas-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-faint)]">{course}</p> : null}
        <h1 className="mt-1 text-[22px] font-semibold leading-7">{title}</h1>
      </div>
      {action ? <div>{action}</div> : null}
    </header>
  );
}
