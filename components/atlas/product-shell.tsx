import Link from "next/link";
import type { ReactNode } from "react";
import { GraduationCap, LayoutDashboard, LogIn, LogOut } from "lucide-react";
import { BrandMark } from "@/components/atlas/primitives";
import { signOutOfAtlas } from "@/lib/auth/actions";

const nav = [
  { href: "/teach", label: "Teach", icon: LayoutDashboard },
  { href: "/student", label: "Study", icon: GraduationCap },
];

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
}: {
  active: "teach" | "student";
  persona: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  rail?: ReactNode;
  actor?: ShellActor;
}) {
  const visibleNav = navigationForRole(actor?.role);
  const showNavigation = visibleNav.length > 1;

  return (
    <main className="atlas-app-bg min-h-screen text-[var(--color-ink)]">
      <header className="sticky top-0 z-20 border-b border-[var(--color-border)] bg-[color-mix(in_oklch,var(--color-bg)_92%,white)] backdrop-blur">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-4 px-5 py-4 md:px-8 lg:flex-row lg:items-center lg:justify-between">
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

          <div className="flex items-center gap-2 self-start lg:self-auto">
            {showNavigation ? <CourseNav active={active} items={visibleNav} /> : null}
            <HeaderAccountAction actor={actor} fallbackName={persona} />
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1180px] gap-5 px-5 py-6 md:px-8 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">{children}</div>
        {rail ? <aside className="space-y-5 xl:sticky xl:top-28 xl:self-start">{rail}</aside> : null}
      </div>
    </main>
  );
}

function navigationForRole(role?: string | null) {
  if (role === "student") return nav.filter((item) => item.href === "/student");
  if (role) return nav.filter((item) => item.href === "/teach");
  return nav;
}

function CourseNav({ active, items }: { active: "teach" | "student"; items: typeof nav }) {
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
            className={`inline-flex min-h-8 items-center gap-2 rounded-[6px] px-3 text-[13px] font-medium transition ${
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

function HeaderAccountAction({ actor, fallbackName }: { actor?: ShellActor; fallbackName: string }) {
  if (!actor) {
    return (
      <Link
        href="/sign-in"
        aria-label="Sign in"
        title="Sign in"
        className="inline-flex size-10 items-center justify-center rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted)] transition hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]"
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
        className="inline-flex size-10 items-center justify-center rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted)] transition hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]"
      >
        <LogOut size={16} strokeWidth={2} aria-hidden="true" />
      </button>
    </form>
  );
}
