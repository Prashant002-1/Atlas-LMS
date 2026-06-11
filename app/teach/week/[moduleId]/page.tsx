import { Check } from "lucide-react";
import { redirect } from "next/navigation";
import { ActionButton, BackLink, CodeList, Panel, StatusBadge, TextLink } from "@/components/atlas/primitives";
import { EmptyRecord, ObjectiveChecklist, RecordFact } from "@/components/atlas/record";
import { auth } from "@/lib/auth";
import { isInstructorLike } from "@/lib/auth/session";
import { publishModule, updateModuleRecord } from "@/lib/instructor/actions";
import { loadInstructorModuleWorkspace, type InstructorAssignment, type InstructorModuleWorkspace } from "@/lib/instructor/workspace";

const moduleTone = {
  approved: "good",
  draft: "neutral",
  "needs-review": "warn",
} as const;

const moduleLabel = {
  approved: "Live",
  draft: "Draft",
  "needs-review": "Review",
} as const;

export default async function InstructorWeekPage({ params }: { params: Promise<{ moduleId: string }> }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in");
  }
  if (!isInstructorLike(session.user.role)) {
    redirect("/student");
  }

  const { moduleId } = await params;
  const workspace = await loadInstructorModuleWorkspace(session.user, moduleId);

  return (
    <>
      <BackLink href="/teach/weeks">Weeks</BackLink>
      {workspace.problem || !workspace.module ? (
        <Panel title={workspace.problem?.title ?? "Week unavailable"}>
          <p className="text-[14px] leading-6 text-[var(--color-muted)]">
            {workspace.problem?.detail ?? "This week is not attached to the editable course record."}
          </p>
        </Panel>
      ) : (
        <>
          <WeekRecord workspace={workspace} />
          <RelatedWork assignments={workspace.assignments} />
          <RelatedObjectives workspace={workspace} />
        </>
      )}
    </>
  );
}

function WeekRecord({ workspace }: { workspace: InstructorModuleWorkspace }) {
  const courseModule = workspace.module;
  if (!courseModule) return null;

  return (
    <Panel title={courseModule.title} action={<StatusBadge tone={moduleTone[courseModule.status]}>{moduleLabel[courseModule.status]}</StatusBadge>}>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px]">
        <section className="min-w-0">
          <p className="text-[12px] font-medium text-[var(--color-muted)]">Week {courseModule.week}</p>
          {courseModule.summary ? (
            <p className="mt-3 max-w-3xl text-[15px] leading-7 text-[var(--color-ink)]">{courseModule.summary}</p>
          ) : (
            <p className="mt-3 text-[14px] leading-6 text-[var(--color-muted)]">No summary is attached to this week.</p>
          )}
          <div className="mt-3">
            <CodeList codes={courseModule.objectiveCodes} />
          </div>
          {courseModule.id ? <WeekEditForm module={courseModule} objectives={workspace.courseObjectives} /> : null}
        </section>
        <aside className="grid content-start gap-3 border-t border-[var(--color-border)] pt-4 text-[13px] lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
          <RecordFact label="Status" value={moduleLabel[courseModule.status]} />
          <RecordFact label="Work" value={workspace.assignments.length} />
          <RecordFact label="Objectives" value={workspace.objectives.length} />
          {courseModule.id && courseModule.status !== "approved" ? (
            <form action={publishModule}>
              <input type="hidden" name="moduleId" value={courseModule.id} />
              <input type="hidden" name="returnTo" value={`/teach/week/${courseModule.id}`} />
              <ActionButton className="w-full">
                <Check size={14} strokeWidth={2} aria-hidden="true" />
                <span className="ml-1.5">Publish</span>
              </ActionButton>
            </form>
          ) : null}
        </aside>
      </div>
    </Panel>
  );
}

function WeekEditForm({
  module,
  objectives,
}: {
  module: NonNullable<InstructorModuleWorkspace["module"]>;
  objectives: InstructorModuleWorkspace["courseObjectives"];
}) {
  if (!module.id) return null;

  return (
    <details className="mt-5 border-t border-[var(--color-border)] pt-4">
      <summary className="cursor-pointer rounded-[6px] text-[13px] font-medium text-[var(--color-muted)] marker:text-[var(--color-faint)]">
        Edit
      </summary>
      <form action={updateModuleRecord} className="mt-4 grid max-w-3xl gap-3">
        <input type="hidden" name="moduleId" value={module.id} />
        <input type="hidden" name="returnTo" value={`/teach/week/${module.id}`} />
        <ObjectiveChecklist objectives={objectives} selectedCodes={module.objectiveCodes} />
        <label className="grid gap-1.5 text-[12px] font-medium text-[var(--color-ink)]">
          Title
          <input
            name="title"
            type="text"
            defaultValue={module.title}
            required
            className="min-h-10 rounded-[8px] border border-[var(--color-border)] bg-white px-3 text-[14px] text-[var(--color-ink)] transition focus:border-[var(--color-accent-strong)]"
          />
        </label>
        <label className="grid gap-1.5 text-[12px] font-medium text-[var(--color-ink)]">
          Summary
          <textarea
            name="summary"
            defaultValue={module.summary ?? ""}
            className="min-h-28 resize-none rounded-[8px] border border-[var(--color-border)] bg-white px-3 py-3 text-[14px] leading-6 text-[var(--color-ink)] transition focus:border-[var(--color-accent-strong)]"
          />
        </label>
        <div>
          <ActionButton>Save week</ActionButton>
        </div>
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
          <EmptyRecord title="No work" detail="No work is attached to this week's objectives." />
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
          <p className="text-[14px] font-semibold leading-5 text-[var(--color-ink)]">
            {assignment.id ? <TextLink href={`/teach/work/${assignment.id}`}>{assignment.title}</TextLink> : assignment.title}
          </p>
          {assignment.detail ? <p className="mt-2 text-[13px] leading-5 text-[var(--color-muted)]">{assignment.detail}</p> : null}
          <div className="mt-2 flex flex-wrap gap-2">
            {assignment.points ? <StatusBadge tone="neutral">{Math.round(assignment.points)} pts</StatusBadge> : null}
            <CodeList codes={assignment.objectiveCodes} />
          </div>
        </div>
        <StatusBadge tone={assignment.status === "approved" ? "good" : "neutral"}>{assignment.status === "approved" ? "Live" : "Draft"}</StatusBadge>
      </div>
    </article>
  );
}

function RelatedObjectives({ workspace }: { workspace: InstructorModuleWorkspace }) {
  if (workspace.objectives.length === 0) return null;
  return (
    <Panel title="Objectives this week serves">
      <div className="divide-y divide-[var(--color-border)]">
        {workspace.objectives.map((objective) => (
          <div key={objective.code} className="py-3 first:pt-0 last:pb-0">
            <p className="text-[13.5px] font-medium">
              <span className="atlas-mono mr-2 text-[12px] text-[var(--color-faint)]">{objective.code}</span>
              {objective.description}
            </p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

