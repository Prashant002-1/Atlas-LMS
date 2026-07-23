import Link from "next/link";
import Image from "next/image";
import { useId, type ComponentType, type ReactNode, type SVGAttributes } from "react";
import type { LucideProps } from "lucide-react";
import { ArrowLeft, ArrowRight, ChevronRight } from "lucide-react";

type Icon = ComponentType<LucideProps>;

const badgeTone = {
  neutral: "border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-muted)]",
  accent: "border-[color-mix(in_oklch,var(--color-accent)_38%,transparent)] bg-[color-mix(in_oklch,var(--color-accent)_12%,transparent)] text-[var(--color-accent-strong)]",
  good: "border-[color-mix(in_oklch,var(--color-good)_38%,transparent)] bg-[color-mix(in_oklch,var(--color-good)_12%,transparent)] text-[var(--color-good)]",
  warn: "border-[color-mix(in_oklch,var(--color-warn)_38%,transparent)] bg-[color-mix(in_oklch,var(--color-warn)_12%,transparent)] text-[var(--color-warn)]",
  danger: "border-[color-mix(in_oklch,var(--color-danger)_38%,transparent)] bg-[color-mix(in_oklch,var(--color-danger)_12%,transparent)] text-[var(--color-danger)]",
};

const focusStyle = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-accent-strong)]";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" aria-label="Atlas" className={`group inline-flex items-center gap-3 rounded-row ${focusStyle}`}>
      <AtlasMark size={compact ? 26 : 32} />
      {!compact ? (
        <span className="atlas-serif text-[1.125rem] font-medium leading-none text-[var(--color-ink)]">Atlas</span>
      ) : null}
    </Link>
  );
}

export function AtlasMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <Image
      src="/brand/atlas-mark.svg"
      width={size}
      height={size}
      alt=""
      unoptimized
      aria-hidden="true"
      className={`flex-none ${className ?? ""}`}
    />
  );
}

/**
 * The Atlas mark in a single shade: the EXACT geometry of
 * public/brand/atlas-mark.svg (tile, aperture, ticks), rendered as a
 * currentColor stencil so it can sit among interface icons. The artwork is
 * a copy, never a redesign; only the shade differs. Asset copy at
 * public/brand/atlas-icon.svg.
 */
export function AtlasIcon({
  size = 16,
  className,
  ...rest
}: { size?: number; className?: string } & SVGAttributes<SVGSVGElement>) {
  const id = useId();
  const clipId = `${id}-clip`;
  const maskId = `${id}-mask`;
  return (
    <svg viewBox="102 110 316 316" width={size} height={size} fill="none" className={className} {...rest}>
      <defs>
        <clipPath id={clipId}>
          <rect x="102" y="110" width="316" height="316" rx="72" />
        </clipPath>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="102" y="110" width="316" height="316">
          <rect x="102" y="110" width="316" height="316" rx="72" fill="#fff" />
          <g clipPath={`url(#${clipId})`}>
            <path d="M260 132 L430 426 H90 L260 132Z" fill="#000" />
            <path d="M260 132 L348 426 H172 L260 132Z" fill="#fff" />
            <path d="M260 132 L300 426 H220 L260 132Z" fill="#000" />
            <g fill="none" stroke="#000" strokeLinecap="butt">
              <path d="M140 118.5 V137" strokeWidth="5" />
              <path d="M180 110 V124" strokeWidth="4" />
              <path d="M220 110 V125" strokeWidth="4" />
              <path d="M300 110 V125" strokeWidth="4" />
              <path d="M340 110 V124" strokeWidth="4" />
              <path d="M380 118.5 V137" strokeWidth="5" />
            </g>
            <path d="M260 110 V132" fill="none" stroke="#000" strokeWidth="6" strokeLinecap="butt" />
          </g>
        </mask>
      </defs>
      <rect x="102" y="110" width="316" height="316" rx="72" fill="currentColor" mask={`url(#${maskId})`} />
    </svg>
  );
}

export function ButtonLink({
  href,
  children,
  variant = "primary",
  size = "md",
  icon = true,
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  size?: "md" | "sm";
  icon?: boolean;
}) {
  const styles = {
    primary:
      "border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-bg)] hover:bg-[var(--color-accent-strong)] hover:border-[var(--color-accent-strong)]",
    secondary:
      "border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:border-[var(--color-ink)]",
    ghost: "border-transparent bg-transparent text-[var(--color-muted)] hover:text-[var(--color-ink)]",
  };
  const sizes = {
    md: "min-h-10 px-4 text-[0.875rem]",
    sm: "min-h-9 px-3 text-[0.8125rem]",
  };

  return (
    <Link
      href={href}
      className={`atlas-card-hover inline-flex items-center justify-center gap-2 rounded-control border font-medium active:translate-y-px ${sizes[size]} ${focusStyle} ${styles[variant]}`}
    >
      <span className="inline-flex items-center">{children}</span>
      {icon ? <ArrowRight size={size === "sm" ? 14 : 16} strokeWidth={2} aria-hidden="true" /> : null}
    </Link>
  );
}

/**
 * An inline link into a record. The resting underline is the signifier that
 * this text acts; hover confirms it with the accent, it never reveals it.
 */
export function TextLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`rounded-row font-medium text-[var(--color-ink)] underline decoration-[color-mix(in_oklch,var(--color-ink)_30%,transparent)] decoration-1 underline-offset-[3px] transition hover:text-[var(--color-accent-strong)] hover:decoration-[var(--color-accent-strong)] ${focusStyle} ${className}`}
    >
      {children}
    </Link>
  );
}

