import { BookOpenCheck, Check, ClipboardCheck, Clock3, FileText, PenLine, Target } from "lucide-react";
import { ProductShell, type CourseSection } from "@/components/atlas/product-shell";
import { CodeList, CommandBand, IconLabel, Panel, ProgressBar, StatusBadge, TextLink } from "@/components/atlas/primitives";
import { PracticeBasePanel, PracticeVariants } from "@/components/atlas/practice-base";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  loadStudentWorkspace,
  type StudentAssignment,
  type StudentCourseNotice,
  type StudentMaterial,
  type StudentWorkspace,
} from "@/lib/student/workspace";
import { CuePanel } from "@/components/agent/cue-panel";
import { EmptyRecord, ObjectiveMeter, RecordFact } from "@/components/atlas/record";

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

const studentSections = [
  { href: "#today", label: "Today", icon: Clock3 },
  { href: "#practice", label: "Practice", icon: PenLine },
  { href: "#material", label: "Material", icon: BookOpenCheck },
  { href: "#work", label: "Work", icon: ClipboardCheck },
  { href: "#coverage", label: "Grade", icon: Target },
] satisfies CourseSection[];

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
  const waitingAssignments = workspace.assignments.filter(isWaitingWork);
  const doneAssignments = workspace.assignments.filter(isDoneWork);
  const visibleAssignments = prioritizeWork(workspace.assignments, workspace.focus.code).slice(0, 5);
  const primaryAssignment = visibleAssignments.find(isOpenWork) ?? visibleAssignments.find(isWaitingWork) ?? visibleAssignments[0];
  const remainingAssignments = primaryAssignment
    ? visibleAssignments.filter((assignment) => !sameAssignment(assignment, primaryAssignment))
    : visibleAssignments;
  const visibleMaterials = prioritizeForObjective(workspace.materials, workspace.focus.code).slice(0, 3);

  return (
    <ProductShell
      active="student"
      persona="Student"
      title={workspace.course.name}
      subtitle={`${workspace.course.code} / ${workspace.course.term}`}
      actor={session?.user}
      scope={workspace.scope}
      scopePath="/student"
      sections={workspace.problem ? undefined : studentSections}
      rail={workspace.problem ? undefined : <StudentRail workspace={workspace} />}
    >
      {workspace.problem ? (
        <Panel title={workspace.problem.title}>
          <p className="text-[14px] leading-6 text-[var(--color-muted)]">{workspace.problem.detail}</p>
        </Panel>
      ) : null}
      {workspace.problem ? null : (
        <>
          <section id="today" className="atlas-section">
            <StudentCommand
              workspace={workspace}
              materials={visibleMaterials}
              primaryAssignment={primaryAssignment}
              assignments={visibleAssignments}
              notices={workspace.notices}
              counts={{
                open: openAssignments.length,
                waiting: waitingAssignments.length,
                done: doneAssignments.length,
              }}
            />
          </section>

          <section id="practice" className="atlas-section">
            <Panel title="Study" action={<StatusBadge tone="neutral">{workspace.student.courseStanding}</StatusBadge>}>
              <FocusSummary workspace={workspace} />
              <PracticeBlock practice={workspace.practice} materials={visibleMaterials} />
            </Panel>
          </section>

          <section id="material" className="atlas-section">
            <Panel title="Material" action={<StatusBadge tone="neutral">{visibleMaterials.length}</StatusBadge>}>
              <MaterialList materials={visibleMaterials} />
            </Panel>
          </section>

          <section id="work" className="atlas-section">
            <Panel title="Work" action={<StatusBadge tone={openAssignments.length > 0 ? "warn" : "good"}>{openAssignments.length}</StatusBadge>}>
              <AssignmentFocus assignment={primaryAssignment} />
              {remainingAssignments.length > 0 ? (
                <div className="mt-5 border-t border-[var(--color-border)] pt-2">
                  <AssignmentList assignments={remainingAssignments} />
                </div>
              ) : null}
            </Panel>
          </section>

          <section id="coverage" className="atlas-section">
            <Panel title="Coverage" action={<StatusBadge tone="neutral">{workspace.objectives.length} objectives</StatusBadge>}>
              <StudentCoverage objectives={workspace.objectives} />
            </Panel>
          </section>
        </>
      )}
    </ProductShell>
  );
}

