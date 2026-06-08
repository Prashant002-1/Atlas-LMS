import { BookOpenCheck, ClipboardCheck, Target } from "lucide-react";
import { redirect } from "next/navigation";
import { PracticeBasePanel, PracticeVariants } from "@/components/atlas/practice-base";
import { BackLink, ButtonLink, CodeList, IconLabel, Panel, StatusBadge, TextLink } from "@/components/atlas/primitives";
import { EmptyRecord, ObjectiveMeter, RecordFact } from "@/components/atlas/record";
import { ProductShell } from "@/components/atlas/product-shell";
import { auth } from "@/lib/auth";
import {
  loadStudentMaterialWorkspace,
  type StudentAssignment,
  type StudentMaterialWorkspace,
  type StudentStudyPackage,
} from "@/lib/student/workspace";

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

export default async function StudentMaterialPage({ params }: { params: Promise<{ moduleId: string }> }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in?role=student");
  }
  if (session.user.role !== "student") {
    redirect("/teach");
  }

  const { moduleId } = await params;
  const workspace = await loadStudentMaterialWorkspace(session.user, moduleId);

  return (
    <ProductShell
      active="student"
      persona="Student"
      title={workspace.course.name}
      subtitle={`${workspace.course.code} / ${workspace.course.term}`}
      actor={session.user}
      rail={workspace.problem ? undefined : <MaterialRail workspace={workspace} />}
    >
      <BackLink href="/student#material">Material</BackLink>
      {workspace.problem || !workspace.material ? (
        <Panel title={workspace.problem?.title ?? "Material unavailable"}>
          <p className="text-[14px] leading-6 text-[var(--color-muted)]">
            {workspace.problem?.detail ?? "This material is not attached to the active course record."}
          </p>
        </Panel>
      ) : (
        <>
          <Panel title={workspace.material.title} action={<StatusBadge tone="neutral">Week {workspace.material.week}</StatusBadge>}>
            <div className="max-w-3xl">
              {workspace.material.summary ? (
                <p className="text-[16px] leading-7 text-[var(--color-ink)]">{workspace.material.summary}</p>
              ) : (
                <p className="text-[14px] leading-6 text-[var(--color-muted)]">No summary is attached to this material.</p>
              )}
              <div className="mt-4">
                <CodeList codes={workspace.material.objectiveCodes} />
              </div>
              {workspace.studyPackage ? <MaterialPackageContext studyPackage={workspace.studyPackage} /> : null}
            </div>
            <MaterialPracticePath workspace={workspace} />
          </Panel>
          <RelatedWork assignments={workspace.assignments} />
          <RelatedObjectives workspace={workspace} />
        </>
      )}
    </ProductShell>
  );
}

function MaterialPracticePath({ workspace }: { workspace: StudentMaterialWorkspace }) {
  const assignment = primaryAssignment(workspace.assignments);
  const firstVariant = workspace.practice.base.variants[0] ?? workspace.practice.prompt;

  return (
    <section className="mt-5 grid gap-5 border-t border-[var(--color-border)] pt-5 lg:grid-cols-[minmax(0,1fr)_260px]">
      <div className="min-w-0">
        <IconLabel icon={Target}>Practice</IconLabel>
        <p className="mt-3 max-w-3xl text-[15px] leading-7 text-[var(--color-ink)]">{workspace.practice.prompt}</p>
        <div className="mt-4 grid gap-3 text-[13px] sm:grid-cols-2">
          <RecordFact label="Try" value={firstVariant} variant="stack" />
          <RecordFact
            label="Work"
            value={assignment?.id ? <TextLink href={`/student/work/${assignment.id}`}>{assignment.name}</TextLink> : assignment?.name ?? "-"}
            variant="stack"
          />
        </div>
        {assignment?.id ? (
          <div className="mt-5">
            <ButtonLink href={`/student/work/${assignment.id}`} variant="primary">
              {workAction(assignment)}
            </ButtonLink>
          </div>
        ) : null}
      </div>
      <aside className="border-t border-[var(--color-border)] pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
        <PracticeBasePanel base={workspace.practice.base} />
        <PracticeVariants base={workspace.practice.base} />
      </aside>
    </section>
  );
}

