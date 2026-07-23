import { auth } from "@/lib/auth";
import { loadStudentAtlasProfile } from "@/lib/student/atlas";
import { PageHeader } from "@/components/teach/page-header";
import { TextLink } from "@/components/atlas/primitives";

/**
 * What Atlas knows about this student: standing from the record, strengths
 * and gaps from graded topic scores, session results, and the agent's own
 * durable observations. Composed from rows on every render; display only.
 */
export default async function StudentAtlasProfilePage() {
  const session = await auth();
  const view = await loadStudentAtlasProfile(session?.user);

  if (view.problem) {
    return (
      <>
        <PageHeader title="Profile" />
        <p className="max-w-lg text-[0.875rem] leading-6 text-[var(--color-muted)]">{view.problem.detail}</p>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Profile" course={view.studentName} />

      <section aria-labelledby="standing-heading" className="pb-8">
        <h2 id="standing-heading" className="text-[1rem] font-semibold text-[var(--color-ink)]">Standing</h2>
        {view.standing.length > 0 ? (
          <dl className="mt-3 divide-y divide-[var(--color-border)]">
            {view.standing.map((row) => (
              <div key={row.courseId} className="grid gap-1 px-3 py-3 sm:grid-cols-[10rem_minmax(0,1fr)_auto] sm:items-baseline sm:gap-6">
                <dt className="atlas-mono text-[0.75rem] text-[var(--color-faint)]">{row.code}</dt>
                <dd className="min-w-0 truncate text-[0.8125rem] text-[var(--color-ink)]">{row.name}</dd>
                <dd className="text-[0.8125rem] font-medium tabular-nums text-[var(--color-ink)]">{row.standing}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-3 px-3 py-5 text-[0.8125rem] text-[var(--color-muted)]">No active enrollments.</p>
        )}
      </section>

      <section aria-labelledby="topics-heading" className="py-8">
        <h2 id="topics-heading" className="text-[1rem] font-semibold text-[var(--color-ink)]">Strengths and gaps</h2>
        <p className="mt-1 text-[0.75rem] text-[var(--color-muted)]">From graded work with topic scores.</p>
        <div className="mt-4 grid gap-8 md:grid-cols-2">
          <div>
            <h3 className="text-[0.75rem] font-medium uppercase tracking-[0.06em] text-[var(--color-faint)]">Strong</h3>
            {view.strengths.length > 0 ? (
              <ul className="mt-2 divide-y divide-[var(--color-border)]">
                {view.strengths.map((fact, index) => (
                  <li key={`s-${index}`} className="flex items-baseline justify-between gap-3 px-3 py-2.5">
                    <span className="min-w-0 text-[0.8125rem] text-[var(--color-ink)]">
                      {fact.topic}
                      <span className="ml-2 text-[0.71875rem] text-[var(--color-faint)]">{fact.course} / {fact.examLabel}</span>
                    </span>
                    <span className="atlas-mono shrink-0 text-[0.75rem] tabular-nums text-[var(--color-muted)]">{fact.score}/{fact.max}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 px-3 py-4 text-[0.78125rem] text-[var(--color-muted)]">Nothing stands out yet.</p>
            )}
          </div>
          <div>
            <h3 className="text-[0.75rem] font-medium uppercase tracking-[0.06em] text-[var(--color-faint)]">Needs work</h3>
            {view.gaps.length > 0 ? (
              <ul className="mt-2 divide-y divide-[var(--color-border)]">
                {view.gaps.map((fact, index) => (
                  <li key={`g-${index}`} className="flex items-baseline justify-between gap-3 px-3 py-2.5">
                    <span className="min-w-0 text-[0.8125rem] text-[var(--color-ink)]">
                      {fact.topic}
                      <span className="ml-2 text-[0.71875rem] text-[var(--color-faint)]">{fact.course} / {fact.examLabel}</span>
                    </span>
                    <span className="atlas-mono shrink-0 text-[0.75rem] tabular-nums text-[var(--color-muted)]">{fact.score}/{fact.max}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 px-3 py-4 text-[0.78125rem] text-[var(--color-muted)]">No graded gaps on record.</p>
            )}
          </div>
        </div>
      </section>

      {view.sessionReports.length > 0 ? (
        <section aria-labelledby="sessions-heading" className="py-8">
          <h2 id="sessions-heading" className="text-[1rem] font-semibold text-[var(--color-ink)]">AI assignment results</h2>
          <ul className="mt-3 divide-y divide-[var(--color-border)]">
            {view.sessionReports.map((report, index) => (
              <li key={`r-${index}`} className="flex items-baseline justify-between gap-3 px-3 py-2.5">
                <span className="min-w-0 truncate text-[0.8125rem] text-[var(--color-ink)]">
                  {report.assignment}
                  <span className="ml-2 text-[0.71875rem] text-[var(--color-faint)]">{report.course}</span>
                </span>
                <span className="shrink-0 text-[0.78125rem] tabular-nums text-[var(--color-muted)]">
                  {report.score}{report.status === "draft" ? " / draft" : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="observations-heading" className="py-8">
        <h2 id="observations-heading" className="text-[1rem] font-semibold text-[var(--color-ink)]">
          What Atlas remembers
          {view.observations.length > 0 ? (
            <span className="ml-2.5 text-[0.75rem] font-normal text-[var(--color-faint)]">{view.observations.length} notes</span>
          ) : null}
        </h2>
        {view.observations.length > 0 ? (
          <ul className="mt-3 divide-y divide-[var(--color-border)]">
            {view.observations.map((observation, index) => (
              <li key={`o-${index}`} className="grid gap-1 px-3 py-3 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-6">
                <span className="text-[0.71875rem] uppercase tracking-[0.06em] text-[var(--color-faint)]">
                  {observation.kind}
                  {observation.course ? <span className="atlas-mono ml-1.5 normal-case tracking-normal">{observation.course}</span> : null}
                </span>
                <span className="min-w-0 text-[0.8125rem] leading-5 text-[var(--color-ink)]">{observation.content}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 px-3 py-4 text-[0.8125rem] text-[var(--color-muted)]">
            Nothing yet. Atlas records observations as you work with it.
          </p>
        )}
      </section>

      <section aria-labelledby="cando-heading" className="py-8">
        <h2 id="cando-heading" className="text-[1rem] font-semibold text-[var(--color-ink)]">What Atlas can do</h2>
        <ul className="mt-3 divide-y divide-[var(--color-border)] text-[0.8125rem] leading-5 text-[var(--color-muted)]">
          <li className="px-3 py-2.5">Explain published course material within each course's rules</li>
          <li className="px-3 py-2.5">Plan study time around what is due and where points were lost</li>
          <li className="px-3 py-2.5">Track assignments, dates, and announcements across your courses</li>
          <li className="px-3 py-2.5">Read your own grades and results with you</li>
        </ul>
        <p className="mt-3 px-3 text-[0.75rem] text-[var(--color-muted)]">
          The rules it works under are on <TextLink href="/student/atlas/policies" className="text-[0.75rem]">Policies</TextLink>.
        </p>
      </section>
    </>
  );
}
