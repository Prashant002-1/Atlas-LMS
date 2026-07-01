"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpenCheck,
  ChevronsUpDown,
  ClipboardCheck,
  Compass,
  GraduationCap,
  Layers3,
  LayoutDashboard,
  LogOut,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Send,
  Settings,
  SlidersHorizontal,
  Sun,
  Telescope,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { signOutOfAtlas } from "@/lib/auth/actions";
import { setCourseScope } from "@/lib/workspace/scope-actions";
import { MotionPage } from "@/components/atlas/motion";
import { AtlasMark } from "@/components/atlas/primitives";

/**
 * The app frame: a collapsible sidebar and a content column. The sidebar
 * carries the wordmark, the navigation, an optional course switcher, and the
 * account menu (settings, preferences, theme, sign out) pinned at the bottom.
 * The collapse toggle lives beside the logo at the top. When collapsed, the
 * logo itself becomes the toggle: clicking it opens the sidebar. No hover-float.
 */

const ICONS = {
  dashboard: LayoutDashboard,
  atlas: Telescope,
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
  userName,
  userEmail,
}: {
  nav: NavItem[];
  children: ReactNode;
  courses?: ShellCourse[];
  activeCourseId?: string | null;
  scopePath?: string;
  userName?: string | null;
  userEmail?: string | null;
}) {
  const pathname = usePathname();
  const immersive = pathname === "/teach/atlas";
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
  const shellCollapsed = immersive || collapsed;

  function toggle() {
    setStored((value) => {
      const next = !(value ?? false);
      window.localStorage.setItem("atlas-sidebar", next ? "collapsed" : "open");
      return next;
    });
  }

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

  return (
    <div className="atlas-app-bg flex min-h-screen text-[var(--color-ink)]">
      <aside
        className={`sticky top-0 z-20 h-screen shrink-0 ${
          ready ? "transition-[width] duration-[220ms] ease-out" : ""
        } ${shellCollapsed ? "w-[60px]" : "w-[218px]"}`}
      >
        <div className="flex h-full flex-col border-r border-[var(--color-border)] bg-[var(--color-surface-sidebar)]">
          {/* Brand header */}
          {shellCollapsed ? (
            immersive ? (
              <Link
                href="/teach"
                aria-label="Atlas"
                title="Atlas"
                className="flex h-14 w-full items-center justify-center border-b border-[var(--color-border)] text-[var(--color-faint)] transition-colors hover:text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-accent-strong)]"
              >
                <AtlasMark size={22} />
              </Link>
            ) : (
              /* Collapsed: the logo mark. On hover it crossfades into the
                 expand icon. Clicking toggles the sidebar open. */
              <button
                type="button"
                onClick={toggle}
                aria-label="Expand sidebar"
                title="Expand"
                className="group/brand flex h-14 w-full items-center justify-center border-b border-[var(--color-border)] text-[var(--color-faint)] transition-colors hover:text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-accent-strong)]"
              >
                <span className="relative flex size-[20px] items-center justify-center">
                  <span className="absolute inset-0 flex items-center justify-center opacity-100 transition-opacity duration-200 ease-out group-hover/brand:opacity-0">
                    <AtlasMark size={20} />
                  </span>
                  <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 ease-out group-hover/brand:opacity-100">
                    <PanelLeftOpen size={15} strokeWidth={2} aria-hidden />
                  </span>
                </span>
              </button>
            )
          ) : (
            /* Expanded: logo + wordmark on the left, toggle on the right */
            <div className="flex h-14 items-center justify-between border-b border-[var(--color-border)] px-4">
              <Link href="/" aria-label="Atlas" className="flex items-center gap-2.5 rounded-[6px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)]">
                <AtlasMark size={24} />
                <span className="atlas-serif text-[17px] font-medium">Atlas</span>
              </Link>
              <button
                type="button"
                onClick={toggle}
                aria-label="Collapse sidebar"
                title="Collapse"
                className="inline-flex size-8 items-center justify-center rounded-[6px] text-[var(--color-faint)] transition hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)]"
              >
                <PanelLeftClose size={15} strokeWidth={2} aria-hidden />
              </button>
            </div>
          )}

          {/* Course switcher: only when expanded */}
          {!shellCollapsed && courses && courses.length > 1 ? (
            <div className="border-b border-[var(--color-border)] px-3 py-2.5">
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
                  title={shellCollapsed ? item.label : undefined}
                  className={`relative flex min-h-9 items-center gap-2.5 rounded-[8px] px-2.5 text-[13.5px] font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)] ${
                    shellCollapsed ? "justify-center" : ""
                  } ${
                    active
                      ? "bg-[var(--color-indigo-soft)] text-[var(--color-ink)]"
                      : "text-[var(--color-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]"
                  }`}
                >
                  {active ? (
                    <span className="absolute left-0 top-1/2 h-5 w-[2.5px] -translate-y-1/2 rounded-full bg-[var(--color-indigo)]" aria-hidden />
                  ) : null}
                  <Icon size={16} strokeWidth={2} aria-hidden className="shrink-0" />
                  {!shellCollapsed ? <span className="truncate">{item.label}</span> : null}
                </Link>
              );
            })}
          </nav>

          {/* Footer: account menu (settings, preferences, theme, sign out) */}
          <div className="border-t border-[var(--color-border)] p-2">
            <AccountMenu collapsed={shellCollapsed} name={userName} email={userEmail} />
          </div>
        </div>
      </aside>

      <main className={`min-w-0 flex-1 ${immersive ? "overflow-hidden" : ""}`}>
        <div className={immersive ? "h-screen min-w-0 px-0 py-0" : "mx-auto max-w-[1060px] px-6 py-7 md:px-9"}>
          <MotionPage className={immersive ? "h-full min-w-0" : undefined}>{children}</MotionPage>
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
        className="w-full cursor-pointer appearance-none truncate rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface)] py-1.5 pl-2.5 pr-7 text-[12.5px] font-medium text-[var(--color-muted)] transition hover:text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6' fill='none'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23889a9a' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E\")",
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

