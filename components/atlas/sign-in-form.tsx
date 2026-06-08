"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signInWithCredentials, signInWithWorkspaceRole, type SignInState } from "@/lib/auth/actions";

const initialState: SignInState = {};
const focusStyle = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-accent-strong)]";

const roleCopy = {
  instructor: {
    button: "Open course",
    tab: "Teach",
  },
  student: {
    button: "Open course",
    tab: "Study",
  },
} as const;

type AccessRole = keyof typeof roleCopy;

export function SignInForm({ defaultRole = "instructor" }: { defaultRole?: AccessRole }) {
  const [state, formAction] = useActionState(signInWithCredentials, initialState);
  const selectedRole = defaultRole === "student" ? "student" : "instructor";
  const selected = roleCopy[selectedRole];

  return (
    <div className="grid gap-4">
      <div className="rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-panel)]">
        <div>
          <p className="text-[12px] text-[var(--color-muted)]">STAT-201 · Fall 2026</p>
          <h2 className="mt-1 text-[18px] font-semibold text-[var(--color-ink)]">Applied Statistics</h2>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 rounded-[8px] bg-[var(--color-surface-muted)] p-1">
          <RoleTab href="/sign-in" active={selectedRole === "instructor"}>
            {roleCopy.instructor.tab}
          </RoleTab>
          <RoleTab href="/sign-in?role=student" active={selectedRole === "student"}>
            {roleCopy.student.tab}
          </RoleTab>
        </div>

        <form action={signInWithWorkspaceRole} className="mt-5">
          <input type="hidden" name="role" value={selectedRole} />
          <WorkspaceButton label={selected.button} />
        </form>

        <details className="mt-5 border-t border-[var(--color-border)] pt-3">
          <summary className={`cursor-pointer list-none rounded-[6px] py-2 text-[13px] font-medium text-[var(--color-ink)] transition hover:text-[var(--color-accent-strong)] [&::-webkit-details-marker]:hidden ${focusStyle}`}>
            Use email
          </summary>
          <form action={formAction}>
            <div className="grid gap-4 pt-2">
              <label className="grid gap-2 text-[13px] font-medium text-[var(--color-ink)]">
                Email
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  className={`min-h-11 rounded-[8px] border border-[var(--color-border)] bg-white px-3 text-[14px] text-[var(--color-ink)] transition focus:border-[var(--color-accent-strong)] ${focusStyle}`}
                />
              </label>
              <label className="grid gap-2 text-[13px] font-medium text-[var(--color-ink)]">
                Password
                <input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  className={`min-h-11 rounded-[8px] border border-[var(--color-border)] bg-white px-3 text-[14px] text-[var(--color-ink)] transition focus:border-[var(--color-accent-strong)] ${focusStyle}`}
                />
              </label>

              {state.error ? (
                <p className="rounded-[8px] border border-[rgba(163,58,42,0.22)] bg-[rgba(163,58,42,0.08)] px-3 py-2 text-[13px] text-[var(--color-danger)]">
                  {state.error}
                </p>
              ) : null}

              <div>
                <SubmitButton label="Sign in" />
              </div>
            </div>
          </form>
        </details>
      </div>
    </div>
  );
}

function RoleTab({ href, active, children }: { href: string; active: boolean; children: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`inline-flex min-h-9 items-center justify-center rounded-[6px] px-3 text-[13px] font-medium transition ${focusStyle} ${
        active
          ? "bg-[var(--color-surface)] text-[var(--color-ink)] shadow-[var(--shadow-panel)]"
          : "text-[var(--color-muted)] hover:text-[var(--color-ink)]"
      }`}
    >
      {children}
    </Link>
  );
}

function WorkspaceButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex min-h-10 w-full items-center justify-center rounded-[8px] border border-[var(--color-ink)] bg-[var(--color-ink)] px-4 text-[14px] font-medium text-white transition hover:border-[var(--color-accent-strong)] hover:bg-[var(--color-accent-strong)] disabled:cursor-not-allowed disabled:opacity-60 ${focusStyle}`}
    >
      {pending ? "Opening..." : label}
    </button>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex min-h-10 w-full items-center justify-center rounded-[8px] border border-[var(--color-ink)] bg-[var(--color-ink)] px-4 text-[14px] font-medium text-white transition hover:border-[var(--color-accent-strong)] hover:bg-[var(--color-accent-strong)] disabled:cursor-not-allowed disabled:opacity-60 ${focusStyle}`}
    >
      {pending ? "Signing in..." : label}
    </button>
  );
}
