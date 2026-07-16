"use client";

import { useEffect, useState, type ComponentType, type ReactNode } from "react";
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
  LogOut,
  Megaphone,
  MessagesSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Send,
  Settings,
  SlidersHorizontal,
  Table2,
  UsersRound,
} from "lucide-react";
import { signOutOfAtlas } from "@/lib/auth/actions";
import { MotionPage } from "@/components/atlas/motion";
import { AtlasIcon, AtlasMark } from "@/components/atlas/primitives";
import { ThemeToggle } from "@/components/atlas/theme-switch";

type NavIconComponent = ComponentType<{
  size?: number;
  strokeWidth?: number;
  className?: string;
  "aria-hidden"?: boolean;
}>;

const ICONS = {
  dashboard: LayoutDashboard,
  atlas: AtlasIcon,
  aiwork: MessagesSquare,
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
} satisfies Record<string, NavIconComponent>;

export type ShellNavChild = {
  href: string;
  label: string;
  exact?: boolean;
};

export type NavItem = {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
  exact?: boolean;
  children?: ShellNavChild[];
};

export type NavSection = {
  label?: string;
  items: NavItem[];
};

export function AppShell({
  sections,
  children,
  institutionName,
  userName,
  userEmail,
}: {
  sections: NavSection[];
  children: ReactNode;
  institutionName: string;
  userName?: string | null;
  userEmail?: string | null;
}) {
  const pathname = usePathname();
  const [stored, setStored] = useState<boolean | null>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setStored(window.localStorage.getItem("atlas-sidebar") === "collapsed");
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const ready = stored !== null;
  const shellCollapsed = stored ?? false;

  function toggle() {
    setStored((value) => {
      const next = !(value ?? false);
      window.localStorage.setItem("atlas-sidebar", next ? "collapsed" : "open");
      return next;
    });
  }

  const isActive = (item: { href: string; exact?: boolean }) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

  return (
    <div className="atlas-app-bg flex min-h-screen text-[var(--color-ink)]">
      <aside
        className={`sticky top-0 z-20 h-screen shrink-0 ${
          ready ? "transition-[width] duration-[220ms] ease-out" : ""
        } ${shellCollapsed ? "w-[3.75rem]" : "w-[15.5rem]"}`}
      >
        <div className="flex h-full flex-col border-r border-[var(--color-border)] bg-[var(--color-surface-sidebar)]">
          {shellCollapsed ? (
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
          ) : (
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--color-border)] pl-4 pr-2">
              <Link
                href="/"
                aria-label={`${institutionName} home`}
                title={institutionName}
                className="flex min-w-0 flex-1 items-center gap-2.5 rounded-row pr-2 leading-tight focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)]"
              >
                <AtlasMark size={24} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.8125rem] font-semibold text-[var(--color-ink)]">{institutionName}</span>
                  <span className="mt-0.5 block text-[0.625rem] font-medium text-[var(--color-faint)]">Atlas</span>
                </span>
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
                          <Icon size={16} strokeWidth={2} aria-hidden className="shrink-0" />
                          {!shellCollapsed ? <span className="truncate">{item.label}</span> : null}
                        </Link>
                        {showChildren ? (
                          <div className="ml-[1.3125rem] mt-0.5 space-y-0.5 pl-2.5">
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

          <div className="shrink-0 border-t border-[var(--color-border)] p-2">
            <div className="flex items-center gap-1">
              <AccountMenu
                collapsed={shellCollapsed}
                name={userName}
                email={userEmail}
                institutionName={institutionName}
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

      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-[66.25rem] px-6 py-7 md:px-9">
          <MotionPage>{children}</MotionPage>
        </div>
      </main>
    </div>
  );
}

function AccountMenu({
  collapsed,
  name,
  email,
  institutionName,
}: {
  collapsed: boolean;
  name?: string | null;
  email?: string | null;
  institutionName: string;
}) {
  const [open, setOpen] = useState(false);
  const displayName = name?.trim() || email?.trim() || "Account";
  const initial = displayName.charAt(0).toUpperCase();

  const menuRow =
    "flex w-full items-center rounded-row px-2.5 py-1.5 text-left text-[0.6875rem] font-normal text-[var(--color-muted)] transition hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-accent-strong)]";

  return (
    <div className="relative min-w-0 flex-1">
      {open ? <button type="button" aria-hidden tabIndex={-1} className="fixed inset-0 z-30 cursor-default" onClick={() => setOpen(false)} /> : null}

      {open ? (
        <div
          role="menu"
          className="absolute bottom-full left-0 z-40 mb-2 w-[14.5rem] rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)] p-1 shadow-[var(--shadow-floating)]"
        >
          <div className="px-2.5 py-2">
            <p className="truncate text-[0.8125rem] font-medium text-[var(--color-ink)]">{displayName}</p>
            {email && name ? <p className="truncate text-[0.6875rem] text-[var(--color-faint)]">{email}</p> : null}
          </div>
          <div className="mx-1 my-1 h-px bg-[var(--color-border)]" aria-hidden />
          <div className="flex items-center justify-between gap-3 px-2.5 py-1.5">
            <span className="text-[0.8125rem] font-medium text-[var(--color-muted)]">Theme</span>
            <ThemeToggle />
          </div>
          <div className="mx-1 my-1 h-px bg-[var(--color-border)]" aria-hidden />
          <form action={signOutOfAtlas}>
            <button type="submit" role="menuitem" className={menuRow}>
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
        className={`flex w-full items-center gap-2.5 rounded-row px-2 py-1.5 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)] ${
          collapsed ? "justify-center" : ""
        } ${open ? "bg-[var(--color-surface-muted)]" : "hover:bg-[var(--color-surface-muted)]"}`}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-indigo-soft)] text-[0.75rem] font-semibold text-[var(--color-accent-strong)]">
          {initial}
        </span>
        {!collapsed ? (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[0.8125rem] font-medium text-[var(--color-ink)]">{displayName}</span>
            <span className="block truncate text-[0.6875rem] text-[var(--color-faint)]">{institutionName}</span>
          </span>
        ) : null}
      </button>
    </div>
  );
}