/**
 * A record row that navigates: hover fill plus a resting chevron at the
 * trailing edge, so the row reads as an opening before the cursor arrives.
 */
export function RecordRow({
  href,
  children,
  aside,
  className = "",
}: {
  href: string;
  children: ReactNode;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`group/row flex items-center gap-3 px-4 py-3 transition hover:bg-[var(--color-surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-accent-strong)] ${className}`}
    >
      <span className="min-w-0 flex-1">{children}</span>
      {aside ? <span className="flex shrink-0 items-center gap-2.5">{aside}</span> : null}
      <ChevronRight
        size={14}
        strokeWidth={2}
        aria-hidden="true"
        className="shrink-0 text-[var(--color-faint)] transition group-hover/row:translate-x-0.5 group-hover/row:text-[var(--color-muted)]"
      />
    </Link>
  );
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={`inline-flex w-fit items-center gap-2 rounded-row text-[0.8125rem] font-medium text-[var(--color-muted)] transition hover:text-[var(--color-ink)] ${focusStyle}`}
    >
      <ArrowLeft size={14} strokeWidth={2} aria-hidden="true" />
      <span>{children}</span>
    </Link>
  );
}

export function Panel({
  title,
  eyebrow,
  action,
  children,
  className = "",
  id,
}: {
  title?: string;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-panel)] ${className}`}>
      {title || action ? (
        <header className="flex items-start justify-between gap-4 px-5 py-4">
          <div>
            {eyebrow ? <p className="text-[0.75rem] font-medium text-[var(--color-muted)]">{eyebrow}</p> : null}
            {title ? <h2 className="mt-1 text-[1rem] font-semibold text-[var(--color-ink)]">{title}</h2> : null}
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
  after,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  detail?: ReactNode;
  after?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="rounded-panel border border-[var(--color-border)] bg-[color-mix(in_oklch,var(--color-surface)_90%,var(--color-accent)_10%)] px-5 py-4 shadow-[var(--shadow-panel)]">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(16.25rem,0.55fr)] lg:items-center">
        <div className="min-w-0">
          <p className="text-[0.75rem] font-medium text-[var(--color-accent-strong)]">{eyebrow}</p>
          <h2 className="mt-1 text-[1.125rem] font-semibold leading-7 text-[var(--color-ink)]">{title}</h2>
          {detail ? <p className="mt-1 max-w-3xl text-[0.8125rem] leading-5 text-[var(--color-muted)]">{detail}</p> : null}
        </div>
        {children ? <div className="grid gap-2 text-[0.8125rem] sm:grid-cols-2">{children}</div> : null}
      </div>
      {after ? <div className="mt-4 pt-4">{after}</div> : null}
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
    <span className={`inline-flex min-h-7 items-center rounded-row border px-2.5 text-[0.75rem] font-medium ${badgeTone[tone]}`}>
      {children}
    </span>
  );
}

export function CodeList({ codes }: { codes: string[] }) {
  if (codes.length === 0) return null;

  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[0.75rem] font-medium text-[var(--color-accent-strong)]">
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
  size = "md",
  type = "submit",
  className = "",
  ariaLabel,
  title,
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "quiet" | "danger";
  size?: "md" | "sm";
  type?: "button" | "submit";
  className?: string;
  ariaLabel?: string;
  title?: string;
}) {
  const styles = {
    primary:
      "border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-bg)] hover:border-[var(--color-accent-strong)] hover:bg-[var(--color-accent-strong)]",
    secondary:
      "border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:border-[var(--color-ink)]",
    quiet:
      "border-transparent bg-transparent text-[var(--color-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]",
    danger:
      "border-[color-mix(in_oklch,var(--color-danger)_38%,transparent)] bg-transparent text-[var(--color-danger)] hover:bg-[color-mix(in_oklch,var(--color-danger)_10%,transparent)]",
  };
  const sizes = {
    md: "min-h-9 px-3 text-[0.8125rem]",
    sm: "min-h-8 px-2.5 text-[0.75rem]",
  };

  return (
    <button
      type={type}
      aria-label={ariaLabel}
      title={title}
      className={`atlas-card-hover inline-flex items-center justify-center rounded-control border font-medium active:translate-y-px ${sizes[size]} ${focusStyle} ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function ProgressBar({ value, label }: { value: number; label?: string }) {
  const safeValue = Math.max(0, Math.min(100, value));

  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-[0.75rem] text-[var(--color-muted)]">
        <span>{label ?? "Progress"}</span>
        <span>{safeValue}%</span>
      </div>
      <div className="mt-2 h-2 rounded-row bg-[var(--color-surface-muted)]">
        <div
          className="h-full rounded-row bg-[var(--color-accent)] transition-[width] duration-[500ms] ease-out"
          style={{ width: `${safeValue}%` }}
        />
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
    <div className="atlas-card-hover rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-panel)]">
      <p className="text-[0.75rem] font-medium text-[var(--color-muted)]">{label}</p>
      <p className="mt-3 text-[1.75rem] font-semibold leading-none text-[var(--color-ink)]">{value}</p>
      <p className="mt-2 text-[0.8125rem] leading-5 text-[var(--color-muted)]">{detail}</p>
    </div>
  );
}

export function IconLabel({ icon: Icon, children }: { icon: Icon; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-[0.8125rem] text-[var(--color-muted)]">
      <Icon size={15} strokeWidth={2} aria-hidden="true" />
      {children}
    </span>
  );
}

export function PageFrame({ children }: { children: ReactNode }) {
  return <main className="atlas-app-bg min-h-screen text-[var(--color-ink)]">{children}</main>;
}
