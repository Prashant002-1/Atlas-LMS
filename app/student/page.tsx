import { BookOpenCheck, Check, FileText, PenLine, Target } from "lucide-react";
import { ProductShell } from "@/components/atlas/product-shell";
import { ActionButton, CodeList, CommandBand, IconLabel, Panel, ProgressBar, StatusBadge } from "@/components/atlas/primitives";
import { PracticeBasePanel } from "@/components/atlas/practice-base";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  loadStudentWorkspace,
  type StudentAssignment,
  type StudentMaterial,
  type StudentWorkspace,
} from "@/lib/student/workspace";
import { EmptyRecord, ObjectiveMeter, RecordFact } from "@/components/atlas/record";
import { submitAssignment } from "@/lib/student/actions";

const assignmentTone = {
  graded: "good",
  submitted: "accent",
  open: "neutral",
  missing: "warn",
} as const;

const assignmentLabel = {
  graded: "Done",
  submitted: "Submitted",
  open: "Open",
  missing: "Missing",
} as const;

export default async function StudentPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in?role=student");
  }
  if (session?.user && session.user.role !== "student") {
    redirect("/teach");
  }

  const workspace = await loadStudentWorkspace(session.user);
  const openAssignments = workspace.assignments.filter(isOpenWork);
  const visibleAssignments = prioritizeForObjective(
    openAssignments.length > 0 ? openAssignments : workspace.assignments.slice(0, 3),
    workspace.focus.code
  );
  const visibleMaterials = prioritizeForObjective(workspace.materials, workspace.focus.code).slice(0, 3);

  return (
    <ProductShell
      active="student"
      persona="Student"
      title={workspace.course.name}
      subtitle={`${workspace.course.code} / ${workspace.course.term}`}
      actor={session?.user}
      rail={workspace.problem ? undefined : <StudentRail workspace={workspace} />}
    >
      {workspace.problem ? (
        <Panel title={workspace.problem.title}>
          <p className="text-[14px] leading-6 text-[var(--color-muted)]">{workspace.problem.detail}</p>
        </Panel>
      ) : null}
      {workspace.problem ? null : (
        <StudentCommand
          workspace={workspace}
          materials={visibleMaterials}
          assignments={visibleAssignments}
          openWorkCount={openAssignments.length}
        />
      )}

      <Panel title="Study" action={<StatusBadge tone="neutral">{workspace.student.courseStanding}</StatusBadge>}>
        <div className="max-w-3xl">
          <IconLabel icon={Target}>Focus</IconLabel>
          <p className="mt-3 text-[24px] font-semibold leading-8 text-[var(--color-ink)]">
            {workspace.focus.code}: {workspace.focus.title}
          </p>
          <p className="mt-3 max-w-2xl text-[14px] leading-6 text-[var(--color-muted)]">{workspace.focus.description}</p>
          <div className="mt-5 max-w-xl">
            <ProgressBar value={workspace.focus.coverage} label="Completed" />
          </div>
        </div>

        <PracticeBlock practice={workspace.practice} />

        <div className="mt-5 grid gap-6 border-t border-[var(--color-border)] pt-2 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0">
            <MaterialList materials={visibleMaterials} />
            <AssignmentList assignments={visibleAssignments} />
          </div>
          <StudentCoverage objectives={workspace.objectives} />
        </div>
      </Panel>
    </ProductShell>
  );
}

function StudentCommand({
  workspace,
  materials,
  assignments,
  openWorkCount,
}: {
  workspace: StudentWorkspace;
  materials: StudentMaterial[];
  assignments: StudentAssignment[];
  openWorkCount: number;
}) {
  const primaryMaterial = materials.find((material) => material.objectiveCodes.includes(workspace.focus.code)) ?? materials[0];
  const primaryAssignment = assignments.find((assignment) => assignment.objectiveCodes.includes(workspace.focus.code)) ?? assignments[0];
  const next = nextStudentAction(primaryAssignment?.status);

  return (
    <CommandBand
      eyebrow="Today"
      title={`Work on ${workspace.focus.code}`}
      detail={`${workspace.focus.title} is ${workspace.focus.coverage}% complete and carries ${workspace.focus.assessedWeight}% assessed weight.`}
    >
      <RecordFact label="Standing" value={workspace.student.courseStanding} />
      <RecordFact label="Open work" value={String(openWorkCount)} />
      <RecordFact label="Material" value={primaryMaterial ? `Week ${primaryMaterial.week}` : "-"} />
      <RecordFact label="Next" value={next} />
    </CommandBand>
  );
}