function MaterialPackageContext({ studyPackage }: { studyPackage: StudentStudyPackage }) {
  return (
    <section className="mt-5 grid gap-3 border-t border-[var(--color-border)] pt-5 text-[13px] md:grid-cols-[minmax(0,1fr)_minmax(180px,0.4fr)]">
      <div className="min-w-0">
        <p className="text-[12px] font-medium text-[var(--color-ink)]">Package</p>
        <h3 className="mt-1 text-[15px] font-semibold leading-6 text-[var(--color-ink)]">{studyPackage.title}</h3>
        <p className="mt-2 text-[14px] leading-6 text-[var(--color-muted)]">{studyPackage.practice}</p>
      </div>
      <div className="grid content-start gap-2">
        <RecordFact label="Do" value={studyPackage.doHref ? <TextLink href={studyPackage.doHref}>{studyPackage.do}</TextLink> : studyPackage.do} />
        <RecordFact label="Check" value={studyPackage.check} />
      </div>
    </section>
  );
}

function RelatedWork({ assignments }: { assignments: StudentAssignment[] }) {
  return (
    <Panel title="Work" action={<StatusBadge tone="neutral">{assignments.length}</StatusBadge>}>
      <div className="divide-y divide-[var(--color-border)]">
        {assignments.length > 0 ? (
          assignments.map((assignment) => <AssignmentLine key={assignment.id ?? assignment.name} assignment={assignment} />)
        ) : (
          <EmptyRecord title="No work" detail="No published work is attached to this material." />
        )}
      </div>
    </Panel>
  );
}

function AssignmentLine({ assignment }: { assignment: StudentAssignment }) {
  return (
    <article className="py-4 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[14px] font-semibold leading-5 text-[var(--color-ink)]">
            {assignment.id ? <TextLink href={`/student/work/${assignment.id}`}>{assignment.name}</TextLink> : assignment.name}
          </p>
          <p className="mt-1 text-[12px] text-[var(--color-muted)]">{assignmentMeta(assignment)}</p>
          {assignment.description ? <p className="mt-2 text-[13px] leading-5 text-[var(--color-muted)]">{assignment.description}</p> : null}
        </div>
        <StatusBadge tone={assignmentTone[assignment.status]}>{assignmentLabel[assignment.status]}</StatusBadge>
      </div>
      <div className="mt-2">
        <CodeList codes={assignment.objectiveCodes} />
      </div>
    </article>
  );
}

function primaryAssignment(assignments: StudentAssignment[]) {
  return assignments.find((assignment) => assignment.status === "missing" || assignment.status === "open") ?? assignments[0];
}

function workAction(assignment: StudentAssignment) {
  if (assignment.status === "graded") return "Review work";
  if (assignment.status === "submitted") return "Check work";
  return "Start work";
}

function RelatedObjectives({ workspace }: { workspace: StudentMaterialWorkspace }) {
  return (
    <Panel title="Grade" action={<StatusBadge tone="neutral">{workspace.objectives.length}</StatusBadge>}>
      <div className="divide-y divide-[var(--color-border)]">
        {workspace.objectives.map((objective) => (
          <ObjectiveMeter key={objective.code} objective={objective} progressLabel="Completed" evidenceStyle="badge" />
        ))}
      </div>
    </Panel>
  );
}

function MaterialRail({ workspace }: { workspace: StudentMaterialWorkspace }) {
  return (
    <div className="space-y-5">
      <Panel title="Course">
        <div className="space-y-3 text-[13px]">
          <RecordFact label="Standing" value={workspace.student.courseStanding} />
          <RecordFact label="Work" value={workspace.assignments.length} />
          <RecordFact label="Objectives" value={workspace.objectives.length} />
        </div>
      </Panel>
      <Panel title="Record">
        <div className="space-y-3 text-[13px]">
          <IconLabel icon={BookOpenCheck}>Material</IconLabel>
          <IconLabel icon={ClipboardCheck}>Work</IconLabel>
          <IconLabel icon={Target}>Grade</IconLabel>
        </div>
      </Panel>
    </div>
  );
}

function assignmentMeta(assignment: StudentAssignment) {
  if (assignment.gradedAt) return `Graded ${formatShortDate(assignment.gradedAt)}`;
  if (assignment.submittedAt) return `Submitted ${formatShortDate(assignment.submittedAt)}`;
  if (assignment.dueAt) return `Due ${formatShortDate(assignment.dueAt)}`;
  return assignment.status === "open" ? "No due date" : assignment.detail;
}

function formatShortDate(value: Date) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(value);
}
