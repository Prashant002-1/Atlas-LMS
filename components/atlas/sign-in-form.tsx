"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signInWithCredentials, type SignInState } from "@/lib/auth/actions";

const initialState: SignInState = {};
const focusStyle = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-accent-strong)]";

export function SignInForm({ defaultRole = "instructor" }: { defaultRole?: "instructor" | "student" }) {
  const [state, formAction] = useActionState(signInWithCredentials, initialState);
  const suggestedEmail = defaultRole === "student" ? "student@demo.edu" : "instructor@demo.edu";

  return (
    <div className="rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-panel)]">
      <h1 className="text-[18px] font-semibold text-[var(--color-ink)]">Sign in</h1>

      <form action={formAction} className="mt-5">
        <div className="grid gap-4">
          <label className="grid gap-2 text-[13px] font-medium text-[var(--color-ink)]">
            Email
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              defaultValue={suggestedEmail}
              className={`min-h-11 rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 text-[14px] text-[var(--color-ink)] transition focus:border-[var(--color-accent-strong)] focus:bg-[var(--color-surface)] ${focusStyle}`}
            />
          </label>
          <label className="grid gap-2 text-[13px] font-medium text-[var(--color-ink)]">
            Password
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className={`min-h-11 rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 text-[14px] text-[var(--color-ink)] transition focus:border-[var(--color-accent-strong)] focus:bg-[var(--color-surface)] ${focusStyle}`}
            />
          </label>

          {state.error ? (
            <p className="rounded-[8px] border border-[rgba(163,58,42,0.22)] bg-[rgba(163,58,42,0.08)] px-3 py-2 text-[13px] text-[var(--color-danger)]">
              {state.error}
            </p>
          ) : null}

          <SubmitButton label="Open the course" />
        </div>
      </form>
    </div>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex min-h-11 w-full items-center justify-center rounded-[8px] border border-[var(--color-ink)] bg-[var(--color-ink)] px-4 text-[14px] font-medium text-white transition hover:border-[var(--color-accent-strong)] hover:bg-[var(--color-accent-strong)] disabled:cursor-not-allowed disabled:opacity-60 ${focusStyle}`}
    >
      {pending ? "Opening…" : label}
    </button>
  );
}