function FocusSummary({ workspace }: { workspace: StudentWorkspace }) {
  return (
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
  );
}

function StudentCommand({
  workspace,
  materials,
  primaryAssignment,
  assignments,
  notices,
  counts,
}: {
  workspace: StudentWorkspace;
  materials: StudentMaterial[];
  primaryAssignment?: StudentAssignment;
  assignments: StudentAssignment[];
  notices: StudentCourseNotice[];
  counts: {
    open: number;
    waiting: number;
    done: number;
  };
}) {
  const assignment = primaryAssignment ?? assignments[0];
  const primaryMaterial =
    assignment
      ? materials.find((material) => overlaps(material.objectiveCodes, assignment.objectiveCodes)) ??
        materials.find((material) => material.objectiveCodes.includes(workspace.focus.code)) ??
        materials[0]
      : materials.find((material) => material.objectiveCodes.includes(workspace.focus.code)) ?? materials[0];
  const next = nextStudentAction(assignment?.status);

  return (
    <CommandBand
      eyebrow="Today"
      title={todayTitle(workspace.focus.title, assignment)}
      detail={todayDetail(primaryMaterial, next, assignment)}
      after={<StudentTodayContext notices={notices} workspace={workspace} />}
    >
      <RecordFact
        label="Next"
        value={assignment?.id ? <TextLink href={`/student/work/${assignment.id}`}>{next} work</TextLink> : next}
      />
      <RecordFact label="Open" value={String(counts.open)} />
      <RecordFact label="Waiting" value={String(counts.waiting)} />
      <RecordFact label="Done" value={String(counts.done)} />
    </CommandBand>
  );
}

function StudentTodayContext({
  notices,
  workspace,
}: {
  notices: StudentCourseNotice[];
  workspace: StudentWorkspace;
}) {
  return (
    <div className="grid gap-4">
      <CourseNotice notices={notices} />
      {workspace.course.id ? (
        <CuePanel
          target={{ courseId: workspace.course.id, targetType: "course", targetId: null }}
          availability={workspace.cuePolicy}
        />
      ) : null}
    </div>
  );
}

