import Link from "next/link";

export default function Landing() {
  return (
    <main className="min-h-screen mx-auto max-w-5xl px-6 py-20">
      <header className="flex items-center justify-between">
        <span className="text-lg font-semibold tracking-tight">Atlas</span>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/sign-in" className="text-neutral-500 hover:text-neutral-900">
            Sign in
          </Link>
          <Link href="/sign-up" className="rounded-full bg-neutral-900 px-4 py-1.5 text-white hover:bg-neutral-700">
            Get started
          </Link>
        </nav>
      </header>

      <section className="mt-24 max-w-3xl">
        <p className="text-sm font-medium uppercase tracking-widest text-neutral-400">The AI-native LMS</p>
        <h1 className="mt-4 text-5xl font-semibold leading-tight tracking-tight">
          The agent <em>is</em> the LMS.
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-neutral-600">
          Atlas builds and runs courses for professors, and tutors students inside them — every piece grounded in the
          professor&apos;s actual learning objectives. No instructional-design center. No copy-pasting to ChatGPT. No
          surprises on exam day.
        </p>
        <div className="mt-8 flex gap-3">
          <Link href="/sign-up" className="rounded-full bg-neutral-900 px-6 py-3 text-white hover:bg-neutral-700">
            Start a course
          </Link>
          <Link href="/sign-in" className="rounded-full border border-neutral-300 px-6 py-3 hover:border-neutral-900">
            I&apos;m a student
          </Link>
        </div>
      </section>

      <section className="mt-24 grid gap-8 md:grid-cols-2">
        <div className="rounded-2xl border border-neutral-200 p-6">
          <h2 className="text-xl font-semibold">For professors</h2>
          <p className="mt-2 text-neutral-600">
            &ldquo;Build a 14-week stats course aligned to these five outcomes.&rdquo; Atlas drafts the syllabus, modules,
            assignments, and rubrics — you review and approve. Roll a course forward in one click.
          </p>
        </div>
        <div className="rounded-2xl border border-neutral-200 p-6">
          <h2 className="text-xl font-semibold">For students</h2>
          <p className="mt-2 text-neutral-600">
            A tutor that lives inside the course, grounded in the real material and the syllabus. Always know whether
            you&apos;ve covered what will actually be assessed.
          </p>
        </div>
      </section>

      <footer className="mt-24 border-t border-neutral-200 pt-8 text-sm text-neutral-400">
        Atlas LMS · foundation build · see docs/Vision.md
      </footer>
    </main>
  );
}
