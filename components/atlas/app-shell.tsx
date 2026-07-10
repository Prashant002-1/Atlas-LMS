"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpenCheck,
  CalendarDays,
  Check,
  ChevronDown,
  ClipboardCheck,
  Compass,
  GraduationCap,
  Layers3,
  LayoutDashboard,
  LogOut,
  Megaphone,
  PanelLeftClose,
  PanelLeftOpen,
  Send,
  Settings,
  SlidersHorizontal,
  Table2,
  Telescope,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { signOutOfAtlas } from "@/lib/auth/actions";
import { setCourseScope, setTermScope } from "@/lib/workspace/scope-actions";
import { MotionPage } from "@/components/atlas/motion";
import { AtlasMark } from "@/components/atlas/primitives";
import { ThemeToggle } from "@/components/atlas/theme-switch";

/**
 * The app frame: a grouped sidebar and a content column. The sidebar carries
 * the wordmark, the term and course in view, the navigation in labeled
 * sections, and one identity row at the bottom: the account, the theme
 * toggle, and sign out, all in the open. The collapse toggle lives beside
 * the logo; collapsed, the logo itself becomes the toggle. No popovers.
 */

const ICONS = {
  dashboard: LayoutDashboard,
  atlas: Telescope,
  review: ClipboardCheck,
  weeks: Layers3,
  work: Send,
  students: UsersRound,
  settings: Settings,
  setup: SlidersHorizontal,
  course: BookOpenCheck,
  study: GraduationCap,
  compass: Compass,
  calendar: CalendarDays,
  announce: Megaphone,
  gradebook: Table2,
} satisfies Record<string, LucideIcon>;

export type ShellNavChild = {
  href: string;
  label: string;
  /** Exact match only (for a course home that prefixes its sibling routes). */
  exact?: boolean;
};

export type NavItem = {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
  /** Exact match only (for index routes that prefix every other route). */
  exact?: boolean;
  /** Sub-destinations revealed while this item is the active context. */
  children?: ShellNavChild[];
};

export type NavSection = {
  label?: string;
  items: NavItem[];
};

export type ShellCourse = {
  id: string;
  code: string;
  name: string;
};

export type ShellTerm = {
  slug: string;
  name: string;
};

