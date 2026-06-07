import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import type { LucideProps } from "lucide-react";
import { ArrowRight } from "lucide-react";

type Icon = ComponentType<LucideProps>;

const badgeTone = {
  neutral: "border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-muted)]",
  accent: "border-[rgba(30,126,140,0.30)] bg-[rgba(30,126,140,0.09)] text-[var(--color-accent-strong)]",
  good: "border-[rgba(62,122,82,0.28)] bg-[rgba(62,122,82,0.09)] text-[var(--color-good)]",
  warn: "border-[rgba(154,106,34,0.28)] bg-[rgba(154,106,34,0.09)] text-[var(--color-warn)]",
};

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" aria-label="Atlas" className="group inline-flex items-center gap-3">
      <AtlasMark compact={compact} />
      {!compact ? (
        <span className="leading-none">
          <span className="atlas-serif block text-[18px] font-medium text-[var(--color-ink)]">Atlas</span>
          <span className="mt-1 block text-[12px] text-[var(--color-muted)]">Course record</span>
        </span>
      ) : null}
    </Link>
  );
}

function AtlasMark({ compact }: { compact: boolean }) {
  const size = compact ? 28 : 34;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      className="flex-none"
    >
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

export function ButtonLink({
  href,
  children,
  variant = "primary",
  icon = true,
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  icon?: boolean;
}) {
  const styles = {
    primary:
      "border-[var(--color-ink)] bg-[var(--color-ink)] text-white hover:bg-[var(--color-accent-strong)] hover:border-[var(--color-accent-strong)]",
    secondary:
      "border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:border-[var(--color-ink)]",
    ghost: "border-transparent bg-transparent text-[var(--color-muted)] hover:text-[var(--color-ink)]",
  };

  return (
    <Link
      href={href}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] border px-4 text-[14px] font-medium transition ${styles[variant]}`}
    >
      <span>{children}</span>
      {icon ? <ArrowRight size={16} strokeWidth={2} aria-hidden="true" /> : null}
    </Link>
  );
}

export function Panel({
  title,
  eyebrow,
  action,
  children,
  className = "",
}: {
  title?: string;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-panel)] ${className}`}>
      {title || action ? (
        <header className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] px-5 py-4">
          <div>
            {eyebrow ? <p className="text-[12px] font-medium text-[var(--color-muted)]">{eyebrow}</p> : null}
            {title ? <h2 className="mt-1 text-[16px] font-semibold text-[var(--color-ink)]">{title}</h2> : null}
          </div>
          {action}
        </header>
      ) : null}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function CommandBand({
  eyebrow,
  title,
  detail,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  detail?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="rounded-[8px] border border-[var(--color-border)] bg-[color-mix(in_oklch,var(--color-surface)_90%,var(--color-accent)_10%)] px-5 py-4 shadow-[var(--shadow-panel)]">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.55fr)] lg:items-center">
        <div className="min-w-0">
          <p className="text-[12px] font-medium text-[var(--color-accent-strong)]">{eyebrow}</p>
          <h2 className="mt-1 text-[18px] font-semibold leading-7 text-[var(--color-ink)]">{title}</h2>
          {detail ? <p className="mt-1 max-w-3xl text-[13px] leading-5 text-[var(--color-muted)]">{detail}</p> : null}
        </div>
        {children ? <div className="grid gap-2 text-[13px] sm:grid-cols-2">{children}</div> : null}
      </div>
    </section>
  );
}

export function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: keyof typeof badgeTone;
}) {
  return (
    <span className={`inline-flex min-h-7 items-center rounded-[6px] border px-2.5 text-[12px] font-medium ${badgeTone[tone]}`}>
      {children}
    </span>
  );
}

export function CodeList({ codes }: { codes: string[] }) {
  if (codes.length === 0) return null;

  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px] font-medium text-[var(--color-accent-strong)]">
      {codes.map((code, index) => (
        <span key={code}>
          {code}
          {index < codes.length - 1 ? "," : ""}
        </span>
      ))}
    </span>
  );
}

export function ActionButton({
  children,
  variant = "primary",
  type = "submit",
  className = "",
  ariaLabel,
  title,
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "quiet" | "danger";
  type?: "button" | "submit";
  className?: string;
  ariaLabel?: string;
  title?: string;
}) {
  const styles = {
    primary:
      "border-[var(--color-ink)] bg-[var(--color-ink)] text-white hover:border-[var(--color-accent-strong)] hover:bg-[var(--color-accent-strong)]",
    secondary:
      "border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:border-[var(--color-ink)]",
    quiet:
      "border-transparent bg-transparent text-[var(--color-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]",
    danger:
      "border-[rgba(166,67,47,0.30)] bg-transparent text-[var(--color-danger)] hover:bg-[rgba(166,67,47,0.08)]",
  };

  return (
    <button
      type={type}
      aria-label={ariaLabel}
      title={title}
      className={`inline-flex min-h-9 items-center justify-center rounded-[8px] border px-3 text-[13px] font-medium transition ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function ProgressBar({ value, label }: { value: number; label?: string }) {
  const safeValue = Math.max(0, Math.min(100, value));

  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-[12px] text-[var(--color-muted)]">
        <span>{label ?? "Progress"}</span>
        <span>{safeValue}%</span>
      </div>
      <div className="mt-2 h-2 rounded-[4px] bg-[var(--color-surface-muted)]">
        <div className="h-full rounded-[4px] bg-[var(--color-accent)]" style={{ width: `${safeValue}%` }} />
      </div>
    </div>
  );
}

export function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <p className="text-[12px] font-medium text-[var(--color-muted)]">{label}</p>
      <p className="mt-3 text-[28px] font-semibold leading-none text-[var(--color-ink)]">{value}</p>
      <p className="mt-2 text-[13px] leading-5 text-[var(--color-muted)]">{detail}</p>
    </div>
  );
}

export function IconLabel({ icon: Icon, children }: { icon: Icon; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-[13px] text-[var(--color-muted)]">
      <Icon size={15} strokeWidth={2} aria-hidden="true" />
      {children}
    </span>
  );
}

export function PageFrame({ children }: { children: ReactNode }) {
  return <main className="atlas-app-bg min-h-screen text-[var(--color-ink)]">{children}</main>;
}
