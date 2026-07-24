"use client";

import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  ClipboardList,
  ClipboardCheck,
  Compass,
  GraduationCap,
  Layers3,
  LayoutDashboard,
  Megaphone,
  MessagesSquare,
  Files,
  Landmark,
  Library,
  Plug,
  PanelLeftClose,
  PanelLeftOpen,
  ScrollText,
  Settings,
  SlidersHorizontal,
  Table2,
  UserRound,
  UsersRound,
} from "lucide-react";
import { signOutOfAtlas } from "@/lib/auth/actions";
import { MotionPage } from "@/components/atlas/motion";
import { AtlasIcon, AtlasMark } from "@/components/atlas/primitives";
import { ThemeToggle } from "@/components/atlas/theme-switch";
import { UserAvatar } from "@/components/atlas/user-avatar";

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
  assignments: ClipboardList,
  students: UsersRound,
  settings: Settings,
  setup: SlidersHorizontal,
  syllabus: ScrollText,
  study: GraduationCap,
  compass: Compass,
  calendar: CalendarDays,
  announce: Megaphone,
  gradebook: Table2,
  resources: Library,
  books: Files,
  integrations: Plug,
  profile: UserRound,
  policies: Landmark,
} satisfies Record<string, NavIconComponent>;

export type ShellNavChild = {
  href: string;
  label: string;
  exact?: boolean;
};

export type NavItem = {
  href: string;
  label: string;
  icon?: keyof typeof ICONS;
  compactLabel?: string;
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
  userImage,
  accountHref,
}: {
  sections: NavSection[];
  children: ReactNode;
  institutionName: string;
  userName?: string | null;
  userEmail?: string | null;
  userImage?: string | null;
  accountHref: string;
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

          {/*
            The nav is sized to hold the course's whole set of destinations
            without scrolling on an ordinary laptop. A scrollbar inside a
            fifteen-item sidebar is not a capacity problem, it is a spacing
            problem: rows at 2.25rem plus 1.25rem between groups overflowed by
            a few dozen pixels, so the last item hid behind a bar for no reason.
            Rows are 2rem and groups are 1rem apart, which fits the current set
            with room to spare. overflow-y-auto remains only as the honest
            fallback for a genuinely short window or a much longer nav later.
          */}
          <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-2" aria-label="Main">
            {sections.map((section, index) => (
              <div key={section.label ?? `section-${index}`} className={index > 0 ? "mt-4" : undefined}>
                {index > 0 && shellCollapsed ? <div className="mx-1 mb-3 h-px bg-[var(--color-border)]" aria-hidden /> : null}
                {section.label && !shellCollapsed ? (
                  <p className="mb-1 px-2.5 text-[0.65625rem] font-semibold uppercase tracking-[0.08em] text-[var(--color-faint)]">
                    {section.label}
                  </p>
                ) : null}
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const Icon = item.icon ? ICONS[item.icon] : null;
                    const active = isActive(item);
                    const showChildren = !shellCollapsed && active && item.children && item.children.length > 0;
                    return (
                      <div key={item.href}>
                        <Link
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          title={shellCollapsed ? item.label : undefined}
                          className={`relative flex min-h-8 items-center gap-2.5 rounded-row px-2.5 text-[0.84375rem] font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)] ${
                            shellCollapsed ? "justify-center" : ""
                          } ${
                            active
                              ? "bg-[var(--color-indigo-soft)] text-[var(--color-ink)]"
                              : "text-[var(--color-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]"
                          }`}
                        >
                          {Icon ? <Icon size={16} strokeWidth={2} aria-hidden className="shrink-0" /> : shellCollapsed ? (
                            <span className="text-[0.625rem] font-semibold tracking-[-0.02em] text-[var(--color-muted)]">
                              {item.compactLabel ?? item.label.slice(0, 2).toUpperCase()}
                            </span>
                          ) : null}
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
            <AccountMenu
              collapsed={shellCollapsed}
              name={userName}
              email={userEmail}
              image={userImage}
              institutionName={institutionName}
              accountHref={accountHref}
            />
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
  image,
  institutionName,
  accountHref,
}: {
  collapsed: boolean;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  institutionName: string;
  accountHref: string;
}) {
  const [open, setOpen] = useState(false);
  const displayName = name?.trim() || email?.trim() || "Account";

  const menuRow =
    "flex min-h-9 w-full items-center gap-2.5 rounded-row px-2.5 text-left text-[0.8125rem] font-medium text-[var(--color-muted)] transition hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-accent-strong)]";

  return (
    <div className="relative min-w-0 flex-1">
      {open ? <button type="button" aria-hidden tabIndex={-1} className="fixed inset-0 z-30 cursor-default" onClick={() => setOpen(false)} /> : null}

      {open ? (
        <div
          role="menu"
          className="absolute bottom-full left-0 z-40 mb-2 w-[15rem] rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)] p-1.5 shadow-[var(--shadow-floating)]"
        >
          <div className="flex items-center gap-2.5 px-2.5 py-2.5">
            <UserAvatar name={name} email={email} image={image} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.8125rem] font-medium text-[var(--color-ink)]">{displayName}</p>
              {email && name ? <p className="truncate text-[0.6875rem] text-[var(--color-faint)]">{email}</p> : null}
            </div>
          </div>
          <div className="space-y-0.5">
            <Link href={accountHref} role="menuitem" onClick={() => setOpen(false)} className={menuRow}>
              <UserRound size={15} strokeWidth={2} aria-hidden className="shrink-0" />
              Account settings
            </Link>
            <ThemeToggle variant="menu" />
            <form action={signOutOfAtlas}>
              <button type="submit" role="menuitem" className={menuRow}>
                Sign out
              </button>
            </form>
          </div>
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
        <UserAvatar name={name} email={email} image={image} />
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
