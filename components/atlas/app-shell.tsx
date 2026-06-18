"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpenCheck,
  ClipboardCheck,
  Compass,
  GraduationCap,
  Layers3,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Send,
  Settings,
  Sparkles,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { signOutOfAtlas } from "@/lib/auth/actions";
import { setCourseScope } from "@/lib/workspace/scope-actions";
import { MotionPage } from "@/components/atlas/motion";

/**
 * The app frame: a collapsible sidebar and a content column. The sidebar
 * carries the wordmark, the navigation, an optional course switcher, and a
 * quiet sign out. When collapsed it expands on hover as an overlay, the
 * Notion/Linear pattern: the rail stays 60px in flow, the panel floats.
 */

const ICONS = {
  dashboard: LayoutDashboard,
  atlas: Sparkles,
  review: ClipboardCheck,
  weeks: Layers3,
  work: Send,
  students: UsersRound,
  settings: Settings,
  course: BookOpenCheck,
  study: GraduationCap,
  compass: Compass,
} satisfies Record<string, LucideIcon>;

export type NavItem = {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
  /** Exact match only (for index routes that prefix every other route). */
  exact?: boolean;
};

export type ShellCourse = {
  id: string;
  code: string;
  name: string;
};

export function AppShell({
  nav,
  children,
  courses,
  activeCourseId,
  scopePath,
}: {
  nav: NavItem[];
  children: ReactNode;
  courses?: ShellCourse[];
  activeCourseId?: string | null;
  scopePath?: string;
}) {
  const pathname = usePathname();
  // null until hydrated: the server renders expanded, the stored preference
  // applies on the first client frame, and only then do transitions turn on.
  const [stored, setStored] = useState<boolean | null>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setStored(window.localStorage.getItem("atlas-sidebar") === "collapsed");
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const ready = stored !== null;
  const collapsed = stored ?? false;

  function toggle() {
    setStored((value) => {
      const next = !(value ?? false);
      window.localStorage.setItem("atlas-sidebar", next ? "collapsed" : "open");
      return next;
    });
  }

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

  // Label visibility: shown when expanded, hidden (not invisible) when
  // collapsed so it takes no flex space and justify-center centers the icon.
  const labelCls = collapsed
    ? "hidden group-hover:block"
    : "block";

  return (
    <div className="atlas-app-bg flex min-h-screen text-[var(--color-ink)]">
      {/* The rail: stays at 60px in flow when collapsed. The inner panel
          floats to full width on hover, overlaying content without pushing. */}
      <aside
        className={`group sticky top-0 z-20 h-screen shrink-0 ${collapsed ? "w-[60px] overflow-visible" : "w-[218px]"}`}
      >
        <div
          className={`absolute inset-y-0 left-0 z-30 flex flex-col border-r border-[var(--color-border)] bg-[var(--color-surface-sidebar)] ${
            ready ? "transition-[width,box-shadow,border-color] duration-[220ms] ease-out" : ""
          } ${collapsed ? "w-[60px] group-hover:w-[218px] group-hover:border-[var(--color-border-strong)] group-hover:shadow-[var(--shadow-floating)]" : "w-[218px]"}`}
        >
          {/* Brand */}
          <div className={`flex h-14 items-center border-b border-[var(--color-border)] ${collapsed ? "justify-center px-0 group-hover:px-4 group-hover:justify-start" : "px-4"}`}>
            <Link href="/" aria-label="Atlas" className="flex items-center gap-2.5 rounded-[6px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)]">
              <AtlasMark />
              <span className={`atlas-serif text-[17px] font-medium ${labelCls}`}>Atlas</span>
            </Link>
          </div>

          {/* Course switcher: hidden in the rail, appears on hover */}
          {courses && courses.length > 1 ? (
            <div className={`border-b border-[var(--color-border)] px-3 py-2.5 ${collapsed ? "hidden group-hover:block" : "block"}`}>
              <CourseSwitcher courses={courses} activeCourseId={activeCourseId} scopePath={scopePath ?? pathname} />
            </div>
          ) : null}

          {/* Navigation */}
          <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3" aria-label="Main">
            {nav.map((item) => {
              const Icon = ICONS[item.icon];
              const active = isActive(item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  title={collapsed ? item.label : undefined}
                  className={`relative flex min-h-9 items-center gap-2.5 rounded-[7px] px-2.5 text-[13.5px] font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)] ${
                    collapsed ? "justify-center group-hover:justify-start" : ""
                  } ${
                    active
                      ? "bg-[var(--color-indigo-soft)] text-[var(--color-ink)]"
                      : "text-[var(--color-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]"
                  }`}
                >
                  {/* Active accent bar */}
                  {active ? (
                    <span className="absolute left-0 top-1/2 h-5 w-[2.5px] -translate-y-1/2 rounded-full bg-[var(--color-indigo)]" aria-hidden />
                  ) : null}
                  <Icon size={16} strokeWidth={2} aria-hidden className="shrink-0" />
                  <span className={`truncate ${labelCls}`}>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Footer controls */}
          <div className={`flex items-center gap-1 border-t border-[var(--color-border)] p-2 ${collapsed ? "flex-col group-hover:flex-row group-hover:justify-between" : "justify-between"}`}>
            <button
              type="button"
              onClick={toggle}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={collapsed ? "Expand" : "Collapse"}
              className="inline-flex size-9 items-center justify-center rounded-[7px] text-[var(--color-faint)] transition hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)]"
            >
              {collapsed ? <PanelLeftOpen size={16} strokeWidth={2} aria-hidden /> : <PanelLeftClose size={16} strokeWidth={2} aria-hidden />}
            </button>
            <form action={signOutOfAtlas}>
              <button
                type="submit"
                aria-label="Sign out"
                title="Sign out"
                className="inline-flex size-9 items-center justify-center rounded-[7px] text-[var(--color-faint)] transition hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)]"
              >
                <LogOut size={15} strokeWidth={2} aria-hidden />
              </button>
            </form>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-[1060px] px-6 py-7 md:px-9">
          <MotionPage>{children}</MotionPage>
        </div>
      </main>
    </div>
  );
}

function CourseSwitcher({
  courses,
  activeCourseId,
  scopePath,
}: {
  courses: ShellCourse[];
  activeCourseId?: string | null;
  scopePath: string;
}) {
  return (
    <form action={setCourseScope}>
      <input type="hidden" name="returnTo" value={scopePath} />
      <label className="sr-only" htmlFor="shell-course">
        Course
      </label>
      <select
        id="shell-course"
        name="course"
        value={activeCourseId ?? ""}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className="w-full cursor-pointer appearance-none truncate rounded-[7px] border border-[var(--color-border)] bg-[var(--color-surface)] py-1.5 pl-2.5 pr-7 text-[12.5px] font-medium text-[var(--color-muted)] transition hover:text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6' fill='none'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23667085' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E\")",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 9px center",
        }}
      >
        {courses.map((course) => (
          <option key={course.id} value={course.id}>
            {course.code}
          </option>
        ))}
      </select>
    </form>
  );
}

function AtlasMark() {
  return (
    <svg width={26} height={26} viewBox="0 0 64 64" aria-hidden className="flex-none">
      <circle cx="32" cy="32" r="17" fill="none" stroke="var(--color-indigo)" strokeWidth="2.4" />
      <g stroke="var(--color-ink)" strokeWidth="2.2" strokeLinecap="round">
        <line x1="32" y1="11" x2="32" y2="19" />
        <line x1="32" y1="45" x2="32" y2="53" />
        <line x1="11" y1="32" x2="19" y2="32" />
        <line x1="45" y1="32" x2="53" y2="32" />
      </g>
      <circle cx="32" cy="32" r="3.1" fill="var(--color-accent)" />
    </svg>
  );
}
