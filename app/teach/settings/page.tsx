import Link from "next/link";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { isInstructorLike } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { assignments, courseAiPolicies, rubrics, sessionAssignments } from "@/lib/db/schema";
import { findEditableCourse } from "@/lib/instructor/workspace";
import { listOrgProviderKeys, resolveModelForOrg } from "@/lib/agent/keys";
import { CHAT_PROVIDERS, type ChatProviderKind } from "@/lib/ai/provider";
import { parseRubricCriteria } from "@/lib/agent/session-parts";
import { updateCourseAiPolicy } from "@/lib/instructor/actions";
import { removeSettingsProviderKey, saveSettingsProviderKey } from "@/lib/instructor/settings-actions";
import { ActionButton, TextLink } from "@/components/atlas/primitives";

const providerLabels: Record<ChatProviderKind, string> = {
  openrouter: "OpenRouter",
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  openai_compatible: "OpenAI-compatible",
};

export default async function TeachSettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  if (!isInstructorLike(session.user.role)) redirect("/student");
  if (!session.user.orgId) redirect("/teach");

  const course = await findEditableCourse({ id: session.user.id, orgId: session.user.orgId, role: session.user.role });
  if (!course) redirect("/teach");

  const [policyRows, assignmentRows, keys, effectiveModel] = await Promise.all([
    db
      .select()
      .from(courseAiPolicies)
      .where(and(eq(courseAiPolicies.orgId, session.user.orgId), eq(courseAiPolicies.courseId, course.id)))
      .limit(1),
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
      .where(and(eq(sessionAssignments.orgId, session.user.orgId), eq(sessionAssignments.courseId, course.id)))
      .orderBy(asc(assignments.position), asc(assignments.createdAt)),
    listOrgProviderKeys(session.user.orgId),
    resolveModelForOrg(session.user.orgId),
  ]);
  const policy = policyRows[0];
  const sortedKeys = [...keys].sort((a, b) => providerOrder(a.provider) - providerOrder(b.provider));

  const checkbox = "size-4 accent-[var(--color-accent-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)]";
  const field = "min-h-10 rounded-control border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 text-[0.8125rem] text-[var(--color-ink)] transition focus:border-[var(--color-accent-strong)] focus:bg-[var(--color-surface)]";

  return (
    <div className="max-w-[58rem]">
      <header className="border-b border-[var(--color-border)] pb-5">
        <h1 className="text-[1.375rem] font-semibold leading-7">Settings</h1>
        <p className="mt-1 max-w-3xl text-[0.8125rem] leading-6 text-[var(--color-muted)]">
          Control how Atlas works in {course.code}, inspect each AI assignment contract, and manage the organization model connection.
        </p>
        <nav aria-label="Settings sections" className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[0.75rem]">
          <SettingsLink href="#agent-boundaries">Agent boundaries</SettingsLink>
          <SettingsLink href="#assignment-contracts">AI assignments</SettingsLink>
          <SettingsLink href="#course-defaults">Session defaults</SettingsLink>
          <SettingsLink href="#model-access">Model access</SettingsLink>
        </nav>
      </header>

      <section id="agent-boundaries" aria-labelledby="agent-boundaries-heading" className="scroll-mt-6 pt-8">
        <SectionHeading
          id="agent-boundaries-heading"
          title="Agent boundaries"
          detail="These limits are enforced by which records and tools each part of Atlas receives. They are not editable prompt text."
        />
        <div className="mt-4 overflow-x-auto border-y border-[var(--color-border)]">
          <table className="w-full min-w-[44rem] border-collapse text-left">
            <thead>
              <tr className="text-[0.71875rem] text-[var(--color-muted)]">
                <th scope="col" className="px-3 py-2.5 font-medium">Agent</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Reads</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Writes</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Cannot do</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)] text-[0.78125rem]">
              <BoundaryRow
                name="Professor Atlas"
                reads="This course, drafts included, plus its own planning threads"
                writes="Drafts in Review"
                cannot="Publish records or grade students"
              />
              <BoundaryRow
                name="AI assignment"
                reads="One assignment, its rubric, and one student's own record"
                writes="That student's session turns and artifact revisions"
                cannot="See another student or publish a grade"
              />
              <BoundaryRow
                name="Grading"
                reads="A frozen submission and the rubric version attached to it"
                writes="A draft grade with verified transcript evidence"
                cannot="Score an unverified quote or save a failure as a lower grade"
              />
            </tbody>
          </table>
        </div>
      </section>

      <section id="assignment-contracts" aria-labelledby="assignment-contracts-heading" className="scroll-mt-6 border-t border-[var(--color-border)] pt-8 mt-8">
        <SectionHeading
          id="assignment-contracts-heading"
          title="AI assignments"
          detail="Each assessed session has its own instructions, rubric, transcript policy, grounding scope, and personal-record setting."
          action={<TextLink href="/teach/ai-assignments" className="text-[0.75rem]">Open AI assignments</TextLink>}
        />

        {assignmentRows.length > 0 ? (
          <div className="mt-4 overflow-x-auto border-y border-[var(--color-border)]">
            <table className="w-full min-w-[48rem] border-collapse text-left">
              <thead>
                <tr className="text-[0.71875rem] text-[var(--color-muted)]">
                  <th scope="col" className="px-3 py-2.5 font-medium">Assignment</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Session</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Transcript</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Personal record</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Rubric</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Manage</th>
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
                        <span className="mt-0.5 block max-w-[18rem] font-normal leading-5 text-[var(--color-faint)]">
                          {scope.length > 0 ? scope.join(", ") : "Course context"}
                        </span>
                      </th>
                      <td className="px-3 py-3.5 align-top tabular-nums text-[var(--color-muted)]">{row.durationMinutes} min</td>
                      <td className="max-w-[14rem] px-3 py-3.5 align-top leading-5 text-[var(--color-muted)]">{row.transcriptPolicy}</td>
                      <td className="px-3 py-3.5 align-top text-[var(--color-muted)]">{row.personalRecordSideNotes ? "On" : "Off"}</td>
                      <td className="px-3 py-3.5 align-top text-[var(--color-muted)]">v{row.rubricVersion} / {criteria.length} criteria</td>
                      <td className="px-3 py-3.5 text-right align-top">
                        <TextLink href={`/teach/ai-assignments/${row.assignmentId}`} className="text-[0.75rem]">Open</TextLink>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 border-y border-[var(--color-border)] py-5 text-[0.8125rem] text-[var(--color-muted)]">
            No AI assignments are configured for this course. Set one up with <TextLink href="/teach/atlas">Atlas</TextLink>.
          </p>
        )}
      </section>

      <section id="course-defaults" aria-labelledby="course-defaults-heading" className="scroll-mt-6 border-t border-[var(--color-border)] pt-8 mt-8">
        <SectionHeading
          id="course-defaults-heading"
          title="Course session defaults"
          detail="Shared behavior used by AI assignment sessions in this course. Each assignment still controls its own instructions, rubric, transcript policy, grounding scope, and personal-record setting."
        />

        <form action={updateCourseAiPolicy} className="mt-5">
          {policy?.allowExplain !== false ? <input type="hidden" name="allowExplain" value="on" /> : null}
          {policy?.allowPractice !== false ? <input type="hidden" name="allowPractice" value="on" /> : null}
          {policy?.allowQuestions !== false ? <input type="hidden" name="allowQuestions" value="on" /> : null}
          {policy?.shareStruggleSignal === true ? <input type="hidden" name="shareStruggleSignal" value="on" /> : null}
          <input type="hidden" name="studentDailyLimit" value={policy?.studentDailyLimit ?? 40} />

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-[0.75rem] font-medium">
              Assistance level
              <select name="explanationDepth" defaultValue={policy?.explanationDepth ?? "guided"} className={field}>
                <option value="hint">Hints only</option>
                <option value="guided">Guided reasoning</option>
                <option value="full">Full explanations after engagement</option>
              </select>
            </label>
            <div className="border-l border-[var(--color-border)] pl-4">
              <p className="text-[0.75rem] font-medium text-[var(--color-ink)]">Assessed-work boundary</p>
              <p className="mt-1 text-[0.75rem] leading-5 text-[var(--color-muted)]">Atlas never completes the deliverable. The assistance level controls explanation after the student has engaged.</p>
            </div>
          </div>

          <div className="mt-5 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
            <PolicyToggle name="citationsRequired" defaultChecked={policy?.citationsRequired !== false} checkbox={checkbox} title="Course citations" detail="Cite the course material used in a response." />
          </div>

          <fieldset className="mt-5">
            <legend className="text-[0.75rem] font-semibold text-[var(--color-ink)]">Teaching instructions</legend>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-[0.75rem] font-medium">
                Agent name
                <input name="personaName" type="text" placeholder="Atlas" defaultValue={policy?.personaName ?? ""} className={field} />
              </label>
              <label className="grid gap-1.5 text-[0.75rem] font-medium">
                Voice
                <input name="personaStyle" type="text" placeholder="Direct, patient, and concise" defaultValue={policy?.personaStyle ?? ""} className={field} />
              </label>
            </div>
            <label className="mt-4 grid gap-1.5 text-[0.75rem] font-medium">
              Standing instructions
              <textarea
                name="customInstructions"
                rows={4}
                placeholder="Course-specific boundaries, examples, terminology, or response rules."
                defaultValue={policy?.customInstructions ?? ""}
                className="min-h-24 resize-y rounded-control border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2.5 text-[0.8125rem] leading-6 text-[var(--color-ink)] transition focus:border-[var(--color-accent-strong)] focus:bg-[var(--color-surface)]"
              />
            </label>
          </fieldset>

          <div className="mt-5">
            <ActionButton>Save session defaults</ActionButton>
          </div>
        </form>
      </section>

      <section id="model-access" aria-labelledby="model-access-heading" className="scroll-mt-6 border-t border-[var(--color-border)] pt-8 mt-8">
        <SectionHeading
          id="model-access-heading"
          title="Model access"
          detail="Organization-wide connection used by professor planning, AI assignments, grading, and class results. Keys stay encrypted and only their final four characters are shown."
        />

        <dl className="mt-4 grid border-y border-[var(--color-border)] sm:grid-cols-3">
          <ModelFact label="Scope" value="Organization" />
          <ModelFact
            label="Active model"
            value={effectiveModel ? `${providerLabels[effectiveModel.provider]} / ${effectiveModel.modelId}` : "Not configured"}
          />
          <ModelFact label="Source" value={effectiveModel?.source === "org" ? "Organization key" : effectiveModel?.source === "env" ? "Server default" : "-"} />
        </dl>

        {sortedKeys.length > 0 ? (
          <div className="mt-5 overflow-x-auto border-y border-[var(--color-border)]">
            <table className="w-full min-w-[40rem] border-collapse text-left">
              <thead>
                <tr className="text-[0.71875rem] text-[var(--color-muted)]">
                  <th scope="col" className="px-3 py-2.5 font-medium">Provider</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Model</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Endpoint</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Credential</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Remove</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)] text-[0.78125rem]">
                {sortedKeys.map((key) => (
                  <tr key={key.provider}>
                    <th scope="row" className="px-3 py-3 font-medium text-[var(--color-ink)]">{providerLabels[key.provider]}</th>
                    <td className="px-3 py-3 text-[var(--color-muted)]">{key.chatModel ?? "Provider default"}</td>
                    <td className="max-w-[16rem] truncate px-3 py-3 text-[var(--color-muted)]" title={key.baseUrl ?? undefined}>{key.baseUrl ?? "-"}</td>
                    <td className="atlas-mono px-3 py-3 text-[var(--color-muted)]">••••{key.keyTail}</td>
                    <td className="px-3 py-3 text-right">
                      <form action={removeSettingsProviderKey}>
                        <input type="hidden" name="provider" value={key.provider} />
                        <ActionButton size="sm" variant="danger" ariaLabel={`Remove ${providerLabels[key.provider]} key`}>Remove</ActionButton>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <details className="group mt-5">
          <summary className="cursor-pointer text-[0.78125rem] font-medium text-[var(--color-ink)] underline decoration-[color-mix(in_oklch,var(--color-ink)_30%,transparent)] underline-offset-[3px] hover:text-[var(--color-accent-strong)]">
            {sortedKeys.length > 0 ? "Add or replace provider" : "Connect provider"}
          </summary>
          <form action={saveSettingsProviderKey} className="mt-4 grid gap-4 border-t border-[var(--color-border)] pt-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-[0.75rem] font-medium">
                Provider
                <select name="provider" defaultValue="openrouter" className={field}>
                  {CHAT_PROVIDERS.map((provider) => <option key={provider} value={provider}>{providerLabels[provider]}</option>)}
                </select>
              </label>
              <label className="grid gap-1.5 text-[0.75rem] font-medium">
                Model
                <input name="chatModel" type="text" placeholder="Provider model ID" className={field} />
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-[0.75rem] font-medium">
                API key
                <input name="apiKey" type="password" required autoComplete="off" placeholder="Stored encrypted" className={field} />
              </label>
              <label className="grid gap-1.5 text-[0.75rem] font-medium">
                Endpoint for OpenAI-compatible providers
                <input name="baseUrl" type="url" placeholder="https://gateway.example.com/v1" className={field} />
              </label>
            </div>
            <div><ActionButton variant="secondary">Save provider</ActionButton></div>
          </form>
        </details>
      </section>
    </div>
  );
}

function SettingsLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="rounded-row font-medium text-[var(--color-muted)] underline decoration-[color-mix(in_oklch,var(--color-ink)_25%,transparent)] underline-offset-[3px] hover:text-[var(--color-ink)]">
      {children}
    </Link>
  );
}