function nextStudentAction(status?: StudentAssignment["status"]) {
  switch (status) {
    case "graded":
      return "Review";
    case "submitted":
      return "Revise";
    case "missing":
      return "Submit";
    case "open":
      return "Submit";
    default:
      return "Review";
  }
}

function PracticeBlock({ practice }: { practice: StudentWorkspace["practice"] }) {
  const canSubmit = practice.assignmentId && practice.assignmentStatus !== "graded";

  return (
    <section className="mt-5 border-t border-[var(--color-border)] pt-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-w-0">
          <IconLabel icon={PenLine}>Practice</IconLabel>
          <p className="mt-3 max-w-3xl text-[16px] leading-7 text-[var(--color-ink)]">{practice.prompt}</p>
          {practice.sourceDetail ? (
            <p className="mt-2 max-w-2xl text-[13px] leading-5 text-[var(--color-muted)]">{practice.sourceDetail}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <CodeList codes={[practice.objectiveCode]} />
            <StatusBadge tone="neutral">{practice.source}</StatusBadge>
          </div>
          {canSubmit ? (
            <form action={submitAssignment} className="mt-4 grid max-w-2xl gap-3">
              <input type="hidden" name="assignmentId" value={practice.assignmentId} />
              <label className="grid gap-2 text-[13px] font-medium text-[var(--color-ink)]">
                Response
                <textarea
                  name="body"
                  defaultValue={practice.savedResponse ?? ""}
                  required
                  minLength={20}
                  className="min-h-24 resize-none rounded-[8px] border border-[var(--color-border)] bg-white px-3 py-3 text-[14px] leading-6 text-[var(--color-ink)] transition focus:border-[var(--color-accent-strong)]"
                />
              </label>
              <div>
                <ActionButton>
                  <Check size={14} strokeWidth={2} aria-hidden="true" />
                  <span className="ml-1.5">{practice.savedResponse ? "Update response" : "Submit response"}</span>
                </ActionButton>
              </div>
            </form>
          ) : practice.savedResponse ? (
            <div className="mt-4 max-w-2xl border-t border-[var(--color-border)] pt-3">
              <p className="text-[12px] font-medium text-[var(--color-ink)]">Response</p>
              <p className="mt-2 text-[13px] leading-6 text-[var(--color-muted)]">{practice.savedResponse}</p>
            </div>
          ) : null}
        </div>
        <aside className="border-t border-[var(--color-border)] pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
          <PracticeBasePanel base={practice.base} />
          <p className="mt-4 text-[12px] font-medium text-[var(--color-ink)]">Check</p>
          <div className="mt-2 divide-y divide-[var(--color-border)]">
            {practice.checks.map((check) => (
              <div key={check} className="flex items-center gap-2 py-2 first:pt-0 last:pb-0">
                <Check size={14} strokeWidth={2} className="text-[var(--color-accent)]" aria-hidden="true" />
                <span className="text-[13px] leading-5 text-[var(--color-ink)]">{check}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}

function MaterialList({ materials }: { materials: StudentMaterial[] }) {
  return (
    <section className="border-b border-[var(--color-border)] pb-4">
      <p className="px-0 py-3 text-[13px] font-semibold text-[var(--color-ink)]">Material</p>
      <div className="divide-y divide-[var(--color-border)]">
        {materials.length > 0 ? (
          materials.map((material) => <MaterialLine key={material.id ?? material.title} material={material} />)
        ) : (
          <EmptyRecord title="No material" detail="Course material appears here when it is attached to this objective." />
        )}
      </div>
    </section>
  );
}

function AssignmentList({ assignments }: { assignments: StudentAssignment[] }) {
  return (
    <section className="pt-1">
      <p className="px-0 py-3 text-[13px] font-semibold text-[var(--color-ink)]">Work</p>
      <div className="divide-y divide-[var(--color-border)]">
        {assignments.length > 0 ? (
          assignments.map((assignment) => <AssignmentLine key={assignment.id ?? assignment.name} assignment={assignment} />)
        ) : (
          <EmptyRecord title="No work" detail="Assignments will appear here when they are added to the course." />
        )}
      </div>
    </section>
  );
}

function MaterialLine({ material }: { material: StudentMaterial }) {
  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-medium leading-5 text-[var(--color-ink)]">{material.title}</p>
          {material.summary ? <p className="mt-2 text-[13px] leading-5 text-[var(--color-muted)]">{material.summary}</p> : null}
        </div>
        <StatusBadge tone="neutral">Week {material.week}</StatusBadge>
      </div>
      {material.objectiveCodes.length > 0 ? (
        <div className="mt-2">
          <CodeList codes={material.objectiveCodes} />
        </div>
      ) : null}
    </div>
  );
}

function StudentCoverage({ objectives }: { objectives: StudentWorkspace["objectives"] }) {
  return (
    <aside className="border-t border-[var(--color-border)] pt-5 xl:border-l xl:border-t-0 xl:pl-5 xl:pt-3">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h3 className="text-[13px] font-semibold text-[var(--color-ink)]">Coverage</h3>
        <span className="text-[12px] text-[var(--color-muted)]">{objectives.length} objectives</span>
      </div>
      <div className="divide-y divide-[var(--color-border)]">
        {objectives.length > 0 ? (
          objectives.map((objective) => (
            <ObjectiveMeter key={objective.code} objective={objective} progressLabel="Completed" evidenceStyle="badge" />
          ))
        ) : (
          <EmptyRecord title="No objectives" detail="Objectives will appear here when they are added to the course." />
        )}
      </div>
    </aside>
  );
}

function StudentRail({ workspace }: { workspace: StudentWorkspace }) {
  const openWork = workspace.assignments.filter(isOpenWork).length;

  return (
    <Panel title="Course">
      <div className="space-y-4 text-[13px]">
        <RecordFact label="Standing" value={workspace.student.courseStanding} />
        <RecordFact label="Open work" value={openWork} />
        <IconLabel icon={BookOpenCheck}>{workspace.course.name}</IconLabel>
      </div>

      <div className="mt-5 border-t border-[var(--color-border)] pt-2">
        {workspace.sources.length > 0 ? (
          <>
            <p className="pb-1 text-[12px] font-medium text-[var(--color-ink)]">Evidence</p>
            <div className="divide-y divide-[var(--color-border)]">
              {workspace.sources.map((source) => (
                <div key={source} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <FileText size={16} strokeWidth={2} className="text-[var(--color-accent)]" aria-hidden="true" />
                  <span className="text-[13px] leading-5 text-[var(--color-ink)]">{source}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="pt-3 text-[13px] leading-5 text-[var(--color-muted)]">No material yet.</p>
        )}
      </div>
    </Panel>
  );
}

function AssignmentLine({ assignment }: { assignment: StudentAssignment }) {
  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-medium leading-5 text-[var(--color-ink)]">{assignment.name}</p>
          <p className="mt-1 text-[12px] text-[var(--color-muted)]">{assignment.detail}</p>
          {assignment.description ? (
            <p className="mt-2 text-[13px] leading-5 text-[var(--color-muted)]">{assignment.description}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <StatusBadge tone={assignmentTone[assignment.status]}>{assignmentLabel[assignment.status]}</StatusBadge>
        </div>
      </div>
      {assignment.objectiveCodes.length > 0 ? (
        <div className="mt-2">
          <CodeList codes={assignment.objectiveCodes} />
        </div>
      ) : null}
    </div>
  );
}

function prioritizeForObjective<T extends { objectiveCodes: string[] }>(items: T[], focusCode: string) {
  return [...items].sort((a, b) => Number(b.objectiveCodes.includes(focusCode)) - Number(a.objectiveCodes.includes(focusCode)));
}

function isOpenWork(assignment: StudentAssignment) {
  return assignment.status === "open" || assignment.status === "missing";
}
