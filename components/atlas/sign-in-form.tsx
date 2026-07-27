"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { signInWithCredentials, type SignInState } from "@/lib/auth/actions";

const initialState: SignInState = {};
const focusStyle = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-accent-strong)]";

export function SignInForm({ suggestedEmail }: { suggestedEmail?: string }) {
  const [state, formAction] = useActionState(signInWithCredentials, initialState);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!state.error || !panelRef.current) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    panelRef.current.animate(
      reducedMotion
        ? [
            { boxShadow: "var(--shadow-panel)" },
            { boxShadow: "0 0 0 2px color-mix(in oklch, var(--color-danger) 45%, transparent)" },
            { boxShadow: "var(--shadow-panel)" },
          ]
        : [
            { transform: "translateX(0)" },
            { transform: "translateX(-7px)" },
            { transform: "translateX(6px)" },
            { transform: "translateX(-4px)" },
            { transform: "translateX(3px)" },
            { transform: "translateX(0)" },
          ],
      { duration: reducedMotion ? 220 : 320, easing: "ease-out" }
    );
  }, [state]);

  return (
    <div ref={panelRef} className="rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-panel)]">
      <h1 className="text-[1.125rem] font-semibold text-[var(--color-ink)]">Sign in</h1>

      <form action={formAction} className="mt-5">
        <div className="grid gap-4">
          <label className="grid gap-2 text-[0.8125rem] font-medium text-[var(--color-ink)]">
            Email
            <input
              name="email"
              type="email"
              required
              aria-invalid={Boolean(state.error)}
              autoComplete="email"
              defaultValue={suggestedEmail}
              className={`min-h-11 rounded-control border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 text-[0.875rem] text-[var(--color-ink)] transition focus:border-[var(--color-accent-strong)] focus:bg-[var(--color-surface)] ${focusStyle}`}
            />
          </label>
          <label className="grid gap-2 text-[0.8125rem] font-medium text-[var(--color-ink)]">
            Password
            <input
              name="password"
              type="password"
              required
              aria-invalid={Boolean(state.error)}
              autoComplete="current-password"
              className={`min-h-11 rounded-control border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 text-[0.875rem] text-[var(--color-ink)] transition focus:border-[var(--color-accent-strong)] focus:bg-[var(--color-surface)] ${focusStyle}`}
            />
          </label>

          {state.error ? (
            <p role="alert" aria-live="assertive" className="rounded-panel border border-[color-mix(in_oklch,var(--color-danger)_38%,transparent)] bg-[color-mix(in_oklch,var(--color-danger)_10%,transparent)] px-3 py-2 text-[0.8125rem] text-[var(--color-danger)]">
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
      aria-busy={pending}
      className={`inline-flex min-h-11 w-full items-center justify-center rounded-control border border-[var(--color-ink)] bg-[var(--color-ink)] px-4 text-[0.875rem] font-medium text-[var(--color-bg)] transition hover:border-[var(--color-accent-strong)] hover:bg-[var(--color-accent-strong)] active:translate-y-px disabled:cursor-wait disabled:opacity-60 ${focusStyle}`}
    >
      {pending ? "Opening…" : label}
    </button>
  );
}
