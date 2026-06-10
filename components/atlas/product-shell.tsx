import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { GraduationCap, LayoutDashboard, LogIn, LogOut } from "lucide-react";
import { BrandMark } from "@/components/atlas/primitives";
import { signOutOfAtlas } from "@/lib/auth/actions";
import { ScopePicker } from "@/components/atlas/scope-picker";
import type { WorkspaceScope } from "@/lib/workspace/scope";

const roleNav = [
  { href: "/teach", label: "Teach", icon: LayoutDashboard },
  { href: "/student", label: "Study", icon: GraduationCap },
];

export type CourseSection = {
  href: `#${string}`;
  label: string;
  icon: LucideIcon;
};

const focusStyle = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-accent-strong)]";

type ShellActor = {
  name?: string | null;
  email?: string | null;
  role?: string | null;
};

export function ProductShell({
  active,
  persona,
  title,
  subtitle,
  children,
  rail,
  actor,
  sections,
  scope,
  scopePath,
}: {
  active: "teach" | "student";
  persona: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  rail?: ReactNode;
  actor?: ShellActor;
  sections?: CourseSection[];
  /** Term + course pickers render when the page provides its scope. */
  scope?: WorkspaceScope;
  scopePath?: string;
}) {
  const visibleNav = navigationForRole(actor?.role);
  const showNavigation = visibleNav.length > 1;
  const sectionList = sections ?? [];
  const hasSections = sectionList.length > 0;
  const layoutClass = hasSections
    ? rail
      ? "xl:grid-cols-[164px_minmax(0,1fr)_320px]"
      : "xl:grid-cols-[164px_minmax(0,1fr)]"
    : rail
      ? "xl:grid-cols-[minmax(0,1fr)_320px]"
      : "xl:grid-cols-[minmax(0,1fr)]";

  return (
    <main className="atlas-app-bg min-h-screen text-[var(--color-ink)]">
      <header className="sticky top-0 z-20 border-b border-[var(--color-border)] bg-[color-mix(in_oklch,var(--color-bg)_92%,white)] backdrop-blur">
        <div className="mx-auto flex max-w-[1180px] items-start justify-between gap-4 px-5 py-4 md:px-8">
          <div className="flex min-w-0 items-start gap-4">
            <div className="hidden shrink-0 md:block">
              <BrandMark />
            </div>
            <div className="shrink-0 md:hidden">
              <BrandMark compact />
            </div>
            <div className="min-w-0 border-l border-[var(--color-border)] pl-4">
              <p className="text-[13px] text-[var(--color-muted)]">{subtitle}</p>
              <h1 className="mt-1 text-[22px] font-semibold leading-8 text-[var(--color-ink)] [text-wrap:balance] md:text-[24px]">
                {title}
              </h1>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {scope ? <ScopePicker scope={scope} returnTo={scopePath ?? `/${active}`} /> : null}
            {showNavigation ? <CourseNav active={active} items={visibleNav} /> : null}
            <HeaderAccountAction actor={actor} fallbackName={persona} />
          </div>
        </div>
      </header>

      <div className={`mx-auto grid max-w-[1180px] gap-5 px-5 py-6 md:px-8 ${layoutClass}`}>
        {hasSections ? <CourseSectionNav sections={sectionList} /> : null}
        <div className="min-w-0 space-y-5">{children}</div>
        {rail ? <aside className="space-y-5 xl:sticky xl:top-28 xl:self-start">{rail}</aside> : null}
      </div>
    </main>
  );
}

function navigationForRole(role?: string | null) {
  if (role === "student") return roleNav.filter((item) => item.href === "/student");
  if (role) return roleNav.filter((item) => item.href === "/teach");
  return roleNav;
}

function CourseNav({ active, items }: { active: "teach" | "student"; items: typeof roleNav }) {
  return (
    <nav aria-label="Course view" className="flex items-center gap-1 rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface)] p-1">
      {items.map((item) => {
        const Icon = item.icon;
        const itemActive = item.href === `/${active}`;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={itemActive ? "page" : undefined}
            className={`inline-flex min-h-8 items-center gap-2 rounded-[6px] px-3 text-[13px] font-medium transition ${focusStyle} ${
              itemActive
                ? "bg-[var(--color-ink)] text-white"
                : "text-[var(--color-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]"
            }`}
          >
            <Icon size={15} strokeWidth={2} aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function CourseSectionNav({ sections }: { sections: CourseSection[] }) {
  return (
    <aside className="min-w-0 xl:sticky xl:top-28 xl:self-start">
      <nav
        aria-label="Course sections"
        className="flex gap-1 rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface)] p-1 xl:grid"
      >
        {sections.map((section) => {
          const Icon = section.icon;

          return (
            <Link
              key={section.href}
              href={section.href}
              className={`inline-flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 whitespace-nowrap rounded-[6px] px-1 text-[11px] font-medium text-[var(--color-muted)] transition hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)] sm:min-h-9 sm:flex-row sm:gap-2 sm:px-3 sm:text-[13px] xl:flex-none xl:justify-start ${focusStyle}`}
            >
              <Icon size={14} strokeWidth={2} aria-hidden="true" />
              {section.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

function HeaderAccountAction({ actor, fallbackName }: { actor?: ShellActor; fallbackName: string }) {
  if (!actor) {
    return (
      <Link
        href="/sign-in"
        aria-label="Sign in"
        title="Sign in"
        className={`inline-flex size-10 items-center justify-center rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted)] transition hover:border-[var(--color-ink)] hover:text-[var(--color-ink)] ${focusStyle}`}
      >
        <LogIn size={16} strokeWidth={2} aria-hidden="true" />
      </Link>
    );
  }

  const label = actor.name || actor.email || fallbackName;

  return (
    <form action={signOutOfAtlas} className="flex items-center gap-2">
      <span className="hidden max-w-44 truncate text-[13px] font-medium text-[var(--color-muted)] sm:block">{label}</span>
      <button
        type="submit"
        aria-label="Sign out"
        title="Sign out"
        className={`inline-flex size-10 items-center justify-center rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted)] transition hover:border-[var(--color-ink)] hover:text-[var(--color-ink)] ${focusStyle}`}
      >
        <LogOut size={16} strokeWidth={2} aria-hidden="true" />
      </button>
    </form>
  );
}
