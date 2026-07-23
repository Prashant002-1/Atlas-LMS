import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { isInstructorLike } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { courses } from "@/lib/db/schema";
import { findEditableCourse } from "@/lib/instructor/workspace";
import {
  removeClassPolicy,
  saveClassPolicy,
  updateCourseDetails,
  updateGradeScale,
} from "@/lib/instructor/actions";
import {
  gradeBandsForCourse,
  parseClassPolicies,
  parseGradeScale,
  type ClassPolicy,
  type GradeBand,
} from "@/lib/course/policies";
import {
  listCourseAgentConfigHistory,
  loadActiveCourseAgentConfig,
  type CourseAgentConfiguration,
} from "@/lib/agent/course-agent-config";
import { PageHeader } from "@/components/teach/page-header";
import { ActionButton, ButtonLink, TextLink } from "@/components/atlas/primitives";
import { RecordDialog } from "@/components/teach/record-dialog";

/**
 * Course setup is the course control center: identity and offering facts,
 * the grade scale, class policies, the syllabus pointer, and the course
 * agent. Structure and materials live on their own pages; the agent is
 * changed in conversation with Atlas and reported here.
 */
export default async function TeachCourseSetupPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  if (!isInstructorLike(session.user.role)) redirect("/student");
  if (!session.user.orgId) redirect("/teach");

  const scoped = await findEditableCourse({ id: session.user.id, orgId: session.user.orgId, role: session.user.role });
  if (!scoped) redirect("/teach");

  const [course] = await db
    .select({
      id: courses.id,
      code: courses.code,
      name: courses.name,
      term: courses.term,
      description: courses.description,
      syllabusMd: courses.syllabusMd,
      status: courses.status,
      startDate: courses.startDate,
      endDate: courses.endDate,
      timeZone: courses.timeZone,
      importSource: courses.importSource,
      gradeScale: courses.gradeScale,
      classPolicies: courses.classPolicies,
      updatedAt: courses.updatedAt,
    })
    .from(courses)
    .where(and(eq(courses.orgId, session.user.orgId), eq(courses.id, scoped.id)))
    .limit(1);
  if (!course) redirect("/teach");

  const [activeConfig, history] = await Promise.all([
    loadActiveCourseAgentConfig(session.user.orgId, course.id),
    listCourseAgentConfigHistory(session.user.orgId, course.id),
  ]);

  const gradeBands = gradeBandsForCourse(course.gradeScale);
  const usesDefaultScale = parseGradeScale(course.gradeScale) === null;
  const classPolicies = parseClassPolicies(course.classPolicies);
  const configuration = activeConfig.configuration;
  const activeRules = configuration.rules.filter((rule) => rule.enabled);

  return (
    <>
      <PageHeader
        title="Course setup"
        course={`${course.code} / ${course.term ?? ""}`}
        action={<EditCourseDialog course={course} />}
      />

      <section aria-labelledby="course-overview-heading" className="pb-7">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,0.34fr)]">
          <div className="min-w-0">
            <h2 id="course-overview-heading" className="text-[1.125rem] font-semibold text-[var(--color-ink)]">{course.name}</h2>
            <p className="mt-2 max-w-3xl text-[0.84375rem] leading-6 text-[var(--color-muted)]">
              {course.description?.trim() || "No course description has been added."}
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-x-5 gap-y-4 text-[0.78125rem]">
            <CourseFact label="Code" value={course.code} mono />
            <CourseFact label="Status" value={course.status === "published" ? "Published" : titleCase(course.status)} />
            <CourseFact label="Term" value={course.term ?? "Not set"} />
            <CourseFact label="Time zone" value={course.timeZone ?? "Not set"} />
            <CourseFact label="Starts" value={course.startDate ? longDate(course.startDate) : "Not set"} />
            <CourseFact label="Ends" value={course.endDate ? longDate(course.endDate) : "Not set"} />
            <CourseFact label="Source" value={course.importSource ? titleCase(course.importSource.replaceAll("_", " ")) : "Created in Atlas"} />
          </dl>
        </div>
      </section>

      <section aria-labelledby="grade-scale-heading" className="py-8">
        <SectionLead
          id="grade-scale-heading"
          title="Grade scale"
          detail={usesDefaultScale ? "standard scale" : "course scale"}
          action={<GradeScaleDialog bands={gradeBands} />}
        />
        <dl className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          {gradeBands.map((band) => (
            <div key={band.letter} className="border-b border-[var(--color-border)] px-4 py-3 first:pl-0 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
              <dt className="atlas-mono text-[0.75rem] text-[var(--color-faint)]">{band.letter}</dt>
              <dd className="mt-1 text-[0.875rem] font-semibold tabular-nums text-[var(--color-ink)]">{band.min}{band.min > 0 ? "+" : ""}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="class-policies-heading" className="py-8">
        <SectionLead
          id="class-policies-heading"
          title="Class policies"
          detail={classPolicies.length > 0 ? `${classPolicies.length} on the syllabus` : undefined}
          action={<ClassPolicyDialog mode="create" />}
        />
        {classPolicies.length > 0 ? (
          <dl className="mt-4 divide-y divide-[var(--color-border)]">
            {classPolicies.map((policy) => (
              <div key={policy.title} className="grid gap-1.5 px-3 py-3.5 sm:grid-cols-[12rem_minmax(0,1fr)_auto] sm:gap-6">
                <dt className="text-[0.8125rem] font-medium text-[var(--color-ink)]">{policy.title}</dt>
                <dd className="min-w-0 text-[0.8125rem] leading-5 text-[var(--color-muted)]">{policy.body}</dd>
                <dd className="flex items-start gap-3">
                  <ClassPolicyDialog mode="edit" policy={policy} />
                  <form action={removeClassPolicy}>
                    <input type="hidden" name="title" value={policy.title} />
                    <button type="submit" className="text-[0.71875rem] font-medium text-[var(--color-faint)] underline decoration-[color-mix(in_oklch,currentColor_40%,transparent)] underline-offset-[3px] transition hover:text-[var(--color-ink)]">
                      Remove
                    </button>
                  </form>
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-4 px-3 py-5 text-[0.8125rem] text-[var(--color-muted)]">No class policies yet. Policies added here appear on the syllabus.</p>
        )}
      </section>

      <section aria-labelledby="syllabus-heading" className="py-8">
        <div className="mb-2 flex items-baseline justify-between gap-4">
          <h2 id="syllabus-heading" className="text-[1rem] font-semibold text-[var(--color-ink)]">Syllabus</h2>
          <span className="text-[0.6875rem] text-[var(--color-faint)]">Updated {longDate(course.updatedAt)}</span>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5 px-3 py-3.5">
          <p className="text-[0.8125rem] text-[var(--color-muted)]">{syllabusFact(course.syllabusMd)}</p>
          <TextLink href="/teach/syllabus" className="text-[0.78125rem]">Open the syllabus</TextLink>
        </div>
      </section>

      <section aria-labelledby="course-agent-heading" className="py-8">
        <SectionLead
          id="course-agent-heading"
          title="Course agent"
          detail={activeConfig.source === "versioned" ? `version ${activeConfig.version}` : "course default"}
          action={<ButtonLink href="/teach/atlas?thread=new" size="sm">Change with Atlas</ButtonLink>}
        />
        <p className="mt-1 max-w-3xl text-[0.75rem] leading-5 text-[var(--color-muted)]">
          How AI teaches in this course: the agent students meet in AI assignments and study work.
        </p>

        <dl className="mt-5 space-y-1">
          <ConfigRow label="Name" value={configuration.identity.name} />
          <ConfigRow label="Voice" value={configuration.identity.voice} />
          <ConfigRow label="Approach" value={configuration.teaching.approach} />
          <ConfigRow label="Student disclosure" value={activeConfig.studentDisclosure} />
        </dl>

        <dl className="mt-5 grid sm:grid-cols-2 lg:grid-cols-5">
          <BehaviorFact label="Socratic by default" value={configuration.teaching.socraticByDefault ? "Yes" : "No"} />
          <BehaviorFact label="Direct answers" value={directAnswerLabel(configuration.teaching.directAnswers)} />
          <BehaviorFact label="Challenge" value={titleCase(configuration.teaching.challengeLevel)} />
          <BehaviorFact label="Citations" value={configuration.teaching.citationMode === "required" ? "Required" : "When useful"} />
          <BehaviorFact label="Daily student turns" value={String(configuration.limits.studentDailyTurns)} />
        </dl>

        <dl className="mt-5 space-y-1">
          <BoundaryRow label="Supports" items={configuration.boundaries.supports} />
          <BoundaryRow label="Avoids" items={configuration.boundaries.avoids} />
          <BoundaryRow label="Escalates to professor" items={configuration.boundaries.escalatesWhen} />
        </dl>

        <div className="mt-7">
          <h3 className="text-[0.875rem] font-semibold text-[var(--color-ink)]">
            Course rules
            {configuration.rules.length > 0 ? (
              <span className="ml-2.5 text-[0.75rem] font-normal text-[var(--color-faint)]">{activeRules.length} active</span>
            ) : null}
          </h3>
          {configuration.rules.length > 0 ? (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[44rem] border-collapse text-left">
                <thead>
                  <tr className="text-[0.6875rem] text-[var(--color-faint)]">
                    <th scope="col" className="px-3 py-2.5 font-medium">Rule</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Instruction</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Applies to</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">State</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)] text-[0.78125rem]">
                  {configuration.rules.map((rule) => (
                    <tr key={rule.id}>
                      <th scope="row" className="px-3 py-3.5 align-top font-medium text-[var(--color-ink)]">{rule.title}</th>
                      <td className="max-w-xl px-3 py-3.5 align-top leading-5 text-[var(--color-muted)]">{rule.instruction}</td>
                      <td className="px-3 py-3.5 align-top text-[var(--color-muted)]">{rule.appliesTo.map(surfaceLabel).join(", ")}</td>
                      <td className={`px-3 py-3.5 align-top ${rule.enabled ? "text-[var(--color-muted)]" : "text-[var(--color-faint)]"}`}>{rule.enabled ? "Active" : "Off"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-3 px-3 py-4 text-[0.8125rem] text-[var(--color-muted)]">No additional course rules.</p>
          )}
        </div>

        <div className="mt-7">
          <h3 className="text-[0.875rem] font-semibold text-[var(--color-ink)]">
            Version history
            {history.length > 0 ? <span className="ml-2.5 text-[0.75rem] font-normal text-[var(--color-faint)]">{history.length} versions</span> : null}
          </h3>
          {history.length > 0 ? (
            <ol className="mt-3 divide-y divide-[var(--color-border)]">
              {history.map((item) => (
                <li key={item.id} className="grid gap-2 px-3 py-3.5 sm:grid-cols-[5rem_minmax(0,1fr)_auto] sm:items-start">
                  <span className="atlas-mono text-[0.71875rem] text-[var(--color-faint)]">v{item.version}</span>
                  <div className="min-w-0">
                    <p className="text-[0.8125rem] font-medium text-[var(--color-ink)]">{item.changeSummary}</p>
                    <p className="mt-0.5 text-[0.71875rem] leading-5 text-[var(--color-muted)]">
                      {item.createdByName ?? "Course instructor"}
                      {item.sourceSessionTitle ? (
                        <>
                          {" / "}
                          {item.sourceSessionId ? (
                            <TextLink href={`/teach/atlas?thread=${item.sourceSessionId}`} className="text-[0.71875rem]">{item.sourceSessionTitle}</TextLink>
                          ) : (
                            item.sourceSessionTitle
                          )}
                        </>
                      ) : null}
                    </p>
                  </div>
                  <time className="text-[0.6875rem] text-[var(--color-faint)]" dateTime={item.createdAt.toISOString()}>{formatStamp(item.createdAt)}</time>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 px-3 py-4 text-[0.8125rem] text-[var(--color-muted)]">No versions. The agent runs on the course default.</p>
          )}
        </div>
      </section>
    </>
  );
}

function EditCourseDialog({ course }: { course: { name: string; description: string | null } }) {
  return (
    <RecordDialog
      mode="edit"
      triggerLabel="Edit course"
      title="Edit course"
      description="Course codes and offering dates are managed by the institution."
      triggerVariant="secondary"
    >
      <form action={updateCourseDetails} className="grid gap-4">
        <label className="grid gap-1.5 text-[0.75rem] font-medium">
          Name
          <input name="name" type="text" required autoFocus maxLength={200} defaultValue={course.name} className={fieldClass} />
        </label>
        <label className="grid gap-1.5 text-[0.75rem] font-medium">
          Description
          <textarea name="description" rows={4} maxLength={2000} defaultValue={course.description ?? ""} className={`${fieldClass} min-h-24 resize-y py-2.5 leading-6`} />
        </label>
        <div className="flex justify-end pt-4">
          <ActionButton>Save course</ActionButton>
        </div>
      </form>
    </RecordDialog>
  );
}

const SCALE_ROWS = 13;

function GradeScaleDialog({ bands }: { bands: GradeBand[] }) {
  return (
    <RecordDialog
      mode="edit"
      triggerLabel="Edit scale"
      title="Edit grade scale"
      description="Letters A to F with an optional + or -. Blank rows are ignored; the lowest band starts at 0."
      triggerVariant="secondary"
    >
      <form action={updateGradeScale} className="grid gap-3">
        <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-x-4 text-[0.6875rem] font-medium text-[var(--color-faint)]">
          <span>Letter</span>
          <span>From score</span>
        </div>
        {Array.from({ length: SCALE_ROWS }, (_, index) => (
          <div key={index} className="grid grid-cols-[5rem_minmax(0,1fr)] gap-x-4">
            <input
              name={`letter${index}`}
              type="text"
              maxLength={2}
              defaultValue={bands[index]?.letter ?? ""}
              className={`${fieldClass} atlas-mono uppercase`}
              aria-label={`Band ${index + 1} letter`}
            />
            <input
              name={`min${index}`}
              type="number"
              min={0}
              max={100}
              step="0.1"
              defaultValue={bands[index]?.min ?? ""}
              className={`${fieldClass} tabular-nums`}
              aria-label={`Band ${index + 1} minimum score`}
            />
          </div>
        ))}
        <div className="flex justify-end pt-3">
          <ActionButton>Save scale</ActionButton>
        </div>
      </form>
    </RecordDialog>
  );
}

function ClassPolicyDialog({ mode, policy }: { mode: "create" | "edit"; policy?: ClassPolicy }) {
  return (
    <RecordDialog
      mode={mode}
      triggerLabel={mode === "create" ? "New policy" : "Edit"}
      title={mode === "create" ? "New class policy" : "Edit class policy"}
      description="Class policies appear on the syllabus."
      triggerVariant={mode === "create" ? "primary" : "quiet"}
    >
      <form action={saveClassPolicy} className="grid gap-4">
        {policy ? <input type="hidden" name="originalTitle" value={policy.title} /> : null}
        <label className="grid gap-1.5 text-[0.75rem] font-medium">
          Title
          <input name="title" type="text" required autoFocus maxLength={80} defaultValue={policy?.title ?? ""} placeholder="Late work" className={fieldClass} />
        </label>
        <label className="grid gap-1.5 text-[0.75rem] font-medium">
          Policy
          <textarea name="body" rows={4} required maxLength={1000} defaultValue={policy?.body ?? ""} className={`${fieldClass} min-h-24 resize-y py-2.5 leading-6`} />
        </label>
        <div className="flex justify-end pt-4">
          <ActionButton>{mode === "create" ? "Add policy" : "Save policy"}</ActionButton>
        </div>
      </form>
    </RecordDialog>
  );
}

function SectionLead({ id, title, detail, action }: { id: string; title: string; detail?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-3">
      <h2 id={id} className="text-[1rem] font-semibold text-[var(--color-ink)]">
        {title}
        {detail ? <span className="ml-2.5 text-[0.75rem] font-normal text-[var(--color-faint)]">{detail}</span> : null}
      </h2>
      {action}
    </div>
  );
}

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 px-3 py-3 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-6">
      <dt className="text-[0.75rem] text-[var(--color-faint)]">{label}</dt>
      <dd className="min-w-0 text-[0.8125rem] font-medium leading-5 text-[var(--color-ink)]">{value}</dd>
    </div>
  );
}

function BehaviorFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-[var(--color-border)] px-4 py-3.5 first:pl-0 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <dt className="text-[0.6875rem] text-[var(--color-faint)]">{label}</dt>
      <dd className="mt-1 text-[0.8125rem] font-medium text-[var(--color-ink)]">{value}</dd>
    </div>
  );
}

function BoundaryRow({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="grid gap-1.5 px-3 py-3 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-6">
      <dt className="text-[0.75rem] font-medium text-[var(--color-ink)]">{label}</dt>
      <dd className="min-w-0">
        {items.length > 0 ? (
          <ul className="space-y-1 text-[0.78125rem] leading-5 text-[var(--color-muted)]">
            {items.map((item, index) => <li key={`${label}-${index}`}>{item}</li>)}
          </ul>
        ) : (
          <p className="text-[0.75rem] text-[var(--color-faint)]">None</p>
        )}
      </dd>
    </div>
  );
}

function CourseFact({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[0.6875rem] text-[var(--color-faint)]">{label}</dt>
      <dd className={`mt-1 font-medium text-[var(--color-ink)] ${mono ? "atlas-mono" : ""}`}>{value}</dd>
    </div>
  );
}

function directAnswerLabel(value: CourseAgentConfiguration["teaching"]["directAnswers"]) {
  return { never: "Never", after_attempt: "After an attempt", when_asked: "When asked" }[value];
}

function surfaceLabel(value: "study" | "assignment") {
  return value === "study" ? "Study" : "AI assignments";
}

function syllabusFact(syllabusMd: string | null): string {
  const text = syllabusMd?.trim();
  if (!text) return "No syllabus text yet.";
  const words = text.split(/\s+/).length;
  return `${words.toLocaleString("en-US")} ${words === 1 ? "word" : "words"}`;
}

function longDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatStamp(value: Date) {
  return value.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

const fieldClass = "min-h-10 rounded-control border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 text-[0.8125rem] text-[var(--color-ink)] outline-none transition placeholder:text-[var(--color-faint)] focus:border-[var(--color-accent-strong)] focus:bg-[var(--color-surface)]";
