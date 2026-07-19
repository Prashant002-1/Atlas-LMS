import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { and, asc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { isInstructorLike } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { assignments, files, rubrics, sessionAssignments } from "@/lib/db/schema";
import { courseMaterialRecords } from "@/lib/db/course-agent-schema";
import { findEditableCourse } from "@/lib/instructor/workspace";
import { parseRubricCriteria } from "@/lib/agent/session-parts";
import {
  listCourseAgentConfigHistory,
  loadActiveCourseAgentConfig,
  type CourseAgentConfiguration,
} from "@/lib/agent/course-agent-config";
import { agentProfiles } from "@/lib/agent/profiles";
import { PageHeader } from "@/components/teach/page-header";
import { ButtonLink, TextLink } from "@/components/atlas/primitives";

/**
 * Teacher-facing configuration is transparent and read-only. Atlas is the
 * editor. Institution runtime infrastructure is intentionally absent from
 * this teacher route.
 */
export default async function TeachSettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  if (!isInstructorLike(session.user.role)) redirect("/student");
  if (!session.user.orgId) redirect("/teach");

  const course = await findEditableCourse({ id: session.user.id, orgId: session.user.orgId, role: session.user.role });
  if (!course) redirect("/teach");

  const [activeConfig, history, assignmentRows, materialCounts] = await Promise.all([
    loadActiveCourseAgentConfig(session.user.orgId, course.id),
    listCourseAgentConfigHistory(session.user.orgId, course.id),
    db
      .select({
        assignmentId: sessionAssignments.assignmentId,
        name: assignments.name,
        published: assignments.published,
        durationMinutes: sessionAssignments.durationMinutes,
        groundingScope: sessionAssignments.groundingScope,
        transcriptPolicy: sessionAssignments.transcriptPolicy,
        personalRecordSideNotes: sessionAssignments.personalRecordSideNotes,
        rubricVersion: rubrics.version,
        rubricCriteria: rubrics.criteria,
      })
      .from(sessionAssignments)
      .innerJoin(assignments, eq(assignments.id, sessionAssignments.assignmentId))
      .innerJoin(rubrics, eq(rubrics.id, sessionAssignments.rubricId))
      .where(
        and(
          eq(sessionAssignments.orgId, session.user.orgId),
          eq(sessionAssignments.courseId, course.id),
          eq(assignments.orgId, session.user.orgId),
          eq(assignments.courseId, course.id),
          eq(rubrics.orgId, session.user.orgId),
          eq(rubrics.courseId, course.id)
        )
      )
      .orderBy(asc(assignments.position), asc(assignments.createdAt)),
    db
      .select({ status: courseMaterialRecords.processingStatus })
      .from(files)
      .leftJoin(
        courseMaterialRecords,
        and(
          eq(courseMaterialRecords.fileId, files.id),
          eq(courseMaterialRecords.orgId, session.user.orgId),
          eq(courseMaterialRecords.courseId, course.id)
        )
      )
      .where(and(eq(files.orgId, session.user.orgId), eq(files.courseId, course.id))),
  ]);

  const configuration = activeConfig.configuration;
  const materialCountByStatus = materialCounts.reduce((counts, row) => {
    const status = row.status ?? "ready";
    counts.set(status, (counts.get(status) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());
  const totalMaterials = materialCounts.length;
  const readyMaterials = materialCountByStatus.get("ready") ?? 0;
  const activeRules = configuration.rules.filter((rule) => rule.enabled);

  return (
    <>
      <PageHeader
        title="Agent configuration"
        course={`${course.code} / ${activeConfig.source === "versioned" ? `version ${activeConfig.version}` : "course default"}`}
        action={<ButtonLink href="/teach/atlas?thread=new" size="sm">Change with Atlas</ButtonLink>}
      />

      <section aria-labelledby="identity-heading" className="border-b border-[var(--color-border)] pb-8">
        <p className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-[var(--color-accent-strong)]">Active course agent</p>
        <h2 id="identity-heading" className="mt-2 text-[1.625rem] font-semibold leading-tight text-[var(--color-ink)]">{configuration.identity.name}</h2>
        <p className="mt-1 text-[0.875rem] text-[var(--color-muted)]">{configuration.identity.role}</p>
        <p className="mt-3 max-w-3xl text-[0.875rem] leading-7 text-[var(--color-ink)]">{configuration.teaching.approach}</p>
        <dl className="mt-6 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
          <ConfigRow label="Voice" value={configuration.identity.voice} />
          <ConfigRow label="Version" value={activeConfig.version === 0 ? "Default" : `Version ${activeConfig.version}`} />
          <ConfigRow label="Last change" value={activeConfig.changeSummary} />
          <ConfigRow
            label="Changed in"
            value={activeConfig.sourceSessionTitle ?? "Default course state"}
            href={activeConfig.sourceSessionId ? `/teach/atlas?thread=${activeConfig.sourceSessionId}` : undefined}
          />
        </dl>
      </section>

      <section aria-labelledby="student-experience-heading" className="border-b border-[var(--color-border)] py-8">
        <h2 id="student-experience-heading" className="text-[1rem] font-semibold text-[var(--color-ink)]">Student experience</h2>
        <blockquote className="mt-4 max-w-3xl border-l-2 border-[var(--color-accent-strong)] pl-4 text-[0.875rem] leading-7 text-[var(--color-ink)]">
          {activeConfig.studentDisclosure}
        </blockquote>
      </section>

      <section aria-labelledby="teaching-heading" className="border-b border-[var(--color-border)] py-8">
        <h2 id="teaching-heading" className="text-[1rem] font-semibold text-[var(--color-ink)]">Teaching behavior</h2>
        <dl className="mt-4 grid border-y border-[var(--color-border)] sm:grid-cols-2 lg:grid-cols-5">
          <BehaviorFact label="Socratic by default" value={configuration.teaching.socraticByDefault ? "Yes" : "No"} />
          <BehaviorFact label="Direct answers" value={directAnswerLabel(configuration.teaching.directAnswers)} />
          <BehaviorFact label="Challenge" value={titleCase(configuration.teaching.challengeLevel)} />
          <BehaviorFact label="Citations" value={configuration.teaching.citationMode === "required" ? "Required" : "When useful"} />
          <BehaviorFact label="Daily student turns" value={String(configuration.limits.studentDailyTurns)} />
        </dl>
        <dl className="mt-6 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
          <BoundaryRow label="Supports" items={configuration.boundaries.supports} />
          <BoundaryRow label="Avoids" items={configuration.boundaries.avoids} />
          <BoundaryRow label="Escalates to professor" items={configuration.boundaries.escalatesWhen} />
        </dl>
      </section>

      <section aria-labelledby="rules-heading" className="border-b border-[var(--color-border)] py-8">
        <SectionLead id="rules-heading" title="Course rules" detail={`${activeRules.length} active`} />
        {configuration.rules.length > 0 ? (
          <div className="mt-4 overflow-x-auto border-y border-[var(--color-border)]">
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
          <p className="mt-4 border-y border-[var(--color-border)] py-5 text-[0.8125rem] text-[var(--color-muted)]">No additional course rules.</p>
        )}
      </section>

      <section aria-labelledby="knowledge-heading" className="border-b border-[var(--color-border)] py-8">
        <SectionLead
          id="knowledge-heading"
          title="Course knowledge"
          action={<TextLink href="/teach/course#materials" className="text-[0.75rem]">Manage course materials</TextLink>}
        />
        <dl className="mt-4 grid border-y border-[var(--color-border)] sm:grid-cols-3">
          <BehaviorFact label="Materials" value={String(totalMaterials)} />
          <BehaviorFact label="Ready for Atlas" value={String(readyMaterials)} />
          <BehaviorFact label="Processing or queued" value={String((materialCountByStatus.get("processing") ?? 0) + (materialCountByStatus.get("queued") ?? 0))} />
        </dl>
      </section>

      <section aria-labelledby="assignment-contracts-heading" className="border-b border-[var(--color-border)] py-8">
        <SectionLead
          id="assignment-contracts-heading"
          title="AI assignment contracts"
          detail={`${assignmentRows.length} configured`}
          action={<TextLink href="/teach/ai-assignments" className="text-[0.75rem]">Open AI assignments</TextLink>}
        />
        {assignmentRows.length > 0 ? (
          <div className="mt-4 overflow-x-auto border-y border-[var(--color-border)]">
            <table className="w-full min-w-[48rem] border-collapse text-left">
              <thead>
                <tr className="text-[0.6875rem] text-[var(--color-faint)]">
                  <th scope="col" className="px-3 py-2.5 font-medium">Assignment</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Session</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Transcript</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Personal record</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Rubric</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Open</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)] text-[0.78125rem]">
                {assignmentRows.map((row) => {
                  const scope = stringArray(row.groundingScope);
                  const criteria = parseRubricCriteria(row.rubricCriteria) ?? [];
                  return (
                    <tr key={row.assignmentId}>
                      <th scope="row" className="px-3 py-3.5 align-top font-medium text-[var(--color-ink)]">
                        {row.name}
                        {!row.published ? <span className="ml-2 font-normal text-[var(--color-muted)]">Draft</span> : null}
                        <span className="mt-0.5 block max-w-[18rem] font-normal leading-5 text-[var(--color-faint)]">{scope.length > 0 ? scope.join(", ") : "Course material"}</span>
                      </th>
                      <td className="px-3 py-3.5 align-top tabular-nums text-[var(--color-muted)]">{row.durationMinutes} min</td>
                      <td className="max-w-[14rem] px-3 py-3.5 align-top leading-5 text-[var(--color-muted)]">{row.transcriptPolicy}</td>
                      <td className="px-3 py-3.5 align-top text-[var(--color-muted)]">{row.personalRecordSideNotes ? "On" : "Off"}</td>
                      <td className="px-3 py-3.5 align-top text-[var(--color-muted)]">v{row.rubricVersion} / {criteria.length} criteria</td>
                      <td className="px-3 py-3.5 text-right align-top"><TextLink href={`/teach/ai-assignments/${row.assignmentId}`} className="text-[0.75rem]">Open</TextLink></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 border-y border-[var(--color-border)] py-5 text-[0.8125rem] text-[var(--color-muted)]">No AI assignments are configured.</p>
        )}
      </section>

      <section aria-labelledby="system-boundaries-heading" className="border-b border-[var(--color-border)] py-8">
        <h2 id="system-boundaries-heading" className="text-[1rem] font-semibold text-[var(--color-ink)]">System boundaries</h2>
        <div className="mt-4 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
          {[agentProfiles.professor, agentProfiles.session].map((profile) => (
            <div key={profile.id} className="py-4">
              <p className="px-3 text-[0.8125rem] font-semibold text-[var(--color-ink)]">
                {profile.id === "session" ? `${configuration.identity.name} (AI assignment)` : profile.label}
              </p>
              <dl className="mt-2.5 grid gap-2">
                <SystemBoundaryRow label="Reads" items={profile.boundaries.reads} />
                <SystemBoundaryRow label="Writes" items={profile.boundaries.writes} />
                <SystemBoundaryRow label="Never" items={profile.boundaries.never} />
              </dl>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="history-heading" className="py-8">
        <SectionLead id="history-heading" title="Version history" detail={history.length > 0 ? `${history.length} shown, newest first` : undefined} />
        {history.length > 0 ? (
          <ol className="mt-4 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
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
          <p className="mt-4 border-y border-[var(--color-border)] py-5 text-[0.8125rem] text-[var(--color-muted)]">The first conversation change will create version 1.</p>
        )}
      </section>
    </>
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

function ConfigRow({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="grid gap-1 px-3 py-3 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-6">
      <dt className="text-[0.75rem] text-[var(--color-faint)]">{label}</dt>
      <dd className="min-w-0 text-[0.8125rem] font-medium leading-5 text-[var(--color-ink)]">
        {href ? <TextLink href={href} className="text-[0.8125rem]">{value}</TextLink> : value}
      </dd>
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

function SystemBoundaryRow({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="grid gap-1 px-3 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-6">
      <dt className="text-[0.71875rem] text-[var(--color-faint)]">{label}</dt>
      <dd className="min-w-0 text-[0.75rem] leading-5 text-[var(--color-muted)]">{sentenceList(items)}</dd>
    </div>
  );
}

/** Join boundary phrases into one readable sentence-cased line. */
function sentenceList(items: string[]): string {
  if (items.length === 0) return "None";
  const joined = items.join("; ");
  return joined.charAt(0).toUpperCase() + joined.slice(1);
}

function directAnswerLabel(value: CourseAgentConfiguration["teaching"]["directAnswers"]) {
  return { never: "Never", after_attempt: "After an attempt", when_asked: "When asked" }[value];
}

function surfaceLabel(value: "study" | "assignment") {
  return value === "study" ? "Study" : "AI assignments";
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function formatStamp(value: Date) {
  return value.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}