function SectionHeading({ id, title, detail, action }: { id: string; title: string; detail: string; action?: ReactNode }) {
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

function BoundaryRow({ name, reads, writes, cannot }: { name: string; reads: string; writes: string; cannot: string }) {
  return (
    <tr>
      <th scope="row" className="px-3 py-3.5 align-top font-medium text-[var(--color-ink)]">{name}</th>
      <td className="px-3 py-3.5 align-top leading-5 text-[var(--color-muted)]">{reads}</td>
      <td className="px-3 py-3.5 align-top leading-5 text-[var(--color-muted)]">{writes}</td>
      <td className="px-3 py-3.5 align-top leading-5 text-[var(--color-muted)]">{cannot}</td>
    </tr>
  );
}

function PolicyToggle({ name, defaultChecked, checkbox, title, detail }: { name: string; defaultChecked: boolean; checkbox: string; title: string; detail: string }) {
  return (
    <label className="flex items-start gap-3 py-3 text-[0.8125rem]">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className={`mt-0.5 ${checkbox}`} />
      <span>
        <span className="font-medium text-[var(--color-ink)]">{title}</span>
        <span className="mt-0.5 block text-[0.75rem] leading-5 text-[var(--color-muted)]">{detail}</span>
      </span>
    </label>
  );
}

function ModelFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-[var(--color-border)] px-4 py-3 first:pl-0 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <dt className="text-[0.6875rem] text-[var(--color-faint)]">{label}</dt>
      <dd className="mt-1 text-[0.78125rem] font-medium leading-5 text-[var(--color-ink)]">{value}</dd>
    </div>
  );
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function providerOrder(provider: ChatProviderKind) {
  const index = CHAT_PROVIDERS.indexOf(provider);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}
