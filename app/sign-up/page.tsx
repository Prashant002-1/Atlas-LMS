import { BrandMark, ButtonLink } from "@/components/atlas/primitives";

/**
 * Atlas accounts come from the institution (or the seeded demo package) — there
 * is no self-serve registration yet. This page says so instead of pretending.
 */
export default function SignUpPage() {
  return (
    <main className="atlas-app-bg flex min-h-screen items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm text-center">
        <div className="mb-8 flex justify-center">
          <BrandMark />
        </div>
        <div className="rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-panel)]">
          <h1 className="text-[18px] font-semibold text-[var(--color-ink)]">Joining a course?</h1>
          <p className="mt-2 text-[14px] leading-6 text-[var(--color-muted)]">
            Atlas accounts are provisioned by your institution. If your course runs on Atlas, your
            instructor or admin will send your sign-in.
          </p>
          <div className="mt-5">
            <ButtonLink href="/sign-in" icon={false}>
              Sign in
            </ButtonLink>
          </div>
        </div>
      </div>
    </main>
  );
}
