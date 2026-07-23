import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isInstructorLike } from "@/lib/auth/session";
import { findEditableCourse } from "@/lib/instructor/workspace";
import { loadCourseSyllabus, type SyllabusAssignment } from "@/lib/instructor/syllabus";
import { updateCourseSyllabus } from "@/lib/instructor/actions";
import { PageHeader } from "@/components/teach/page-header";
import { ActionButton, TextLink } from "@/components/atlas/primitives";
import { Markdown } from "@/components/agent/markdown";
import { RecordDialog } from "@/components/teach/record-dialog";

/**
 * The syllabus: one course overview a professor can hand to students. The
 * professor writes the body; the schedule, the work, the grading bands, and
 * the course policies below it are composed from live rows on every render,
 * so they always match the course record.
 */
export default async function TeachSyllabusPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  if (!isInstructorLike(session.user.role)) redirect("/student");
  if (!session.user.orgId) redirect("/teach");

  const scoped = await findEditableCourse({ id: session.user.id, orgId: session.user.orgId, role: session.user.role });
  if (!scoped) redirect("/teach");

  const syllabus = await loadCourseSyllabus(session.user.orgId, scoped.id);
  if (!syllabus) redirect("/teach");

  const { course, instructors, weeks, work, publishedPoints, gradeBands, classPolicies, agent } = syllabus;
  const configuration = agent.configuration;
  const activeRules = configuration.rules.filter((rule) => rule.enabled);

  return (
    <>
      <PageHeader
        title="Syllabus"
        course={`${course.code} / ${course.term ?? ""}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <EditSyllabusDialog syllabusMd={course.syllabusMd} />
            <button
              type="button"
              disabled
              aria-disabled="true"
              title="PDF export is planned"
              className="inline-flex min-h-9 cursor-not-allowed items-center rounded-control border border-[var(--color-border)] px-3 text-[0.8125rem] font-medium text-[var(--color-faint)]"
            >
              Export PDF
            </button>
          </div>
        }
      />

      <section aria-labelledby="syllabus-course-heading" className="pb-7">
        <h2 id="syllabus-course-heading" className="text-[1.125rem] font-semibold text-[var(--color-ink)]">{course.name}</h2>
        {course.description?.trim() ? (
          <p className="mt-2 max-w-3xl text-[0.84375rem] leading-6 text-[var(--color-muted)]">{course.description}</p>
        ) : null}
        <dl className="mt-6 grid sm:grid-cols-2 lg:grid-cols-4">
          <BandFact label="Term" value={course.term ?? "Not set"} />
          <BandFact label="Starts" value={course.startDate ? longDate(course.startDate) : "Not set"} />
          <BandFact label="Ends" value={course.endDate ? longDate(course.endDate) : "Not set"} />
          <BandFact label="Graded points" value={formatPoints(publishedPoints)} />
        </dl>
      </section>

      {instructors.length > 0 ? (
        <section aria-labelledby="syllabus-instructor-heading" className="py-7">
          <h2 id="syllabus-instructor-heading" className="text-[1rem] font-semibold text-[var(--color-ink)]">
            {instructors.length === 1 ? "Instructor" : "Instructors"}
          </h2>
          <ul className="mt-4 divide-y divide-[var(--color-border)]">
            {instructors.map((person) => (
              <li key={person.id} className="grid gap-x-6 gap-y-1.5 px-3 py-3.5 sm:grid-cols-[minmax(0,0.42fr)_minmax(0,1fr)]">
                <div className="min-w-0">
                  <p className="text-[0.875rem] font-medium text-[var(--color-ink)]">{person.name}</p>
                  {person.title ? <p className="mt-0.5 text-[0.75rem] leading-5 text-[var(--color-muted)]">{person.title}</p> : null}
                </div>
                <dl className="grid gap-x-6 gap-y-1.5 text-[0.78125rem] sm:grid-cols-3">
                  <InlineFact label="Email" value={person.email} />
                  {person.officeLocation ? <InlineFact label="Office" value={person.officeLocation} /> : null}
                  {person.officeHours ? <InlineFact label="Office hours" value={person.officeHours} /> : null}
                </dl>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="syllabus-text-heading" className="py-7">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="syllabus-text-heading" className="text-[1rem] font-semibold text-[var(--color-ink)]">Course syllabus</h2>
          <span className="text-[0.6875rem] text-[var(--color-faint)]">Updated {longDate(course.updatedAt)}</span>
        </div>
        {course.syllabusMd?.trim() ? (
          <div className="mt-4 max-w-3xl">
            <Markdown className="text-[0.84375rem] leading-7">{course.syllabusMd}</Markdown>
          </div>
        ) : (
          <p className="mt-4 py-6 text-[0.8125rem] text-[var(--color-muted)]">
            No syllabus text yet.
          </p>
        )}
      </section>

      <section aria-labelledby="syllabus-schedule-heading" className="py-7">
        <h2 id="syllabus-schedule-heading" className="text-[1rem] font-semibold text-[var(--color-ink)]">Weekly schedule</h2>
        {weeks.length > 0 ? (
          <ol className="mt-4 divide-y divide-[var(--color-border)]">
            {weeks.map((week) => (
              <li key={week.id} className="px-3 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="text-[0.875rem] font-medium text-[var(--color-ink)]">
                    <TextLink href={`/teach/week/${week.id}`}>{week.name}</TextLink>
                    {!week.published ? <span className="ml-2 text-[0.75rem] font-normal text-[var(--color-muted)]">Draft</span> : null}
                  </p>
                  {week.opensAt ? (
                    <span className="text-[0.71875rem] text-[var(--color-faint)]">Opens {longDate(week.opensAt)}</span>
                  ) : null}
                </div>
                {week.summaryMd?.trim() ? (
                  <div className="mt-2 max-w-3xl">
                    <Markdown className="text-[0.78125rem] leading-6 text-[var(--color-muted)]">{week.summaryMd}</Markdown>
                  </div>
                ) : null}
                {week.due.length > 0 ? (
                  <dl className="mt-2.5 grid gap-1 text-[0.78125rem]">
                    {week.due.map((item) => (
                      <div key={item.id} className="flex flex-wrap items-baseline gap-x-2">
                        <dt className="text-[var(--color-faint)]">Due</dt>
                        <dd className="min-w-0">
                          <TextLink href={`/teach/assignments/${item.id}`} className="text-[0.78125rem]">{item.name}</TextLink>
                          <span className="ml-2 text-[var(--color-muted)]">{workFacts(item)}</span>
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-4 py-6 text-[0.8125rem] text-[var(--color-muted)]">
            No modules yet. The schedule fills in from the course modules.
          </p>
        )}
      </section>

      <section aria-labelledby="syllabus-grading-heading" className="py-7">
        <h2 id="syllabus-grading-heading" className="text-[1rem] font-semibold text-[var(--color-ink)]">Assignments and grading</h2>
        {work.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[34rem] border-collapse text-left">
              <thead>
                <tr className="text-[0.6875rem] text-[var(--color-faint)]">
                  <th scope="col" className="px-3 py-2.5 font-medium">Assignment</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Due</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)] text-[0.78125rem]">
                {work.map((item) => (
                  <tr key={item.id}>
                    <th scope="row" className="px-3 py-3 align-top font-medium text-[var(--color-ink)]">
                      <TextLink href={`/teach/assignments/${item.id}`} className="text-[0.78125rem]">{item.name}</TextLink>
                      {item.session ? <span className="ml-2 font-normal text-[var(--color-muted)]">AI assignment</span> : null}
                      {!item.published ? <span className="ml-2 font-normal text-[var(--color-muted)]">Draft</span> : null}
                    </th>
                    <td className="px-3 py-3 align-top text-[var(--color-muted)]">{item.dueAt ? longDate(item.dueAt) : "No due date"}</td>
                    <td className="px-3 py-3 text-right align-top tabular-nums text-[var(--color-muted)]">
                      {typeof item.pointsPossible === "number" ? formatPoints(item.pointsPossible) : "No points"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 py-6 text-[0.8125rem] text-[var(--color-muted)]">
            No assignments yet.
          </p>
        )}
        <dl className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-1.5 text-[0.78125rem]">
          <InlineFact label="Graded points" value={formatPoints(publishedPoints)} />
          <InlineFact label="Letter grades" value={gradeBands.map((band) => (band.min > 0 ? `${band.letter} ${band.min}+` : `${band.letter} below ${previousBandMin(gradeBands)}`)).join(" / ")} />
        </dl>
      </section>

      <section aria-labelledby="syllabus-policies-heading" className="py-7">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="syllabus-policies-heading" className="text-[1rem] font-semibold text-[var(--color-ink)]">Course policies</h2>
          <TextLink href="/teach/course" className="text-[0.75rem]">Course setup</TextLink>
        </div>
        {classPolicies.length > 0 ? (
          <dl className="mt-4 divide-y divide-[var(--color-border)]">
            {classPolicies.map((policy) => (
              <div key={policy.title} className="grid gap-x-6 gap-y-1 px-3 py-3 sm:grid-cols-[minmax(0,0.32fr)_minmax(0,1fr)] text-[0.78125rem]">
                <dt className="font-medium text-[var(--color-ink)]">{policy.title}</dt>
                <dd className="leading-5 text-[var(--color-muted)]">{policy.body}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </section>

      <section aria-labelledby="syllabus-ai-heading" className="py-7">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="syllabus-ai-heading" className="text-[1rem] font-semibold text-[var(--color-ink)]">AI in this course</h2>
          <TextLink href="/teach/course" className="text-[0.75rem]">Course agent</TextLink>
        </div>
        <dl className="mt-4 grid sm:grid-cols-2 lg:grid-cols-5">
          <BandFact label="Course agent" value={configuration.identity.name} />
          <BandFact label="Direct answers" value={directAnswerLabel(configuration.teaching.directAnswers)} />
          <BandFact label="Citations" value={configuration.teaching.citationMode === "required" ? "Required" : "When useful"} />
          <BandFact label="Challenge" value={titleCase(configuration.teaching.challengeLevel)} />
          <BandFact label="Daily student turns" value={String(configuration.limits.studentDailyTurns)} />
        </dl>
        {activeRules.length > 0 ? (
          <ul className="mt-5 divide-y divide-[var(--color-border)]">
            {activeRules.map((rule) => (
              <li key={rule.id} className="grid gap-x-6 gap-y-1 px-3 py-3 sm:grid-cols-[minmax(0,0.32fr)_minmax(0,1fr)] text-[0.78125rem]">
                <span className="font-medium text-[var(--color-ink)]">{rule.title}</span>
                <span className="leading-5 text-[var(--color-muted)]">{rule.instruction}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </>
  );
}

function EditSyllabusDialog({ syllabusMd }: { syllabusMd: string | null }) {
  return (
    <RecordDialog mode="edit" triggerLabel="Edit syllabus" title="Edit syllabus" wide>
      <form action={updateCourseSyllabus} className="grid gap-4">
        <label className="grid gap-1.5 text-[0.75rem] font-medium">
          Syllabus
          <textarea
            name="syllabus"
            rows={26}
            maxLength={80000}
            autoFocus
            defaultValue={syllabusMd ?? ""}
            className={`${fieldClass} atlas-mono min-h-[60vh] resize-y py-3 text-[0.75rem] leading-6`}
          />
        </label>
        <div className="flex justify-end pt-4">
          <ActionButton>Save syllabus</ActionButton>
        </div>
      </form>
    </RecordDialog>
  );
}

function BandFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-[var(--color-border)] px-4 py-3.5 first:pl-0 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <dt className="text-[0.6875rem] text-[var(--color-faint)]">{label}</dt>
      <dd className="mt-1 text-[0.8125rem] font-medium leading-5 text-[var(--color-ink)]">{value}</dd>
    </div>
  );
}

function InlineFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-baseline gap-2">
      <dt className="shrink-0 text-[var(--color-faint)]">{label}</dt>
      <dd className="min-w-0 break-words font-medium text-[var(--color-ink)]">{value}</dd>
    </div>
  );
}

function workFacts(item: SyllabusAssignment): string {
  const facts: string[] = [];
  if (item.dueAt) facts.push(longDate(item.dueAt));
  if (typeof item.pointsPossible === "number") facts.push(formatPoints(item.pointsPossible));
  if (item.session) facts.push("AI assignment");
  if (!item.published) facts.push("Draft");
  return facts.join(" / ");
}

function formatPoints(value: number): string {
  const rounded = Number.isInteger(value) ? value : Math.round(value * 100) / 100;
  return `${rounded} pts`;
}

/** The lowest positive band's floor, for the "below N" phrasing. */
function previousBandMin(bands: Array<{ letter: string; min: number }>): number {
  const sorted = bands.filter((band) => band.min > 0).sort((a, b) => a.min - b.min);
  return sorted[0]?.min ?? 60;
}

function directAnswerLabel(value: "never" | "after_attempt" | "when_asked") {
  return { never: "Never", after_attempt: "After an attempt", when_asked: "When asked" }[value];
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function longDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const fieldClass =
  "min-h-10 rounded-control border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 text-[0.8125rem] text-[var(--color-ink)] outline-none transition placeholder:text-[var(--color-faint)] focus:border-[var(--color-accent-strong)] focus:bg-[var(--color-surface)]";