function CourseNotice({ notices }: { notices: StudentCourseNotice[] }) {
  const [latest, ...later] = notices;
  if (!latest) return null;

  return (
    <section className="border-t border-[var(--color-border)] pt-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <IconLabel icon={FileText}>Note</IconLabel>
          <h3 className="mt-2 text-[15px] font-semibold leading-6 text-[var(--color-ink)]">{latest.title}</h3>
          {latest.message ? <p className="mt-1 max-w-3xl text-[13px] leading-5 text-[var(--color-muted)]">{latest.message}</p> : null}
        </div>
        {latest.postedAt ? <StatusBadge tone="neutral">{formatShortDate(latest.postedAt)}</StatusBadge> : null}
      </div>
      {later.length > 0 ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-[12px] font-medium text-[var(--color-muted)] marker:text-[var(--color-faint)]">
            {later.length} earlier
          </summary>
          <div className="mt-2 divide-y divide-[var(--color-border)]">
            {later.map((notice) => (
              <p key={notice.id ?? notice.title} className="py-2 text-[13px] leading-5 text-[var(--color-ink)]">
                {notice.title}
              </p>
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}

function todayTitle(focusTitle: string, assignment?: StudentAssignment) {
  if (assignment && assignment.status !== "graded") return assignment.name;
  return focusTitle;
}

function todayDetail(material: StudentMaterial | undefined, next: string, assignment?: StudentAssignment) {
  if (assignment?.status === "submitted") {
    return "Your response is saved. Check the work record for feedback or revision.";
  }

  if (material) {
    return `Start with Week ${material.week}, then ${next.toLowerCase()} the work.`;
  }

  return `Ask for a package, then move into the next piece of work.`;
}



function nextStudentAction(status?: StudentAssignment["status"]) {
  switch (status) {
    case "graded":
      return "Review";
    case "submitted":
      return "Check";
    case "missing":
      return "Submit";
    case "open":
      return "Submit";
    default:
      return "Review";
  }
}

function PracticeBlock({
  practice,
  materials,
}: {
  practice: StudentWorkspace["practice"];
  materials: StudentMaterial[];
}) {
  const sourceMaterial = materials.find((material) => material.objectiveCodes.includes(practice.objectiveCode)) ?? materials[0];
  const firstVariant = practice.base.variants[0] ?? practice.prompt;

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
          <div className="mt-5 grid gap-3 border-t border-[var(--color-border)] pt-4 text-[13px] sm:grid-cols-3">
            <RecordFact
              label="Review"
              value={
                sourceMaterial?.id ? (
                  <TextLink href={`/student/material/${sourceMaterial.id}`}>{practice.next.review}</TextLink>
                ) : (
                  practice.next.review
                )
              }
              variant="stack"
            />
            <RecordFact label="Try" value={firstVariant} variant="stack" />
            <RecordFact
              label="Do"
              value={
                practice.assignmentId ? (
                  <TextLink href={`/student/work/${practice.assignmentId}`}>{practice.next.do}</TextLink>
                ) : (
                  practice.next.do
                )
              }
              variant="stack"
            />
          </div>
        </div>
        <aside className="border-t border-[var(--color-border)] pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
          <PracticeBasePanel base={practice.base} />
          <PracticeVariants base={practice.base} />
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

function AssignmentFocus({ assignment }: { assignment?: StudentAssignment }) {
  if (!assignment) {
    return <EmptyRecord title="No work" detail="No work is open." />;
  }

  const meta = assignmentMeta(assignment);
  const score = assignmentScore(assignment);
  const next = nextStudentAction(assignment.status);

  return (
    <article>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="text-[12px] font-medium text-[var(--color-muted)]">{meta}</p>
          <h3 className="mt-1 text-[20px] font-semibold leading-7 text-[var(--color-ink)]">
            {assignment.id ? <TextLink href={`/student/work/${assignment.id}`}>{assignment.name}</TextLink> : assignment.name}
          </h3>
          {assignment.description ? (
            <p className="mt-2 max-w-3xl text-[14px] leading-6 text-[var(--color-muted)]">{assignment.description}</p>
          ) : null}
          {assignment.objectiveCodes.length > 0 ? (
            <div className="mt-3">
              <CodeList codes={assignment.objectiveCodes} />
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          {score ? <StatusBadge tone="neutral">{score}</StatusBadge> : null}
          <StatusBadge tone={assignmentTone[assignment.status]}>{assignmentLabel[assignment.status]}</StatusBadge>
        </div>
      </div>

      {assignment.id ? (
        <div className="mt-5 border-t border-[var(--color-border)] pt-3">
          <TextLink href={`/student/work/${assignment.id}`}>{next} work</TextLink>
        </div>
      ) : null}
    </article>
  );
}

function MaterialList({ materials }: { materials: StudentMaterial[] }) {
  return (
    <div className="divide-y divide-[var(--color-border)]">
      {materials.length > 0 ? (
        materials.map((material) => <MaterialLine key={material.id ?? material.title} material={material} />)
      ) : (
        <EmptyRecord title="No material" detail="No material is attached to this objective." />
      )}
    </div>
  );
}

function AssignmentList({ assignments }: { assignments: StudentAssignment[] }) {
  return (
    <div className="divide-y divide-[var(--color-border)]">
      {assignments.length > 0 ? (
        assignments.map((assignment) => <AssignmentLine key={assignment.id ?? assignment.name} assignment={assignment} />)
      ) : (
        <EmptyRecord title="No work" detail="No work is open." />
      )}
    </div>
  );
}

function MaterialLine({ material }: { material: StudentMaterial }) {
  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-medium leading-5 text-[var(--color-ink)]">
            {material.id ? <TextLink href={`/student/material/${material.id}`}>{material.title}</TextLink> : material.title}
          </p>
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
    <div>
      <div className="divide-y divide-[var(--color-border)]">
        {objectives.length > 0 ? (
          objectives.map((objective) => (
            <ObjectiveMeter key={objective.code} objective={objective} progressLabel="Completed" evidenceStyle="badge" />
          ))
        ) : (
          <EmptyRecord title="No objectives" detail="No course objectives yet." />
        )}
      </div>
    </div>
  );
}

function StudentRail({ workspace }: { workspace: StudentWorkspace }) {
  const openWork = workspace.assignments.filter(isOpenWork).length;
  const waitingWork = workspace.assignments.filter(isWaitingWork).length;

  return (
    <Panel title="Course">
      <div className="space-y-4 text-[13px]">
        <RecordFact label="Standing" value={workspace.student.courseStanding} />
        <RecordFact label="Open work" value={openWork} />
        <RecordFact label="Waiting" value={waitingWork} />
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
  const meta = assignmentMeta(assignment);
  const score = assignmentScore(assignment);

  return (
    <article className="py-4 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[14px] font-semibold leading-5 text-[var(--color-ink)]">
            {assignment.id ? <TextLink href={`/student/work/${assignment.id}`}>{assignment.name}</TextLink> : assignment.name}
          </p>
          <p className="mt-1 text-[12px] text-[var(--color-muted)]">{meta}</p>
          {assignment.description ? (
            <p className="mt-2 text-[13px] leading-5 text-[var(--color-muted)]">{assignment.description}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {score ? <StatusBadge tone="neutral">{score}</StatusBadge> : null}
          <StatusBadge tone={assignmentTone[assignment.status]}>{assignmentLabel[assignment.status]}</StatusBadge>
        </div>
      </div>
      {assignment.objectiveCodes.length > 0 ? (
        <div className="mt-2">
          <CodeList codes={assignment.objectiveCodes} />
        </div>
      ) : null}
    </article>
  );
}

function assignmentMeta(assignment: StudentAssignment) {
  if (assignment.gradedAt) return `Graded ${formatShortDate(assignment.gradedAt)}`;
  if (assignment.submittedAt) return `Submitted ${formatShortDate(assignment.submittedAt)}`;
  if (assignment.dueAt) return `Due ${formatShortDate(assignment.dueAt)}`;
  return assignment.status === "open" ? "No due date" : assignment.detail;
}

function assignmentScore(assignment: StudentAssignment) {
  if (assignment.grade) return assignment.grade;
  if (typeof assignment.score !== "number") return null;
  if (typeof assignment.points === "number" && assignment.points > 0) {
    return `${Math.round(assignment.score)}/${Math.round(assignment.points)}`;
  }
  return `${Math.round(assignment.score)}%`;
}

function formatShortDate(value: Date) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(value);
}

function prioritizeForObjective<T extends { objectiveCodes: string[] }>(items: T[], focusCode: string) {
  return [...items].sort((a, b) => Number(b.objectiveCodes.includes(focusCode)) - Number(a.objectiveCodes.includes(focusCode)));
}

function prioritizeWork(items: StudentAssignment[], focusCode: string) {
  return [...items].sort((a, b) => {
    const statusDelta = assignmentOrder(a.status) - assignmentOrder(b.status);
    if (statusDelta !== 0) return statusDelta;

    const aFocus = Number(a.objectiveCodes.includes(focusCode));
    const bFocus = Number(b.objectiveCodes.includes(focusCode));
    if (aFocus !== bFocus) return bFocus - aFocus;

    return 0;
  });
}

function overlaps(a: string[], b: string[]) {
  return a.some((item) => b.includes(item));
}

function sameAssignment(a: StudentAssignment, b: StudentAssignment) {
  if (a.id || b.id) return a.id === b.id;
  return a.name === b.name;
}

function assignmentOrder(status: StudentAssignment["status"]) {
  return { missing: 0, open: 1, submitted: 2, graded: 3 }[status];
}

function isOpenWork(assignment: StudentAssignment) {
  return assignment.status === "open" || assignment.status === "missing";
}

function isWaitingWork(assignment: StudentAssignment) {
  return assignment.status === "submitted";
}

function isDoneWork(assignment: StudentAssignment) {
  return assignment.status === "graded";
}
