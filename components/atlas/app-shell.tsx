"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpenCheck,
  CalendarDays,
  ClipboardCheck,
  Compass,
  GraduationCap,
  Layers3,
  LayoutDashboard,
  Megaphone,
  PanelLeftClose,
  PanelLeftOpen,
  Send,
  Settings,
  SlidersHorizontal,
  Telescope,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { setCourseScope, setTermScope } from "@/lib/workspace/scope-actions";
import { MotionPage } from "@/components/atlas/motion";
import { AtlasMark } from "@/components/atlas/primitives";

/**
 * The app frame: a grouped sidebar and a content column. The sidebar carries
 * the wordmark, the term and course in view, the navigation in labeled
 * sections (global context above, course context below), and two explicit
 * bottom destinations: Settings and Account. The collapse toggle lives beside
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
  settingsHref,
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
  settingsHref?: string;
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
        } ${shellCollapsed ? "w-[60px]" : "w-[248px]"}`}
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
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--color-border)] px-4">
              <Link
                href="/"
                aria-label="Atlas"
                className="flex items-center gap-2.5 rounded-row focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)]"
              >
                <AtlasMark size={24} />
                <span className="atlas-serif text-[17px] font-medium">Atlas</span>
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

          {/* The term and course in view. Always visible when present, so the
              record's scope is a fact on screen, not something to discover. */}
          {!shellCollapsed && hasContext ? (
            <div className="shrink-0 space-y-1.5 border-b border-[var(--color-border)] px-3 py-3">
              {terms && terms.length > 0 ? (
                <ScopeSwitcher
                  id="shell-term"
                  label="Term"
                  action={setTermScope}
                  field="term"
                  options={terms.map((t) => ({ value: t.slug, label: t.name }))}
                  active={activeTermSlug ?? ""}
                  scopePath={scopePath ?? pathname}
                />
              ) : null}
              {courses && courses.length > 0 ? (
                <ScopeSwitcher
                  id="shell-course"
                  label="Course"
                  action={setCourseScope}
                  field="course"
                  options={courses.map((c) => ({ value: c.id, label: `${c.code} ${c.name}` }))}
                  active={activeCourseId ?? ""}
                  scopePath={scopePath ?? pathname}
                />
              ) : null}
            </div>
          ) : null}

          {/* Navigation, grouped: global context first, course context below. */}
          <nav className="flex-1 overflow-y-auto px-3 py-3" aria-label="Main">
            {sections.map((section, index) => (
              <div key={section.label ?? `section-${index}`} className={index > 0 ? "mt-5" : undefined}>
                {index > 0 && shellCollapsed ? <div className="mx-1 mb-4 h-px bg-[var(--color-border)]" aria-hidden /> : null}
                {section.label && !shellCollapsed ? (
                  <p className="atlas-mono mb-1.5 px-2.5 text-[10.5px] font-medium uppercase tracking-[0.09em] text-[var(--color-faint)]">
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
                          className={`relative flex min-h-9 items-center gap-2.5 rounded-row px-2.5 text-[13.5px] font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)] ${
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
                          <div className="ml-[21px] mt-0.5 space-y-0.5 border-l border-[var(--color-border)] pl-2.5">
                            {item.children!.map((child) => {
                              const childActive = isActive(child);
                              return (
                                <Link
                                  key={child.href}
                                  href={child.href}
                                  aria-current={childActive ? "page" : undefined}
                                  className={`flex min-h-8 items-center rounded-row px-2 text-[12.5px] font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)] ${
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

          {/* Bottom destinations: Settings and Account. Plain rows, no popover. */}
          <div className="shrink-0 space-y-0.5 border-t border-[var(--color-border)] p-2">
            {settingsHref ? (
              <Link
                href={settingsHref}
                aria-current={isActive({ href: settingsHref }) ? "page" : undefined}
                title={shellCollapsed ? "Settings" : undefined}
                className={`flex min-h-9 items-center gap-2.5 rounded-row px-2.5 text-[13.5px] font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)] ${
                  shellCollapsed ? "justify-center" : ""
                } ${
                  isActive({ href: settingsHref })
                    ? "bg-[var(--color-indigo-soft)] text-[var(--color-ink)]"
                    : "text-[var(--color-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]"
                }`}
              >
                <Settings size={16} strokeWidth={2} aria-hidden className="shrink-0" />
                {!shellCollapsed ? <span className="truncate">Settings</span> : null}
              </Link>
            ) : null}
            <AccountRow
              href={accountHref}
              collapsed={shellCollapsed}
              active={isActive({ href: accountHref })}
              name={userName}
              email={userEmail}
            />
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

/**
 * One scope select: the term or course the workspace reads. A single option
 * renders as a plain fact; more than one renders the switch itself.
 */
function ScopeSwitcher({
  id,
  label,
  action,
  field,
  options,
  active,
  scopePath,
}: {
  id: string;
  label: string;
  action: (formData: FormData) => void;
  field: string;
  options: Array<{ value: string; label: string }>;
  active: string;
  scopePath: string;
}) {
  if (options.length <= 1) {
    return (
      <p className="flex min-h-8 items-center gap-2 rounded-row border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 text-[12.5px] font-medium text-[var(--color-muted)]">
        <span className="atlas-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-faint)]">{label}</span>
        <span className="truncate">{options[0]?.label ?? ""}</span>
      </p>
    );
  }

  return (
    <form action={action}>
      <input type="hidden" name="returnTo" value={scopePath} />
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        name={field}
        value={active}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        title={label}
        className="w-full cursor-pointer appearance-none truncate rounded-row border border-[var(--color-border)] bg-[var(--color-surface)] py-1.5 pl-2.5 pr-7 text-[12.5px] font-medium text-[var(--color-muted)] transition hover:border-[var(--color-border-strong)] hover:text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6' fill='none'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23889a9a' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E\")",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 9px center",
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </form>
  );
}

/**
 * The Account destination, pinned last: the signed-in identity as a plain
 * row that opens the Account page. Theme and sign out live there.
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
      className={`flex items-center gap-2.5 rounded-row px-2 py-1.5 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)] ${
        collapsed ? "justify-center" : ""
      } ${active ? "bg-[var(--color-indigo-soft)]" : "hover:bg-[var(--color-surface-muted)]"}`}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-indigo-soft)] text-[12px] font-semibold text-[var(--color-accent-strong)]">
        {initial}
      </span>
      {!collapsed ? (
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-[var(--color-ink)]">{displayName}</span>
          <span className="block text-[11px] text-[var(--color-faint)]">Account</span>
        </span>
      ) : null}
    </Link>
  );
}
