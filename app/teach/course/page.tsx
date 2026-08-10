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
import type { CourseAgentDirective } from "@/lib/agent/course-agent-directives";
import { PageHeader } from "@/components/teach/page-header";
import { ActionButton, ButtonLink, TextLink } from "@/components/atlas/primitives";
import { RecordDialog } from "@/components/teach/record-dialog";
import { RichTextEditor } from "@/components/teach/rich-text-editor";
import { Markdown } from "@/components/agent/markdown";

/**
 * Course setup is the course control center: identity and offering facts,
 * the grade scale, class policies, and the course agent. Structure, syllabus,
 * and materials live on their own pages; the agent is changed in conversation
 * with Atlas and reported here.
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
      status: courses.status,
      startDate: courses.startDate,
      endDate: courses.endDate,
      gradeScale: courses.gradeScale,
      classPolicies: courses.classPolicies,
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
  const guidanceGroups = groupCourseGuidance(activeConfig.directives);
  const activeGuidance = activeConfig.directives.filter((directive) => directive.enabled);

  return (
    <>
      <PageHeader
        title={`${course.code}: ${course.name}`}
        course="Course setup"
        action={<EditCourseDialog course={course} />}
      />

      <section aria-labelledby="course-overview-heading" className="pb-7">
        <h2 id="course-overview-heading" className="sr-only">Course overview</h2>
        {course.description?.trim() ? (
          <Markdown className="max-w-[75ch] text-[0.84375rem] leading-6 text-[var(--color-muted)]">{course.description}</Markdown>
        ) : (
          <p className="max-w-[75ch] text-[0.84375rem] leading-6 text-[var(--color-muted)]">No course description has been added.</p>
        )}
        <dl className="mt-5 flex flex-wrap gap-x-10 gap-y-3 text-[0.78125rem]">
          <CourseFact label="Term" value={course.term ?? "Not set"} />
          <CourseFact label="Starts" value={course.startDate ? longDate(course.startDate) : "Not set"} />
          <CourseFact label="Ends" value={course.endDate ? longDate(course.endDate) : "Not set"} />
          {course.status !== "published" ? <CourseFact label="Status" value={titleCase(course.status)} /> : null}
        </dl>
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
          action={<ClassPolicyDialog mode="create" />}
        />
        {classPolicies.length > 0 ? (
          <dl className="mt-4 divide-y divide-[var(--color-border)]">
            {classPolicies.map((policy) => (
              <div key={policy.title} className="grid gap-1.5 px-3 py-3.5 sm:grid-cols-[12rem_minmax(0,1fr)_auto] sm:gap-6">
                <dt className="text-[0.8125rem] font-medium text-[var(--color-ink)]">{policy.title}</dt>
                <dd className="min-w-0"><Markdown className="text-[0.8125rem] leading-5 text-[var(--color-muted)]">{policy.body}</Markdown></dd>
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

        <dl className="mt-5 grid sm:grid-cols-2 lg:grid-cols-4">
          <BehaviorFact label="Socratic by default" value={configuration.teaching.socraticByDefault ? "Yes" : "No"} />
          <BehaviorFact label="Direct answers" value={directAnswerLabel(configuration.teaching.directAnswers)} />
          <BehaviorFact label="Challenge" value={titleCase(configuration.teaching.challengeLevel)} />
          <BehaviorFact label="Citations" value={configuration.teaching.citationMode === "required" ? "Required" : "When useful"} />
        </dl>

        <dl className="mt-5 space-y-1">
          <BoundaryRow label="Supports" items={configuration.boundaries.supports} />
          <BoundaryRow label="Avoids" items={configuration.boundaries.avoids} />
          <BoundaryRow label="Escalates to professor" items={configuration.boundaries.escalatesWhen} />
        </dl>

        <div className="mt-7">
          <h3 className="text-[0.875rem] font-semibold text-[var(--color-ink)]">
            Course guidance
            {activeConfig.directives.length > 0 ? (
              <span className="ml-2.5 text-[0.75rem] font-normal text-[var(--color-faint)]">{activeGuidance.length} active</span>
            ) : null}
          </h3>
          {guidanceGroups.length > 0 ? (
            <div className="mt-3 space-y-5">
              {guidanceGroups.map((group) => (
                <section key={group.namespace} aria-labelledby={`guidance-${group.namespace}`}>
                  <h4 id={`guidance-${group.namespace}`} className="px-3 text-[0.71875rem] font-medium text-[var(--color-faint)]">
                    {namespaceLabel(group.namespace)}
                    <span className="ml-2 font-normal">{group.directives.filter((directive) => directive.enabled).length} active</span>
                  </h4>
                  <div className="mt-1 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
                    {group.directives.map((directive) => (
                      <details key={directive.key} className="group/guidance px-3 py-3 open:bg-[var(--color-surface-muted)]">
                        <summary className="flex cursor-pointer list-none items-start justify-between gap-5 marker:content-none">
                          <span className="min-w-0 text-[0.8125rem] font-medium leading-5 text-[var(--color-ink)]">{directive.title}</span>
                          <span className="shrink-0 text-right text-[0.6875rem] leading-5 text-[var(--color-faint)]">
                            {directive.enabled ? directiveScopeLabel(directive) : "Off"}
                          </span>
                        </summary>
                        <div className="mt-2 grid gap-2 pb-1 sm:grid-cols-[minmax(0,1fr)_10rem] sm:gap-6">
                          <p className="text-[0.78125rem] leading-5 text-[var(--color-muted)]">{directive.instruction}</p>
                          <dl className="text-[0.6875rem] leading-5 text-[var(--color-faint)]">
                            <div className="flex justify-between gap-3"><dt>Mode</dt><dd>{titleCase(directive.effect)}</dd></div>
                            <div className="flex justify-between gap-3"><dt>Revision</dt><dd className="tabular-nums">{directive.revision}</dd></div>
                          </dl>
                        </div>
                      </details>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <p className="mt-3 px-3 py-4 text-[0.8125rem] text-[var(--color-muted)]">No additional course guidance.</p>
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
        <RichTextEditor name="description" label="Description" rows={6} maxLength={2000} defaultValue={course.description ?? ""} />
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
        <RichTextEditor name="body" label="Policy" rows={6} required maxLength={1000} defaultValue={policy?.body ?? ""} />
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

function CourseFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[0.6875rem] text-[var(--color-faint)]">{label}</dt>
      <dd className="mt-1 font-medium text-[var(--color-ink)]">{value}</dd>
    </div>
  );
}

function directAnswerLabel(value: CourseAgentConfiguration["teaching"]["directAnswers"]) {
  return { never: "Never", after_attempt: "After an attempt", when_asked: "When asked" }[value];
}

function surfaceLabel(value: string) {
  if (value === "study") return "Study";
  if (value === "assignment") return "AI assignments";
  return namespaceLabel(value);
}

function groupCourseGuidance(directives: CourseAgentDirective[]) {
  const groups = new Map<string, CourseAgentDirective[]>();
  for (const directive of directives) {
    const current = groups.get(directive.namespace) ?? [];
    current.push(directive);
    groups.set(directive.namespace, current);
  }
  return [...groups.entries()]
    .map(([namespace, grouped]) => ({
      namespace,
      directives: grouped.sort((a, b) => a.title.localeCompare(b.title)),
    }))
    .sort((a, b) => a.namespace.localeCompare(b.namespace));
}

function namespaceLabel(value: string) {
  return value.replaceAll(/[._-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function directiveScopeLabel(directive: CourseAgentDirective) {
  const surfaces = directive.selectors.surfaces.map(surfaceLabel);
  if (surfaces.length > 0) return surfaces.join(", ");
  if (directive.selectors.audiences.length > 0) return directive.selectors.audiences.map(namespaceLabel).join(", ");
  return "All course interactions";
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
