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

          {/* The identity row: account, theme, sign out. All in the open. */}
          <div className="shrink-0 border-t border-[var(--color-border)] p-2">
            <div className="flex items-center gap-1">
              <AccountRow
                href={accountHref}
                collapsed={shellCollapsed}
                active={isActive({ href: accountHref })}
                name={userName}
                email={userEmail}
              />
              {!shellCollapsed ? (
                <>
                  <ThemeToggle />
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
                </>
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
 * The scope menu bar: the term and the course in view as two menu segments,
 * values only, no markers. Each segment toggles a menu; each menu item is a
 * plain submit button into the matching scope action, so switching is one
 * click and one round trip.
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
  const [open, setOpen] = useState<"term" | "course" | null>(null);

  const activeTerm = terms.find((t) => t.slug === activeTermSlug) ?? terms[0];
  const activeCourse = courses.find((c) => c.id === activeCourseId) ?? courses[0];

  const segment = (kind: "term" | "course", value: string, grow: boolean) => (
    <button
      type="button"
      aria-haspopup="menu"
      aria-expanded={open === kind}
      onClick={() => setOpen((current) => (current === kind ? null : kind))}
      className={`flex min-h-8 items-center gap-1.5 px-2.5 text-[0.78125rem] font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-accent-strong)] ${
        grow ? "min-w-0 flex-1" : "shrink-0"
      } ${open === kind ? "bg-[var(--color-surface-muted)] text-[var(--color-ink)]" : "text-[var(--color-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]"}`}
    >
      <span className="truncate">{value}</span>
      <ChevronDown size={12} strokeWidth={2} aria-hidden className="shrink-0 text-[var(--color-faint)]" />
    </button>
  );

  return (
    <div className="relative">
      {open ? <button type="button" aria-hidden tabIndex={-1} className="fixed inset-0 z-30 cursor-default" onClick={() => setOpen(null)} /> : null}

      <div className="flex items-stretch divide-x divide-[var(--color-border)] overflow-hidden rounded-row border border-[var(--color-border)] bg-[var(--color-surface)]">
        {activeTerm ? segment("term", activeTerm.name, false) : null}
        {activeCourse ? segment("course", activeCourse.code, true) : null}
      </div>

      {open === "term" && activeTerm ? (
        <ScopeMenu
          action={setTermScope}
          field="term"
          scopePath={scopePath}
          active={activeTerm.slug}
          options={terms.map((t) => ({ value: t.slug, label: t.name }))}
        />
      ) : null}
      {open === "course" && activeCourse ? (
        <ScopeMenu
          action={setCourseScope}
          field="course"
          scopePath={scopePath}
          active={activeCourse.id}
          options={courses.map((c) => ({ value: c.id, label: `${c.code} ${c.name}` }))}
        />
      ) : null}
    </div>
  );
}

function ScopeMenu({
  action,
  field,
  scopePath,
  active,
  options,
}: {
  action: (formData: FormData) => void;
  field: string;
  scopePath: string;
  active: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <form
      action={action}
      role="menu"
      className="absolute left-0 right-0 top-full z-40 mt-1 rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)] p-1 shadow-[var(--shadow-floating)]"
    >
      <input type="hidden" name="returnTo" value={scopePath} />
      {options.map((option) => {
        const current = option.value === active;
        return (
          <button
            key={option.value}
            type="submit"
            name={field}
            value={option.value}
            role="menuitemradio"
            aria-checked={current}
            className="flex w-full items-center gap-2 rounded-row px-2 py-1.5 text-left text-[0.78125rem] font-medium text-[var(--color-muted)] transition hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-accent-strong)]"
          >
            <span className="min-w-0 flex-1 truncate">{option.label}</span>
            {current ? <Check size={13} strokeWidth={2} aria-hidden className="shrink-0 text-[var(--color-accent-strong)]" /> : null}
          </button>
        );
      })}
    </form>
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
