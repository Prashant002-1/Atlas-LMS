import { auth } from "@/lib/auth";
import { loadStudentAtlasPolicies } from "@/lib/student/atlas";
import { disclosureLabel } from "@/lib/agent/org-policy";
import { PageHeader } from "@/components/teach/page-header";

/**
 * The rules Atlas works under for this student, stated plainly: the
 * university's policy, each course's rules, and the fixed platform rules.
 * Everything here is the same data the runtime enforces.
 */
export default async function StudentAtlasPoliciesPage() {
  const session = await auth();
  const view = await loadStudentAtlasPolicies(session?.user);

  if (view.problem) {
    return (
      <>
        <PageHeader title="Policies" />
        <p className="max-w-lg text-[0.875rem] leading-6 text-[var(--color-muted)]">{view.problem.detail}</p>
      </>
    );
  }

  const policy = view.policy.policy;

  return (
    <>
      <PageHeader title="Policies" />

      <section aria-labelledby="university-heading" className="pb-8">
        <h2 id="university-heading" className="text-[1rem] font-semibold text-[var(--color-ink)]">University policy</h2>
        <p className="mt-1 text-[0.75rem] text-[var(--color-faint)]">
          {policy.authorityLabel}
          {view.policy.source === "versioned" ? ` / version ${view.policy.version}` : ""}
        </p>
        <p className="mt-4 max-w-3xl px-3 text-[0.875rem] leading-6 text-[var(--color-ink)]">{policy.statement}</p>

        <div className="mt-6 grid gap-8 md:grid-cols-2">
          <div>
            <h3 className="text-[0.75rem] font-medium uppercase tracking-[0.06em] text-[var(--color-faint)]">You can</h3>
            <ul className="mt-2 divide-y divide-[var(--color-border)] text-[0.8125rem] leading-5 text-[var(--color-muted)]">
              {policy.permittedUses.map((use, index) => (
                <li key={`p-${index}`} className="px-3 py-2.5">{use}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-[0.75rem] font-medium uppercase tracking-[0.06em] text-[var(--color-faint)]">You cannot</h3>
            <ul className="mt-2 divide-y divide-[var(--color-border)] text-[0.8125rem] leading-5 text-[var(--color-muted)]">
              {policy.prohibitedUses.map((use, index) => (
                <li key={`x-${index}`} className="px-3 py-2.5">{use}</li>
              ))}
            </ul>
          </div>
        </div>

        <dl className="mt-6 space-y-1">
          <PolicyRow label="Disclosure" value={disclosureLabel(policy.disclosureRequirement)} />
          <PolicyRow label="Your data" value={policy.dataNotice} />
          <PolicyRow label="People first" value={policy.notASubstitute} />
          <PolicyRow label="Daily limit" value={`${policy.dailyTurnLimit} messages per rolling day`} />
        </dl>

        {policy.escalationContacts.length > 0 ? (
          <div className="mt-6">
            <h3 className="text-[0.75rem] font-medium uppercase tracking-[0.06em] text-[var(--color-faint)]">Who to reach</h3>
            <dl className="mt-2 divide-y divide-[var(--color-border)]">
              {policy.escalationContacts.map((contact, index) => (
                <div key={`c-${index}`} className="grid gap-1 px-3 py-2.5 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-6">
                  <dt className="text-[0.78125rem] font-medium text-[var(--color-ink)]">{contact.label}</dt>
                  <dd className="text-[0.8125rem] text-[var(--color-muted)]">{contact.contact}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
      </section>

      <section aria-labelledby="course-rules-heading" className="py-8">
        <h2 id="course-rules-heading" className="text-[1rem] font-semibold text-[var(--color-ink)]">Course rules</h2>
        <p className="mt-1 text-[0.75rem] text-[var(--color-muted)]">Set by each professor. They apply when Atlas works with material and AI assignments in that course.</p>
        {view.courseRules.length > 0 ? (
          <div className="mt-4 space-y-8">
            {view.courseRules.map((course) => (
              <div key={course.courseId}>
                <h3 className="px-3 text-[0.875rem] font-semibold text-[var(--color-ink)]">
                  <span className="atlas-mono mr-2 text-[0.75rem] font-normal text-[var(--color-faint)]">{course.code}</span>
                  {course.name}
                </h3>
                <dl className="mt-2 grid sm:grid-cols-2 lg:grid-cols-4">
                  <CourseFact label="Direct answers" value={directAnswerLabel(course.directAnswers)} />
                  <CourseFact label="Citations" value={course.citations === "required" ? "Required" : "When useful"} />
                  <CourseFact label="Daily turns in course" value={String(course.dailyTurns)} />
                  <CourseFact label="Agent" value={course.agentName} />
                </dl>
                <p className="mt-2 px-3 text-[0.78125rem] leading-5 text-[var(--color-muted)]">{course.disclosure}</p>
                {course.studyRules.length > 0 ? (
                  <ul className="mt-2 divide-y divide-[var(--color-border)]">
                    {course.studyRules.map((rule, index) => (
                      <li key={`${course.courseId}-${index}`} className="px-3 py-2.5 text-[0.8125rem] leading-5">
                        <span className="font-medium text-[var(--color-ink)]">{rule.title}.</span>{" "}
                        <span className="text-[var(--color-muted)]">{rule.instruction}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 px-3 py-5 text-[0.8125rem] text-[var(--color-muted)]">No active enrollments.</p>
        )}
      </section>

      <section aria-labelledby="fixed-heading" className="py-8">
        <h2 id="fixed-heading" className="text-[1rem] font-semibold text-[var(--color-ink)]">Always in effect</h2>
        <p className="mt-1 text-[0.75rem] text-[var(--color-muted)]">Platform rules that no policy can loosen.</p>
        <ul className="mt-3 divide-y divide-[var(--color-border)] text-[0.8125rem] leading-5 text-[var(--color-muted)]">
          {view.fixedRules.map((rule, index) => (
            <li key={`f-${index}`} className="px-3 py-2.5">{rule}</li>
          ))}
        </ul>
      </section>
    </>
  );
}

function PolicyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 px-3 py-3 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-6">
      <dt className="text-[0.75rem] text-[var(--color-faint)]">{label}</dt>
      <dd className="min-w-0 text-[0.8125rem] leading-5 text-[var(--color-ink)]">{value}</dd>
    </div>
  );
}

function CourseFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-[var(--color-border)] px-4 py-3 first:pl-3 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <dt className="text-[0.6875rem] text-[var(--color-faint)]">{label}</dt>
      <dd className="mt-1 text-[0.8125rem] font-medium text-[var(--color-ink)]">{value}</dd>
    </div>
  );
}

function directAnswerLabel(value: "never" | "after_attempt" | "when_asked") {
  return { never: "Never", after_attempt: "After an attempt", when_asked: "When asked" }[value];
}
