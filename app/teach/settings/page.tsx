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
        <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.38fr)]">
          <div className="min-w-0">
            <p className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-[var(--color-accent-strong)]">Active course agent</p>
            <h2 id="identity-heading" className="mt-2 text-[1.625rem] font-semibold leading-tight text-[var(--color-ink)]">{configuration.identity.name}</h2>
            <p className="mt-1 text-[0.875rem] text-[var(--color-muted)]">{configuration.identity.role}</p>
            <p className="mt-4 max-w-3xl text-[0.875rem] leading-7 text-[var(--color-ink)]">{configuration.teaching.approach}</p>
          </div>
          <dl className="grid gap-4 text-[0.78125rem]">
            <ConfigFact label="Voice" value={configuration.identity.voice} />
            <ConfigFact label="Current version" value={activeConfig.version === 0 ? "Default" : `Version ${activeConfig.version}`} />
            <ConfigFact label="Last change" value={activeConfig.changeSummary} />
            <ConfigFact label="Changed in" value={activeConfig.sourceSessionTitle ?? "Default course state"} href={activeConfig.sourceSessionId ? `/teach/atlas?thread=${activeConfig.sourceSessionId}` : undefined} />
          </dl>
        </div>
      </section>

      <section aria-labelledby="student-experience-heading" className="border-b border-[var(--color-border)] py-8">
        <div className="grid gap-7 lg:grid-cols-[minmax(0,0.42fr)_minmax(0,1fr)]">
          <div>
            <h2 id="student-experience-heading" className="text-[1rem] font-semibold text-[var(--color-ink)]">Student experience</h2>
            <p className="mt-1 text-[0.75rem] leading-5 text-[var(--color-muted)]">Shown in every assessed session and backed by the active configuration.</p>
          </div>
          <blockquote className="border-l-2 border-[var(--color-accent-strong)] pl-4 text-[0.875rem] leading-7 text-[var(--color-ink)]">
            {activeConfig.studentDisclosure}
          </blockquote>
        </div>
      </section>

      <section aria-labelledby="teaching-heading" className="border-b border-[var(--color-border)] py-8">
        <SectionLead
          id="teaching-heading"
          title="Teaching behavior"
          detail="Course-wide behavior compiled into professor and student sessions. AI assignment contracts remain stricter where they need to be."
        />
        <dl className="mt-5 grid border-y border-[var(--color-border)] sm:grid-cols-2 lg:grid-cols-5">
          <BehaviorFact label="Socratic by default" value={configuration.teaching.socraticByDefault ? "Yes" : "No"} />
          <BehaviorFact label="Direct answers" value={directAnswerLabel(configuration.teaching.directAnswers)} />
          <BehaviorFact label="Challenge" value={titleCase(configuration.teaching.challengeLevel)} />
          <BehaviorFact label="Citations" value={configuration.teaching.citationMode === "required" ? "Required" : "When useful"} />
          <BehaviorFact label="Daily student turns" value={String(configuration.limits.studentDailyTurns)} />
        </dl>

        <div className="mt-7 grid gap-7 lg:grid-cols-3">
          <BoundaryList title="Supports" items={configuration.boundaries.supports} />
          <BoundaryList title="Avoids" items={configuration.boundaries.avoids} />
          <BoundaryList title="Escalates to professor" items={configuration.boundaries.escalatesWhen} />
        </div>
      </section>

      <section aria-labelledby="rules-heading" className="border-b border-[var(--color-border)] py-8">
        <SectionLead
          id="rules-heading"
          title="Course rules"
          detail={`${activeRules.length} active ${activeRules.length === 1 ? "rule" : "rules"}. Atlas writes and versions these from the professor's request.`}
        />
        {configuration.rules.length > 0 ? (
          <div className="mt-5 overflow-x-auto border-y border-[var(--color-border)]">
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
          <p className="mt-5 border-y border-[var(--color-border)] py-5 text-[0.8125rem] text-[var(--color-muted)]">No additional course rules.</p>
        )}
      </section>

      <section aria-labelledby="knowledge-heading" className="border-b border-[var(--color-border)] py-8">
        <SectionLead
          id="knowledge-heading"
          title="Course knowledge"
          detail="Only ready material is placed in Atlas context. Student sessions receive only material available to the course."
          action={<TextLink href="/teach/course#materials" className="text-[0.75rem]">Manage course materials</TextLink>}
        />
        <dl className="mt-5 grid border-y border-[var(--color-border)] sm:grid-cols-3">
          <BehaviorFact label="Materials" value={String(totalMaterials)} />
          <BehaviorFact label="Ready for Atlas" value={String(readyMaterials)} />
          <BehaviorFact label="Processing or queued" value={String((materialCountByStatus.get("processing") ?? 0) + (materialCountByStatus.get("queued") ?? 0))} />
        </dl>
      </section>

      <section aria-labelledby="assignment-contracts-heading" className="border-b border-[var(--color-border)] py-8">
        <SectionLead
          id="assignment-contracts-heading"
          title="AI assignment contracts"
          detail="Each assessed session keeps its own brief, duration, sources, transcript policy, personal-record setting, and rubric."
          action={<TextLink href="/teach/ai-assignments" className="text-[0.75rem]">Open AI assignments</TextLink>}
        />
        {assignmentRows.length > 0 ? (
          <div className="mt-5 overflow-x-auto border-y border-[var(--color-border)]">
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
          <p className="mt-5 border-y border-[var(--color-border)] py-5 text-[0.8125rem] text-[var(--color-muted)]">No AI assignments are configured.</p>
        )}
      </section>

      <section aria-labelledby="system-boundaries-heading" className="border-b border-[var(--color-border)] py-8">
        <SectionLead
          id="system-boundaries-heading"
          title="System boundaries"
          detail="These limits are enforced by routes, scoped queries, and typed tools. Course configuration cannot change them."
        />
        <div className="mt-5 overflow-x-auto border-y border-[var(--color-border)]">
          <table className="w-full min-w-[52rem] border-collapse text-left">
            <thead>
              <tr className="text-[0.6875rem] text-[var(--color-faint)]">
                <th scope="col" className="px-3 py-2.5 font-medium">Agent</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Reads</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Writes</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Never</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)] text-[0.75rem]">
              {[agentProfiles.professor, agentProfiles.session].map((profile) => (
                <tr key={profile.id}>
                  <th scope="row" className="px-3 py-3.5 align-top font-medium text-[var(--color-ink)]">{profile.id === "session" ? `${configuration.identity.name} (AI assignment)` : profile.label}</th>
                  <td className="max-w-sm px-3 py-3.5 align-top leading-5 text-[var(--color-muted)]">{profile.boundaries.reads.join("; ")}</td>
                  <td className="max-w-sm px-3 py-3.5 align-top leading-5 text-[var(--color-muted)]">{profile.boundaries.writes.join("; ")}</td>
                  <td className="max-w-sm px-3 py-3.5 align-top leading-5 text-[var(--color-muted)]">{profile.boundaries.never.join("; ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="history-heading" className="py-8">
        <SectionLead
          id="history-heading"
          title="Version history"
          detail="Every Atlas change is append-only and attributed to the professor and source thread. Existing sessions use the current active version on their next turn."
        />
        {history.length > 0 ? (
          <ol className="mt-5 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
            {history.map((item) => (
              <li key={item.id} className="grid gap-2 px-3 py-3.5 sm:grid-cols-[5rem_minmax(0,1fr)_auto] sm:items-start">
                <span className="atlas-mono text-[0.71875rem] text-[var(--color-faint)]">v{item.version}</span>
                <div className="min-w-0">
                  <p className="text-[0.8125rem] font-medium text-[var(--color-ink)]">{item.changeSummary}</p>
                  <p className="mt-0.5 text-[0.71875rem] leading-5 text-[var(--color-muted)]">{item.createdByName ?? "Course instructor"}{item.sourceSessionTitle ? ` / ${item.sourceSessionTitle}` : ""}</p>
                </div>
                <time className="text-[0.6875rem] text-[var(--color-faint)]" dateTime={item.createdAt.toISOString()}>{formatStamp(item.createdAt)}</time>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-5 border-y border-[var(--color-border)] py-5 text-[0.8125rem] text-[var(--color-muted)]">The first conversation change will create version 1.</p>
        )}
      </section>
    </>
  );
}

function SectionLead({ id, title, detail, action }: { id: string; title: string; detail: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 id={id} className="text-[1rem] font-semibold text-[var(--color-ink)]">{title}</h2>
        <p className="mt-1 max-w-3xl text-[0.78125rem] leading-5 text-[var(--color-muted)]">{detail}</p>
      </div>
      {action}
    </div>
  );
}

function ConfigFact({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="border-b border-[var(--color-border)] pb-3 last:border-b-0 last:pb-0">
      <dt className="text-[0.6875rem] text-[var(--color-faint)]">{label}</dt>
      <dd className="mt-1 font-medium leading-5 text-[var(--color-ink)]">{href ? <TextLink href={href} className="text-[0.78125rem]">{value}</TextLink> : value}</dd>
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

function BoundaryList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="text-[0.78125rem] font-semibold text-[var(--color-ink)]">{title}</h3>
      {items.length > 0 ? (
        <ul className="mt-3 space-y-2 text-[0.78125rem] leading-5 text-[var(--color-muted)]">
          {items.map((item, index) => <li key={`${title}-${index}`} className="border-l border-[var(--color-border-strong)] pl-3">{item}</li>)}
        </ul>
      ) : <p className="mt-3 text-[0.75rem] text-[var(--color-faint)]">None</p>}
    </div>
  );
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