export function AppShell({
  sections,
  children,
  courses,
  activeCourseId,
  terms,
  activeTermSlug,
  scopePath,
  accountHref,
  userName,
  userEmail,
}: {
  sections: NavSection[];
  children: ReactNode;
  courses?: ShellCourse[];
  activeCourseId?: string | null;
  terms?: ShellTerm[];
  activeTermSlug?: string | null;
  scopePath?: string;
  accountHref: string;
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

  const isActive = (item: { href: string; exact?: boolean }) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

  const hasContext = Boolean((courses && courses.length > 0) || (terms && terms.length > 0));

  return (
    <div className="atlas-app-bg flex min-h-screen text-[var(--color-ink)]">
      <aside
        className={`sticky top-0 z-20 h-screen shrink-0 ${
          ready ? "transition-[width] duration-[220ms] ease-out" : ""
        } ${shellCollapsed ? "w-[3.75rem]" : "w-[15.5rem]"}`}
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
                <span className="relative flex size-5 items-center justify-center">
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
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--color-border)] px-4">
              <Link
                href="/"
                aria-label="Atlas"
                className="flex items-center gap-2.5 rounded-row focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)]"
              >
                <AtlasMark size={24} />
                <span className="atlas-serif text-[1.0625rem] font-medium">Atlas</span>
              </Link>
              <button
                type="button"
                onClick={toggle}
                aria-label="Collapse sidebar"
                title="Collapse"
                className="inline-flex size-8 items-center justify-center rounded-control text-[var(--color-faint)] transition hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)]"
              >
                <PanelLeftClose size={15} strokeWidth={2} aria-hidden />
              </button>
            </div>
          )}

          {/* The term and course in view: one menu bar, values only. */}
          {!shellCollapsed && hasContext ? (
            <div className="shrink-0 border-b border-[var(--color-border)] px-3 py-3">
              <ScopeMenuBar
                terms={terms ?? []}
                activeTermSlug={activeTermSlug ?? ""}
                courses={courses ?? []}
                activeCourseId={activeCourseId ?? ""}
                scopePath={scopePath ?? pathname}
              />
            </div>
          ) : null}

          {/* Navigation, grouped: global context first, course context below. */}
          <nav className="flex-1 overflow-y-auto px-3 py-3" aria-label="Main">
            {sections.map((section, index) => (
              <div key={section.label ?? `section-${index}`} className={index > 0 ? "mt-5" : undefined}>
                {index > 0 && shellCollapsed ? <div className="mx-1 mb-4 h-px bg-[var(--color-border)]" aria-hidden /> : null}
                {section.label && !shellCollapsed ? (
                  <p className="atlas-mono mb-1.5 px-2.5 text-[0.65625rem] font-medium uppercase tracking-[0.09em] text-[var(--color-faint)]">
                    {section.label}
                  </p>
                ) : null}
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const Icon = ICONS[item.icon];
                    const active = isActive(item);
                    const showChildren = !shellCollapsed && active && item.children && item.children.length > 0;
                    return (
                      <div key={item.href}>
                        <Link
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          title={shellCollapsed ? item.label : undefined}
                          className={`relative flex min-h-9 items-center gap-2.5 rounded-row px-2.5 text-[0.84375rem] font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)] ${
                            shellCollapsed ? "justify-center" : ""
                          } ${
                            active
                              ? "bg-[var(--color-indigo-soft)] text-[var(--color-ink)]"
                              : "text-[var(--color-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]"
                          }`}
                        >
                          {active ? (
                            <span
                              className="absolute left-0 top-1/2 h-5 w-[2.5px] -translate-y-1/2 rounded-full bg-[var(--color-indigo)]"
                              aria-hidden
                            />
                          ) : null}
                          <Icon size={16} strokeWidth={2} aria-hidden className="shrink-0" />
                          {!shellCollapsed ? <span className="truncate">{item.label}</span> : null}
                        </Link>
                        {showChildren ? (
                          <div className="ml-[1.3125rem] mt-0.5 space-y-0.5 border-l border-[var(--color-border)] pl-2.5">
                            {item.children!.map((child) => {
                              const childActive = isActive(child);
                              return (
                                <Link
                                  key={child.href}
                                  href={child.href}
                                  aria-current={childActive ? "page" : undefined}
                                  className={`flex min-h-8 items-center rounded-row px-2 text-[0.78125rem] font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)] ${
                                    childActive
                                      ? "text-[var(--color-ink)]"
                                      : "text-[var(--color-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]"
                                  }`}
                                >
                                  <span className="truncate">{child.label}</span>
                                </Link>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* The identity block: a small theme toggle above, then the account
              row with sign out beside the name. Nothing else crowds the name. */}
          <div className="shrink-0 border-t border-[var(--color-border)] p-2">
            {!shellCollapsed ? (
              <div className="flex justify-end pb-1">
                <ThemeToggle />
              </div>
            ) : null}
            <div className="flex items-center gap-1">
              <AccountRow
                href={accountHref}
                collapsed={shellCollapsed}
                active={isActive({ href: accountHref })}
                name={userName}
                email={userEmail}
              />
              {!shellCollapsed ? (
                <form action={signOutOfAtlas}>
                  <button
                    type="submit"
                    aria-label="Sign out"
                    title="Sign out"
                    className="inline-flex size-7 shrink-0 items-center justify-center rounded-control text-[var(--color-faint)] transition hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)]"
                  >
                    <LogOut size={14} strokeWidth={2} aria-hidden />
                  </button>
                </form>
              ) : null}
            </div>
          </div>
        </div>
      </aside>

      <main className={`min-w-0 flex-1 ${immersive ? "overflow-hidden" : ""}`}>
        <div className={immersive ? "h-screen min-w-0 px-0 py-0" : "mx-auto max-w-[66.25rem] px-6 py-7 md:px-9"}>
          <MotionPage className={immersive ? "h-full min-w-0" : undefined}>{children}</MotionPage>
        </div>
      </main>
    </div>
  );
}

/**
 * The course in view, as one card: the code, the full name with room to
 * breathe, and the term beneath it. The card opens a single menu where each
 * course, and each term below the hairline, is a plain submit button into
 * its scope action, current choices checked. Nothing shares a line and
 * nothing truncates on the card itself.
 */
function ScopeMenuBar({
  terms,
  activeTermSlug,
  courses,
  activeCourseId,
  scopePath,
}: {
  terms: ShellTerm[];
  activeTermSlug: string;
  courses: ShellCourse[];
  activeCourseId: string;
  scopePath: string;
}) {
  const [open, setOpen] = useState(false);

  const activeTerm = terms.find((t) => t.slug === activeTermSlug) ?? terms[0];
  const activeCourse = courses.find((c) => c.id === activeCourseId) ?? courses[0];
  if (!activeCourse && !activeTerm) return null;

  return (
    <div className="relative">
      {open ? (
        <button type="button" aria-hidden tabIndex={-1} className="fixed inset-0 z-30 cursor-default" onClick={() => setOpen(false)} />
      ) : null}

      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={`group/scope flex w-full items-start gap-2 rounded-row border px-3 py-2.5 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)] ${
          open
            ? "border-[var(--color-border-strong)] bg-[var(--color-surface)]"
            : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)]"
        }`}
      >
        <span className="min-w-0 flex-1">
          {activeCourse ? (
            <>
              <span className="atlas-mono block text-[0.65625rem] uppercase tracking-[0.08em] text-[var(--color-faint)]">
                {activeCourse.code}
              </span>
              <span className="mt-0.5 block text-[0.84375rem] font-medium leading-5 text-[var(--color-ink)]">
                {activeCourse.name}
              </span>
            </>
          ) : null}
          {activeTerm ? (
            <span className={`block text-[0.71875rem] text-[var(--color-faint)] ${activeCourse ? "mt-1" : ""}`}>
              {activeTerm.name}
            </span>
          ) : null}
        </span>
        <ChevronDown
          size={13}
          strokeWidth={2}
          aria-hidden
          className={`mt-1 shrink-0 text-[var(--color-faint)] transition group-hover/scope:text-[var(--color-muted)] ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute left-0 top-full z-40 mt-1.5 w-[19rem] max-w-[calc(100vw-1.5rem)] rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)] p-1 shadow-[var(--shadow-floating)]"
        >
          {courses.length > 0 ? (
            <form action={setCourseScope}>
              <input type="hidden" name="returnTo" value={scopePath} />
              {courses.map((course) => {
                const current = course.id === activeCourse?.id;
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
          ) : null}

          {courses.length > 0 && terms.length > 0 ? <div className="mx-1 my-1 h-px bg-[var(--color-border)]" aria-hidden /> : null}

          {terms.length > 0 ? (
            <form action={setTermScope}>
              <input type="hidden" name="returnTo" value={scopePath} />
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
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The Account destination: the signed-in identity as a plain row that opens
 * the Account page. The theme toggle and sign out sit beside it.
 */
function AccountRow({
  href,
  collapsed,
  active,
  name,
  email,
}: {
  href: string;
  collapsed: boolean;
  active: boolean;
  name?: string | null;
  email?: string | null;
}) {
  const displayName = name?.trim() || email?.trim() || "Account";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      aria-label="Account"
      title={collapsed ? "Account" : undefined}
      className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-row px-2 py-1.5 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)] ${
        collapsed ? "justify-center" : ""
      } ${active ? "bg-[var(--color-indigo-soft)]" : "hover:bg-[var(--color-surface-muted)]"}`}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-indigo-soft)] text-[0.75rem] font-semibold text-[var(--color-accent-strong)]">
        {initial}
      </span>
      {!collapsed ? (
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.8125rem] font-medium text-[var(--color-ink)]">{displayName}</span>
          <span className="block text-[0.6875rem] text-[var(--color-faint)]">Account</span>
        </span>
      ) : null}
    </Link>
  );
}
