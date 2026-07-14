import { redirect } from "next/navigation";
import { ActionButton, BackLink, Panel, StatusBadge, TextLink } from "@/components/atlas/primitives";
import { EmptyRecord, RecordFact } from "@/components/atlas/record";
import { auth } from "@/lib/auth";
import { isInstructorLike } from "@/lib/auth/session";
import { publishModule, updateModuleRecord } from "@/lib/instructor/actions";
import { loadInstructorModuleWorkspace, type InstructorAssignment, type InstructorModuleWorkspace } from "@/lib/instructor/workspace";

export default async function InstructorWeekPage({ params }: { params: Promise<{ moduleId: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  if (!isInstructorLike(session.user.role)) redirect("/student");

  const { moduleId } = await params;
  const workspace = await loadInstructorModuleWorkspace(session.user, moduleId);

  return (
    <>
      <BackLink href="/teach/weeks">Modules</BackLink>
      {workspace.problem || !workspace.module ? (
        <Panel title={workspace.problem?.title ?? "Week unavailable"}>
          <p className="text-[0.875rem] leading-6 text-[var(--color-muted)]">{workspace.problem?.detail ?? "This module is not in a course you teach."}</p>
        </Panel>
      ) : (
        <>
          <WeekRecord workspace={workspace} />
          <RelatedWork assignments={workspace.assignments} />
        </>
      )}
    </>
  );
}

function WeekRecord({ workspace }: { workspace: InstructorModuleWorkspace }) {
  const courseModule = workspace.module;
  if (!courseModule) return null;
  const published = courseModule.status === "approved";

  return (
    <Panel title={courseModule.title} action={published ? undefined : <StatusBadge tone="neutral">Draft</StatusBadge>}>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px]">
        <section className="min-w-0">
          <p className="text-[0.75rem] font-medium text-[var(--color-muted)]">Week {courseModule.week}</p>
          {courseModule.summary ? (
            <p className="mt-3 max-w-3xl text-[0.9375rem] leading-7 text-[var(--color-ink)]">{courseModule.summary}</p>
          ) : (
            <p className="mt-3 text-[0.875rem] leading-6 text-[var(--color-muted)]">No summary is attached to this week.</p>
          )}
          {courseModule.id ? <WeekEditForm module={courseModule} /> : null}
        </section>
        <aside className="grid content-start gap-3 border-t border-[var(--color-border)] pt-4 text-[0.8125rem] lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
          {!published ? <RecordFact label="Status" value="Draft" /> : null}
          <RecordFact label="Work" value={workspace.assignments.length} />
          {courseModule.id && !published ? (
            <form action={publishModule}>
              <input type="hidden" name="moduleId" value={courseModule.id} />
              <input type="hidden" name="returnTo" value={`/teach/week/${courseModule.id}`} />
              <ActionButton size="sm" className="w-full">Publish</ActionButton>
            </form>
          ) : null}
        </aside>
      </div>
    </Panel>
  );
}

function WeekEditForm({ module }: { module: NonNullable<InstructorModuleWorkspace["module"]> }) {
  if (!module.id) return null;
  return (
    <details className="mt-5 border-t border-[var(--color-border)] pt-4">
      <summary className="cursor-pointer rounded-row text-[0.8125rem] font-medium text-[var(--color-muted)] marker:text-[var(--color-faint)]">Edit</summary>
      <form action={updateModuleRecord} className="mt-4 grid max-w-3xl gap-3">
        <input type="hidden" name="moduleId" value={module.id} />
        <input type="hidden" name="returnTo" value={`/teach/week/${module.id}`} />
        {module.objectiveCodes.map((code) => <input key={code} type="hidden" name="objectiveCode" value={code} />)}
        <label className="grid gap-1.5 text-[0.75rem] font-medium text-[var(--color-ink)]">
          Title
          <input name="title" type="text" defaultValue={module.title} required className="min-h-10 rounded-control border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 text-[0.875rem] text-[var(--color-ink)] transition focus:border-[var(--color-accent-strong)] focus:bg-[var(--color-surface)]" />
        </label>
        <label className="grid gap-1.5 text-[0.75rem] font-medium text-[var(--color-ink)]">
          Summary
          <textarea name="summary" defaultValue={module.summary ?? ""} className="min-h-28 resize-none rounded-control border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-3 text-[0.875rem] leading-6 text-[var(--color-ink)] transition focus:border-[var(--color-accent-strong)] focus:bg-[var(--color-surface)]" />
        </label>
        <div><ActionButton>Save week</ActionButton></div>
      </form>
    </details>
  );
}

function RelatedWork({ assignments }: { assignments: InstructorAssignment[] }) {
  return (
    <Panel title="Work" action={<StatusBadge tone="neutral">{assignments.length}</StatusBadge>}>
      <div className="divide-y divide-[var(--color-border)]">
        {assignments.length > 0 ? (
          assignments.map((assignment) => <AssignmentLine key={assignment.id ?? assignment.title} assignment={assignment} />)
        ) : (
          <EmptyRecord title="No work" detail="No work is attached to this module." />
        )}
      </div>
    </Panel>
  );
}

function AssignmentLine({ assignment }: { assignment: InstructorAssignment }) {
  return (
    <article className="py-4 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.875rem] font-semibold leading-5 text-[var(--color-ink)]">
            {assignment.id ? <TextLink href={`/teach/work/${assignment.id}`}>{assignment.title}</TextLink> : assignment.title}
          </p>
          {assignment.detail ? <p className="mt-2 text-[0.8125rem] leading-5 text-[var(--color-muted)]">{assignment.detail}</p> : null}
          {assignment.points ? <p className="mt-2 text-[0.75rem] text-[var(--color-muted)]">{Math.round(assignment.points)} points</p> : null}
        </div>
        {assignment.status === "approved" ? null : <StatusBadge tone="neutral">Draft</StatusBadge>}
      </div>
    </article>
  );
}