/**
 * Account menu, pinned to the bottom of the sidebar. The trigger shows the
 * signed-in identity; the popover holds account settings, preferences, a
 * light/dark theme switch, and sign out. The theme buttons write data-theme
 * on the document root and persist to localStorage; the no-flash init script
 * in the root layout reads it back on load.
 */
function AccountMenu({
  collapsed,
  name,
  email,
}: {
  collapsed: boolean;
  name?: string | null;
  email?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof document === "undefined") return "dark";
    const current = document.documentElement.getAttribute("data-theme");
    return current === "light" ? "light" : "dark";
  });

  function applyTheme(next: "light" | "dark") {
    document.documentElement.setAttribute("data-theme", next);
    try {
      window.localStorage.setItem("atlas-theme", next);
    } catch {
      // Storage can be unavailable (private mode); the choice still applies for this session.
    }
    setTheme(next);
  }

  const displayName = name?.trim() || email?.trim() || "Account";
  const initial = (name?.trim() || email?.trim() || "A").charAt(0).toUpperCase();

  const itemClass =
    "flex w-full items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-[13px] font-medium text-[var(--color-muted)] transition hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-accent-strong)]";

  const themeButton = (value: "light" | "dark", label: string, Icon: LucideIcon) => (
    <button
      type="button"
      aria-label={label}
      aria-pressed={theme === value}
      onClick={() => applyTheme(value)}
      className={`inline-flex size-7 items-center justify-center rounded-[6px] transition ${
        theme === value
          ? "bg-[var(--color-indigo-soft)] text-[var(--color-ink)]"
          : "text-[var(--color-faint)] hover:text-[var(--color-ink)]"
      }`}
    >
      <Icon size={14} strokeWidth={2} aria-hidden />
    </button>
  );

  return (
    <div className="relative">
      {open ? <div className="fixed inset-0 z-30" aria-hidden onClick={() => setOpen(false)} /> : null}

      {open ? (
        <div
          role="menu"
          className="absolute bottom-full left-0 z-40 mb-2 w-[230px] rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] p-1.5 shadow-[var(--shadow-floating)]"
        >
          <div className="flex items-center gap-2.5 px-2.5 py-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-indigo-soft)] text-[12px] font-semibold text-[var(--color-accent-strong)]">
              {initial}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-medium text-[var(--color-ink)]">{displayName}</span>
              {email && name ? <span className="block truncate text-[11px] text-[var(--color-faint)]">{email}</span> : null}
            </span>
          </div>

          <div className="my-1 h-px bg-[var(--color-border)]" />

          <button type="button" role="menuitem" className={itemClass} onClick={() => setOpen(false)}>
            <UserRound size={15} strokeWidth={2} aria-hidden />
            Account settings
          </button>
          <button type="button" role="menuitem" className={itemClass} onClick={() => setOpen(false)}>
            <SlidersHorizontal size={15} strokeWidth={2} aria-hidden />
            Preferences
          </button>

          <div className="flex items-center justify-between px-2.5 py-2">
            <span className="text-[13px] font-medium text-[var(--color-muted)]">Theme</span>
            <div className="inline-flex rounded-[8px] border border-[var(--color-border)] p-0.5">
              {themeButton("light", "Light", Sun)}
              {themeButton("dark", "Dark", Moon)}
            </div>
          </div>

          <div className="my-1 h-px bg-[var(--color-border)]" />

          <form action={signOutOfAtlas}>
            <button type="submit" role="menuitem" className={itemClass}>
              <LogOut size={15} strokeWidth={2} aria-hidden />
              Sign out
            </button>
          </form>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account"
        title={collapsed ? displayName : undefined}
        className={`flex w-full items-center gap-2.5 rounded-[8px] border border-transparent px-2 py-1.5 text-left transition hover:bg-[var(--color-surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)] ${
          collapsed ? "justify-center" : ""
        } ${open ? "bg-[var(--color-surface-muted)]" : ""}`}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-indigo-soft)] text-[12px] font-semibold text-[var(--color-accent-strong)]">
          {initial}
        </span>
        {!collapsed ? (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-[var(--color-ink)]">{displayName}</span>
              {email && name ? <span className="block truncate text-[11px] text-[var(--color-faint)]">{email}</span> : null}
            </span>
            <ChevronsUpDown size={14} strokeWidth={2} aria-hidden className="shrink-0 text-[var(--color-faint)]" />
          </>
        ) : null}
      </button>
    </div>
  );
}
