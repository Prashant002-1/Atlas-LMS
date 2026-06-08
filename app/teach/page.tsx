import type { ReactNode } from "react";
import { Check, ClipboardCheck, Clock3, FileText, Layers3, Plus, Send, Target, UsersRound, X } from "lucide-react";
import { ProductShell, type CourseSection } from "@/components/atlas/product-shell";
import { ActionButton, CodeList, CommandBand, IconLabel, Panel, StatusBadge, TextLink } from "@/components/atlas/primitives";
import { EmptyRecord, ObjectiveChecklist, ObjectiveMeter, RecordFact } from "@/components/atlas/record";
import { PracticeBasePanel, PracticeBaseStrip, PracticeVariants } from "@/components/atlas/practice-base";
import { auth } from "@/lib/auth";
import { isInstructorLike } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { loadInstructorWorkspace, type InstructorWorkspace } from "@/lib/instructor/workspace";
import {
  createAssignmentRecord,
  createModuleRecord,
  createObjectiveRecord,
  draftCourseProposal,
  publishAssignment,
  publishDraftRecords,
  publishModule,
  reviewCourseProposal,
  updateCourseProposal,
} from "@/lib/instructor/actions";
import { practiceBaseForObjective } from "@/lib/practice/base";

const statusTone = {
  approved: "good",
  draft: "neutral",
  "needs-review": "warn",
} as const;

const statusLabel = {
  approved: "Live",
  draft: "Draft",
  "needs-review": "Review",
} as const;

const proposalTone = {
  ready: "good",
  pending: "good",
  "needs-edit": "warn",
  approved: "good",
  rejected: "warn",
  applied: "accent",
} as const;

const proposalLabel = {
  ready: "Ready",
  pending: "Ready",
  "needs-edit": "Needs edit",
  approved: "Approved",
  rejected: "Dismissed",
  applied: "Applied",
} as const;

const instructorSections = [
  { href: "#today", label: "Today", icon: Clock3 },
  { href: "#review", label: "Review", icon: ClipboardCheck },
  { href: "#publish", label: "Publish", icon: Send },
  { href: "#students", label: "Students", icon: UsersRound },
  { href: "#map", label: "Map", icon: Layers3 },
] satisfies CourseSection[];

export default async function TeachPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in");
  }
  if (session?.user && !isInstructorLike(session.user.role)) {
    redirect("/student");
  }
  const workspace = await loadInstructorWorkspace(session.user);
  const practiceBase = workspace.problem ? null : practiceBaseForObjective(priorityObjective(workspace.objectives)?.code);

  return (
    <ProductShell
      active="teach"
      persona="Instructor"
      title={workspace.course.name}
      subtitle={`${workspace.course.code} / ${workspace.course.term}`}
      actor={session?.user}
      sections={workspace.problem ? undefined : instructorSections}
      rail={workspace.problem ? undefined : <InstructorRail workspace={workspace} practiceBase={practiceBase} />}
    >
      {workspace.problem ? (
        <WorkspaceProblem title={workspace.problem.title} detail={workspace.problem.detail} />
      ) : null}
      {workspace.problem ? null : (
        <>
          <section id="today" className="atlas-section">
            <TeachingCommand workspace={workspace} />
          </section>
          <ReviewPanel workspace={workspace} />
          <PublishPanel workspace={workspace} />
          <StudentsPanel workspace={workspace} />
        </>
      )}

      <section id="map" className="atlas-section">
        <Panel
          title="Course map"
          eyebrow={workspace.course.code}
          action={<StatusBadge tone="neutral">{recordTotal(workspace.modules.length, workspace.assignments.length)}</StatusBadge>}
        >
          <div className="max-w-3xl border-b border-[var(--color-border)] pb-5">
            <IconLabel icon={FileText}>Brief</IconLabel>
            <p className="mt-3 text-[17px] leading-7 text-[var(--color-ink)]">{workspace.course.prompt}</p>
          </div>
          {practiceBase ? <PracticeBaseStrip base={practiceBase} /> : null}

          <div className="grid gap-6 pt-2 xl:grid-cols-[minmax(0,1fr)_300px]">
            <CourseStructure modules={workspace.modules} assignments={workspace.assignments} />
            <ObjectiveCoverage objectives={workspace.objectives} />
          </div>
        </Panel>
      </section>
    </ProductShell>
  );
}

function CourseStructure({
  modules,
  assignments,
}: {
  modules: InstructorWorkspace["modules"];
  assignments: InstructorWorkspace["assignments"];
}) {
  return (
    <div className="min-w-0 space-y-6">
      <section>
        <div className="flex items-center justify-between gap-3 py-2">
          <IconLabel icon={Layers3}>Modules</IconLabel>
          <span className="text-[12px] text-[var(--color-muted)]">{modules.length}</span>
        </div>
        <ModuleSequence modules={modules} />
      </section>

      <section className="border-t border-[var(--color-border)] pt-3">
        <div className="flex items-center justify-between gap-3 py-2">
          <IconLabel icon={ClipboardCheck}>Work</IconLabel>
          <span className="text-[12px] text-[var(--color-muted)]">{assignments.length}</span>
        </div>
        <AssessmentSequence assignments={assignments} />
      </section>
    </div>
  );
}

function ModuleSequence({ modules }: { modules: InstructorWorkspace["modules"] }) {
  return (
    <div className="divide-y divide-[var(--color-border)]">
      {modules.length > 0 ? (
        modules.map((module) => (
          <article
            key={`${module.week}-${module.title}`}
            className="grid gap-3 py-4 first:pt-3 last:pb-0 md:grid-cols-[44px_minmax(0,1fr)_120px] md:items-center"
          >
            <span className="text-[13px] font-semibold text-[var(--color-faint)]">{module.week}</span>
            <div className="min-w-0">
              <h3 className="text-[14px] font-medium leading-6 text-[var(--color-ink)]">
                {module.id ? <TextLink href={`/teach/week/${module.id}`}>{module.title}</TextLink> : module.title}
              </h3>
              {module.summary ? <p className="mt-1 text-[13px] leading-5 text-[var(--color-muted)]">{module.summary}</p> : null}
              <div className="mt-2">
                <CodeList codes={module.objectiveCodes} />
              </div>
            </div>
            <ModuleState module={module} />
          </article>
        ))
      ) : (
        <EmptyRecord title="No weeks" detail="Start from Atlas or add one directly." />
      )}
    </div>
  );
}

function AssessmentSequence({ assignments }: { assignments: InstructorWorkspace["assignments"] }) {
  return (
    <div className="divide-y divide-[var(--color-border)]">
      {assignments.length > 0 ? (
        assignments.map((assignment) => (
          <article
            key={assignment.id ?? assignment.title}
            className="grid gap-3 py-4 first:pt-3 last:pb-0 md:grid-cols-[minmax(0,1fr)_120px] md:items-center"
          >
            <div className="min-w-0">
              <h3 className="text-[14px] font-medium leading-6 text-[var(--color-ink)]">
                {assignment.id ? <TextLink href={`/teach/work/${assignment.id}`}>{assignment.title}</TextLink> : assignment.title}
              </h3>
              {assignment.detail ? (
                <p className="mt-1 text-[13px] leading-5 text-[var(--color-muted)]">{assignment.detail}</p>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-2">
                {assignment.points ? <StatusBadge tone="neutral">{assignment.points} pts</StatusBadge> : null}
                <CodeList codes={assignment.objectiveCodes} />
              </div>
            </div>
            <AssignmentState assignment={assignment} />
          </article>
        ))
      ) : (
        <EmptyRecord title="No work" detail="Start from Atlas or add work directly." />
      )}
    </div>
  );
}

function ObjectiveCoverage({ objectives }: { objectives: InstructorWorkspace["objectives"] }) {
  return (
    <aside className="border-t border-[var(--color-border)] pt-5 xl:border-l xl:border-t-0 xl:pl-5 xl:pt-3">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h3 className="text-[13px] font-semibold text-[var(--color-ink)]">Coverage</h3>
        <span className="text-[12px] text-[var(--color-muted)]">{objectives.length} objectives</span>
      </div>
      <div className="divide-y divide-[var(--color-border)]">
        {objectives.length > 0 ? (
          objectives.map((objective) => (
            <ObjectiveMeter key={objective.code} objective={objective} progressLabel="Coverage" evidenceStyle="line" />
          ))
        ) : (
          <EmptyRecord title="No outcomes" detail="Add the course outcomes that matter." />
        )}
      </div>
    </aside>
  );
}

function AssignmentState({ assignment }: { assignment: InstructorWorkspace["assignments"][number] }) {
  return (
    <div className="flex flex-wrap items-center gap-2 md:justify-self-end">
      <StatusBadge tone={statusTone[assignment.status]}>{statusLabel[assignment.status]}</StatusBadge>
    </div>
  );
}

function ModuleState({ module }: { module: InstructorWorkspace["modules"][number] }) {
  return (
    <div className="flex flex-wrap items-center gap-2 md:justify-self-end">
      <StatusBadge tone={statusTone[module.status]}>{statusLabel[module.status]}</StatusBadge>
    </div>
  );
}

function WorkspaceProblem({ title, detail }: { title: string; detail: string }) {
  return (
    <Panel title={title}>
      <p className="text-[14px] leading-6 text-[var(--color-muted)]">{detail}</p>
    </Panel>
  );
}

function TeachingCommand({ workspace }: { workspace: InstructorWorkspace }) {
  const reviewItems = workspace.proposals.filter((proposal) => proposal.status !== "applied" && proposal.status !== "rejected");
  const currentReview = reviewItems[0];
  const ready = workspace.proposals.filter((proposal) => proposal.status === "pending" || proposal.status === "ready").length;
  const drafts =
    workspace.modules.filter((module) => module.status !== "approved").length +
    workspace.assignments.filter((assignment) => assignment.status !== "approved").length;
  const gradeQueue = workspace.workProgress.reduce((total, item) => total + pendingGrades(item), 0);
  const nextGradeWork = prioritizedWorkProgress(workspace.workProgress).find((item) => pendingGrades(item) > 0);
  const gap = priorityObjective(workspace.objectives);
  const nextDraftModule = workspace.modules.find((module) => module.status !== "approved");
  const nextDraftAssignment = workspace.assignments.find((assignment) => assignment.status !== "approved");
  const next = nextGradeWork
    ? {
        eyebrow: "Grade",
        title: nextGradeWork.title,
        detail: `${pendingGrades(nextGradeWork)} ${pendingGrades(nextGradeWork) === 1 ? "submission" : "submissions"} ready.`,
        href: nextGradeWork.assignmentId ? (`/teach/work/${nextGradeWork.assignmentId}` as const) : ("#students" as const),
        action: "Grade",
      }
    : nextDraftModule
    ? {
        eyebrow: "Next",
        title: `Publish week ${nextDraftModule.week}`,
        detail: nextDraftModule.title,
        href: "#publish" as const,
        action: "Publish",
      }
    : nextDraftAssignment
      ? {
          eyebrow: "Next",
          title: "Publish work",
          detail: nextDraftAssignment.title,
          href: "#publish" as const,
          action: "Publish",
        }
      : gap
        ? {
            eyebrow: "Focus",
            title: `Strengthen ${gap.title}`,
            detail: `${gap.title} is ${gap.coverage}% covered against ${gap.assessedWeight}% assessed weight.`,
            href: "#today" as const,
            action: "Ask",
          }
        : {
            eyebrow: "Current",
            title: "Course record is clear",
            detail: "No objective gaps are modeled yet.",
            href: "#map" as const,
            action: "Open map",
          };
  const reviewCommand = currentReview
    ? {
        eyebrow: "Review",
        title: currentReview.title,
        detail: currentReview.summary,
        href: "#review" as const,
        action: "Review draft",
      }
    : null;
  const command = nextGradeWork ? next : reviewCommand ?? next;

  return (
    <CommandBand
      eyebrow={command.eyebrow}
      title={command.title}
      detail={command.detail}
      after={<RecordComposer workspace={workspace} focus={gap} />}
    >
      <RecordFact label="Next" value={<TextLink href={command.href}>{command.action}</TextLink>} />
      <RecordFact label="Grade" value={gradeQueue} />
      <RecordFact label="Draft" value={drafts} />
      <RecordFact label="Review" value={ready} />
    </CommandBand>
  );
}

function ReviewPanel({ workspace }: { workspace: InstructorWorkspace }) {
  const reviewItems = workspace.proposals.filter((proposal) => proposal.status !== "applied" && proposal.status !== "rejected");
  const ready = reviewItems.filter((proposal) => proposal.status === "pending" || proposal.status === "ready").length;
  const recentItems = workspace.proposals
    .filter((proposal) => proposal.status === "applied" || proposal.status === "rejected")
    .sort((a, b) => decisionTime(b) - decisionTime(a))
    .slice(0, 3);
  const [current, ...later] = reviewItems;

  return (
    <section id="review" className="atlas-section">
      <Panel
        title="Review"
        action={<StatusBadge tone={ready > 0 ? "good" : reviewItems.length > 0 ? "warn" : "neutral"}>{reviewItems.length}</StatusBadge>}
      >
        {current ? (
          <ReviewItem proposal={current} />
        ) : (
          <div className="py-2">
            <p className="text-[14px] font-semibold text-[var(--color-ink)]">Clear</p>
            <p className="mt-1 text-[12px] text-[var(--color-muted)]">Nothing waiting.</p>
          </div>
        )}
        {later.length > 0 ? (
          <details className="mt-4 border-t border-[var(--color-border)] pt-3">
            <summary className="cursor-pointer rounded-[6px] text-[13px] font-medium text-[var(--color-muted)] marker:text-[var(--color-faint)]">
              {later.length} later
            </summary>
            <div className="mt-3 divide-y divide-[var(--color-border)]">
              {later.map((proposal) => (
                <ReviewItem key={proposal.id ?? proposal.title} proposal={proposal} compact />
              ))}
            </div>
          </details>
        ) : null}
        {recentItems.length > 0 ? <RecentDecisions proposals={recentItems} /> : null}
      </Panel>
    </section>
  );
}

function PublishPanel({ workspace }: { workspace: InstructorWorkspace }) {
  const draftModules = workspace.modules.filter((module) => module.id && module.status === "draft");
  const draftAssignments = workspace.assignments.filter((assignment) => assignment.id && assignment.status === "draft");
  const queueSize = draftModules.length + draftAssignments.length;
  const primaryModule = draftModules[0];
  const primaryAssignment = primaryModule ? undefined : draftAssignments[0];
  const laterModules = primaryModule ? draftModules.slice(1) : draftModules;
  const laterAssignments = primaryAssignment ? draftAssignments.slice(1) : draftAssignments;
  const laterCount = laterModules.length + laterAssignments.length;

  return (
    <section id="publish" className="atlas-section">
      <Panel
        title="Publish"
        action={
          queueSize > 1 ? (
            <form action={publishDraftRecords}>
              <ActionButton ariaLabel={`Publish ${queueSize} drafts`} title={`Publish ${queueSize} drafts`}>
                <Check size={14} strokeWidth={2} aria-hidden="true" />
                <span className="ml-1.5">Publish queue</span>
              </ActionButton>
            </form>
          ) : (
            <StatusBadge tone={queueSize > 0 ? "warn" : "good"}>{queueSize}</StatusBadge>
          )
        }
      >
        {queueSize > 0 ? (
          <div>
            {primaryModule ? <PublishModuleItem module={primaryModule} /> : null}
            {primaryAssignment ? <PublishAssignmentItem assignment={primaryAssignment} /> : null}
            {laterCount > 0 ? (
              <details className="mt-4 border-t border-[var(--color-border)] pt-3">
                <summary className="cursor-pointer rounded-[6px] text-[13px] font-medium text-[var(--color-muted)] marker:text-[var(--color-faint)]">
                  {laterCount} later
                </summary>
                <div className="mt-3 divide-y divide-[var(--color-border)]">
                  {laterModules.map((module) => (
                    <PublishModuleItem key={module.id} module={module} />
                  ))}
                  {laterAssignments.map((assignment) => (
                    <PublishAssignmentItem key={assignment.id} assignment={assignment} />
                  ))}
                </div>
              </details>
            ) : null}
          </div>
        ) : (
          <EmptyRecord title="Nothing waiting" detail="No drafts in the queue." />
        )}
      </Panel>
    </section>
  );
}

function PublishModuleItem({ module }: { module: InstructorWorkspace["modules"][number] }) {
  if (!module.id) return null;

  return (
    <article className="grid gap-3 py-4 first:pt-0 last:pb-0 md:grid-cols-[minmax(0,1fr)_120px] md:items-center">
      <div className="min-w-0">
        <p className="text-[12px] font-medium text-[var(--color-muted)]">Week {module.week}</p>
        <h3 className="mt-1 text-[14px] font-semibold leading-6 text-[var(--color-ink)]">
          <TextLink href={`/teach/week/${module.id}`}>{module.title}</TextLink>
        </h3>
        {module.summary ? <p className="mt-1 text-[13px] leading-5 text-[var(--color-muted)]">{module.summary}</p> : null}
        <div className="mt-2">
          <CodeList codes={module.objectiveCodes} />
        </div>
      </div>
      <form action={publishModule} className="md:justify-self-end">
        <input type="hidden" name="moduleId" value={module.id} />
        <ActionButton className="w-full md:w-auto" ariaLabel={`Publish week ${module.week}: ${module.title}`} title={`Publish week ${module.week}: ${module.title}`}>
          <Check size={14} strokeWidth={2} aria-hidden="true" />
          <span className="ml-1.5">Publish</span>
        </ActionButton>
      </form>
    </article>
  );
}

function PublishAssignmentItem({ assignment }: { assignment: InstructorWorkspace["assignments"][number] }) {
  if (!assignment.id) return null;

  return (
    <article className="grid gap-3 py-4 first:pt-0 last:pb-0 md:grid-cols-[minmax(0,1fr)_120px] md:items-center">
      <div className="min-w-0">
        <p className="text-[12px] font-medium text-[var(--color-muted)]">Work</p>
        <h3 className="mt-1 text-[14px] font-semibold leading-6 text-[var(--color-ink)]">
          {assignment.id ? <TextLink href={`/teach/work/${assignment.id}`}>{assignment.title}</TextLink> : assignment.title}
        </h3>
        {assignment.detail ? <p className="mt-1 text-[13px] leading-5 text-[var(--color-muted)]">{assignment.detail}</p> : null}
        <div className="mt-2 flex flex-wrap gap-2">
          {assignment.points ? <StatusBadge tone="neutral">{assignment.points} pts</StatusBadge> : null}
          <CodeList codes={assignment.objectiveCodes} />
        </div>
      </div>
      <form action={publishAssignment} className="md:justify-self-end">
        <input type="hidden" name="assignmentId" value={assignment.id} />
        <ActionButton className="w-full md:w-auto" ariaLabel={`Publish ${assignment.title}`} title={`Publish ${assignment.title}`}>
          <Check size={14} strokeWidth={2} aria-hidden="true" />
          <span className="ml-1.5">Publish</span>
        </ActionButton>
      </form>
    </article>
  );
}

function StudentsPanel({ workspace }: { workspace: InstructorWorkspace }) {
  const gradeQueue = workspace.workProgress.reduce((total, item) => total + pendingGrades(item), 0);
  const graded = workspace.workProgress.reduce((total, item) => total + item.graded, 0);
  const open = workspace.workProgress.reduce((total, item) => total + item.open, 0);

  return (
    <section id="students" className="atlas-section">
      <Panel title="Students" action={<StatusBadge tone="neutral">{workspace.students.length}</StatusBadge>}>
        {workspace.students.length > 0 ? (
          <div className="grid gap-5">
            <div className="grid gap-3 border-b border-[var(--color-border)] pb-4 sm:grid-cols-3">
              <RecordFact label="To grade" value={gradeQueue} variant="stack" />
              <RecordFact label="Graded" value={graded} variant="stack" />
              <RecordFact label="Open" value={open} variant="stack" />
            </div>
            <WorkProgressList items={prioritizedWorkProgress(workspace.workProgress)} />
            <details className="border-t border-[var(--color-border)] pt-4">
              <summary className="cursor-pointer rounded-[6px] marker:text-[var(--color-faint)]">
                <span className="inline-flex w-[calc(100%-1.5rem)] items-center justify-between gap-3 align-middle">
                  <IconLabel icon={UsersRound}>Roster</IconLabel>
                  <span className="text-[12px] text-[var(--color-muted)]">{workspace.students.length}</span>
                </span>
              </summary>
              <div className="mt-3">
                <StudentProgressList students={workspace.students} />
              </div>
            </details>
          </div>
        ) : (
          <EmptyRecord title="No students" detail="No enrolled students." />
        )}
      </Panel>
    </section>
  );
}

function WorkProgressList({ items }: { items: InstructorWorkspace["workProgress"] }) {
  if (items.length === 0) {
    return <EmptyRecord title="No live work" detail="No submissions yet." />;
  }

  return (
    <div className="divide-y divide-[var(--color-border)]">
      {items.map((item) => (
        <article key={item.assignmentId ?? item.title} className="py-4 first:pt-4 last:pb-0">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <p className="text-[14px] font-semibold leading-5 text-[var(--color-ink)]">
                {item.assignmentId ? <TextLink href={`/teach/work/${item.assignmentId}`}>{item.title}</TextLink> : item.title}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {pendingGrades(item) > 0 ? <StatusBadge tone="warn">{pendingGrades(item)} to grade</StatusBadge> : null}
                {item.dueAt ? <StatusBadge tone="neutral">Due {formatShortDate(item.dueAt)}</StatusBadge> : null}
                {item.points ? <StatusBadge tone="neutral">{item.points} pts</StatusBadge> : null}
                <CodeList codes={item.objectiveCodes} />
              </div>
            </div>
            <div className="grid min-w-48 grid-cols-3 gap-2 text-[12px]">
              <RecordFact label="Submitted" value={item.submitted} variant="stack" />
              <RecordFact label="Graded" value={item.graded} variant="stack" />
              <RecordFact label="Open" value={item.open} variant="stack" />
            </div>
          </div>
          {item.missing > 0 || item.responses > 0 ? (
            <p className="mt-3 text-[12px] leading-5 text-[var(--color-muted)]">
              {item.responses > 0 ? `${item.responses} written ${item.responses === 1 ? "response" : "responses"}` : null}
              {item.responses > 0 && item.missing > 0 ? " / " : null}
              {item.missing > 0 ? `${item.missing} missing` : null}
            </p>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function prioritizedWorkProgress(items: InstructorWorkspace["workProgress"]) {
  return [...items].sort((a, b) => {
    const gradeDelta = pendingGrades(b) - pendingGrades(a);
    if (gradeDelta !== 0) return gradeDelta;
    return (b.responses + b.missing) - (a.responses + a.missing);
  });
}

function pendingGrades(item: InstructorWorkspace["workProgress"][number]) {
  return Math.max(0, item.submitted - item.graded);
}

function StudentProgressList({ students }: { students: InstructorWorkspace["students"] }) {
  return (
    <div className="divide-y divide-[var(--color-border)]">
      {students.map((student) => (
        <article key={student.id ?? student.email ?? student.name} className="py-4 first:pt-2 last:pb-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[14px] font-semibold leading-5 text-[var(--color-ink)]">
                {student.id ? <TextLink href={`/teach/student/${student.id}`}>{student.name}</TextLink> : student.name}
              </p>
            </div>
            <StatusBadge tone="neutral">{student.standing}</StatusBadge>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-[12px]">
            <RecordFact label="Submitted" value={student.submitted} variant="stack" />
            <RecordFact label="Graded" value={student.graded} variant="stack" />
            <RecordFact label="Open" value={student.open} variant="stack" />
          </div>
          {student.evidence.length > 0 ? (
            <div className="mt-3 space-y-1">
              {student.evidence.map((item) => (
                <p key={item} className="text-[12px] leading-5 text-[var(--color-muted)]">
                  {item}
                </p>
              ))}
            </div>
          ) : null}
          {student.lastActivityAt ? (
            <p className="mt-3 text-[12px] text-[var(--color-faint)]">Last active {formatShortDate(student.lastActivityAt)}</p>
          ) : null}
          {student.missing > 0 ? <p className="mt-2 text-[12px] text-[var(--color-warn)]">{student.missing} missing</p> : null}
        </article>
      ))}
    </div>
  );
}

function RecordComposer({
  workspace,
  focus,
}: {
  workspace: InstructorWorkspace;
  focus?: InstructorWorkspace["objectives"][number];
}) {
  const recent = workspace.proposals.slice(0, 3);

  return (
    <div className="grid gap-5">
      <CourseCommand focus={focus} />
      <CommandHistory proposals={recent} />
      <details className="border-t border-[var(--color-border)] pt-4">
        <summary className="cursor-pointer rounded-[6px] marker:text-[var(--color-faint)]">
          <span className="inline-flex w-[calc(100%-1.5rem)] items-center justify-between gap-3 align-middle">
            <span className="text-[14px] font-semibold text-[var(--color-ink)]">Records</span>
            <span className="text-right text-[12px] text-[var(--color-muted)]">Weeks / Work / Outcomes</span>
          </span>
        </summary>
        <div className="mt-4 divide-y divide-[var(--color-border)]">
          <ComposerTask title="Week" detail="Plan a course week">
            <ModuleComposer objectives={workspace.objectives} focus={focus} />
          </ComposerTask>
          <ComposerTask title="Work" detail="Add an assignment">
            <AssignmentComposer objectives={workspace.objectives} focus={focus} />
          </ComposerTask>
          <ComposerTask title="Objective" detail="Set a course outcome">
            <ObjectiveComposer nextCode={nextObjectiveLabel(workspace.objectives)} />
          </ComposerTask>
        </div>
      </details>
    </div>
  );
}

function CommandHistory({ proposals }: { proposals: InstructorWorkspace["proposals"] }) {
  if (proposals.length === 0) {
    return <EmptyRecord title="No drafts" detail="Nothing waiting." />;
  }

  return (
    <div className="border-t border-[var(--color-border)] pt-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-[12px] font-medium text-[var(--color-ink)]">Recent</p>
        <TextLink href="#review" className="text-[12px]">
          Review
        </TextLink>
      </div>
      <div className="divide-y divide-[var(--color-border)]">
        {proposals.map((proposal) => (
          <article key={proposal.id ?? `${proposal.title}-${proposal.createdAt?.toISOString()}`} className="py-3 first:pt-0 last:pb-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold leading-5 text-[var(--color-ink)]">{proposal.title}</p>
                <p className="mt-1 text-[12px] leading-5 text-[var(--color-muted)]">{proposal.summary}</p>
              </div>
              <StatusBadge tone={proposalTone[proposal.status]}>{proposalLabel[proposal.status]}</StatusBadge>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function CourseCommand({ focus }: { focus?: InstructorWorkspace["objectives"][number] }) {
  const placeholder = [
    "Create a short practice sequence for next week from the clinic wait sample.",
    "Turn the regression notes into a week and one checkpoint.",
    "Tell the class to bring one question from the sampling notes.",
    focus ? `Keep the emphasis on ${focus.title.toLowerCase()}.` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <form action={draftCourseProposal} className="grid gap-3">
      <input type="hidden" name="kind" value="import" />
      {focus ? (
        <>
          <input type="hidden" name="focusCode" value={focus.code} />
          <input type="hidden" name="focusTitle" value={focus.title} />
          <input type="hidden" name="focusDescription" value={focus.description} />
        </>
      ) : null}
      <label className="grid gap-1.5 text-[12px] font-medium text-[var(--color-ink)]">
        Message
        <textarea
          name="intent"
          required
          minLength={12}
          placeholder={placeholder}
          className="min-h-40 resize-none rounded-[8px] border border-[var(--color-border)] bg-white px-3 py-3 text-[14px] leading-6 text-[var(--color-ink)] transition focus:border-[var(--color-accent-strong)]"
        />
      </label>
      <div>
        <ActionButton>
          <Send size={14} strokeWidth={2} aria-hidden="true" />
          <span className="ml-1.5">Send</span>
        </ActionButton>
      </div>
    </form>
  );
}

function ComposerTask({ title, detail, children }: { title: string; detail: string; children: ReactNode }) {
  return (
    <details className="py-4 first:pt-0 last:pb-0">
      <summary className="cursor-pointer rounded-[6px] marker:text-[var(--color-faint)]">
        <span className="inline-flex w-[calc(100%-1.5rem)] items-center justify-between gap-3 align-middle">
          <span className="text-[14px] font-semibold text-[var(--color-ink)]">{title}</span>
          <span className="text-right text-[12px] text-[var(--color-muted)]">{detail}</span>
        </span>
      </summary>
      <div className="mt-4">{children}</div>
    </details>
  );
}

function ModuleComposer({
  objectives,
  focus,
}: {
  objectives: InstructorWorkspace["objectives"];
  focus?: InstructorWorkspace["objectives"][number];
}) {
  return (
    <form action={createModuleRecord} className="grid gap-3">
      <ObjectiveChecklist objectives={objectives} selectedCodes={focus ? [focus.code] : []} />
      <label className="grid gap-1.5 text-[12px] font-medium text-[var(--color-ink)]">
        Week
        <input
          name="title"
          type="text"
          required
          placeholder={focus ? `${focus.code}: ${focus.title}` : "Week title"}
          className="min-h-10 rounded-[8px] border border-[var(--color-border)] bg-white px-3 text-[14px] text-[var(--color-ink)] transition focus:border-[var(--color-accent-strong)]"
        />
      </label>
      <label className="grid gap-1.5 text-[12px] font-medium text-[var(--color-ink)]">
        Summary
        <textarea
          name="summary"
          placeholder={focus ? focus.description : ""}
          className="min-h-24 resize-none rounded-[8px] border border-[var(--color-border)] bg-white px-3 py-3 text-[14px] leading-6 text-[var(--color-ink)] transition focus:border-[var(--color-accent-strong)]"
        />
      </label>
      <div>
        <ActionButton>
          <Plus size={14} strokeWidth={2} aria-hidden="true" />
          <span className="ml-1.5">Add week</span>
        </ActionButton>
      </div>
    </form>
  );
}

function AssignmentComposer({
  objectives,
  focus,
}: {
  objectives: InstructorWorkspace["objectives"];
  focus?: InstructorWorkspace["objectives"][number];
}) {
  return (
    <form action={createAssignmentRecord} className="grid gap-3">
      <ObjectiveChecklist objectives={objectives} selectedCodes={focus ? [focus.code] : []} />
      <label className="grid gap-1.5 text-[12px] font-medium text-[var(--color-ink)]">
        Work
        <input
          name="title"
          type="text"
          required
          placeholder={focus ? `${focus.code} check` : "Assignment title"}
          className="min-h-10 rounded-[8px] border border-[var(--color-border)] bg-white px-3 text-[14px] text-[var(--color-ink)] transition focus:border-[var(--color-accent-strong)]"
        />
      </label>
      <label className="grid gap-1.5 text-[12px] font-medium text-[var(--color-ink)]">
        Description
        <textarea
          name="description"
          placeholder={focus ? focus.description : ""}
          className="min-h-24 resize-none rounded-[8px] border border-[var(--color-border)] bg-white px-3 py-3 text-[14px] leading-6 text-[var(--color-ink)] transition focus:border-[var(--color-accent-strong)]"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
        <label className="grid gap-1.5 text-[12px] font-medium text-[var(--color-ink)]">
          Due
          <input
            name="dueDate"
            type="date"
            className="min-h-10 rounded-[8px] border border-[var(--color-border)] bg-white px-3 text-[14px] text-[var(--color-ink)] transition focus:border-[var(--color-accent-strong)]"
          />
        </label>
        <label className="grid gap-1.5 text-[12px] font-medium text-[var(--color-ink)]">
          Points
          <input
            name="points"
            type="number"
            min={0.01}
            step="0.01"
            defaultValue={100}
            className="min-h-10 rounded-[8px] border border-[var(--color-border)] bg-white px-3 text-[14px] text-[var(--color-ink)] transition focus:border-[var(--color-accent-strong)]"
          />
        </label>
      </div>
      <div>
        <ActionButton>
          <Plus size={14} strokeWidth={2} aria-hidden="true" />
          <span className="ml-1.5">Add work</span>
        </ActionButton>
      </div>
    </form>
  );
}

function ObjectiveComposer({ nextCode }: { nextCode: string }) {
  return (
    <form action={createObjectiveRecord} className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-[120px_minmax(0,1fr)_140px]">
        <label className="grid gap-1.5 text-[12px] font-medium text-[var(--color-ink)]">
          Code
          <input
            name="code"
            type="text"
            placeholder={nextCode}
            className="min-h-10 rounded-[8px] border border-[var(--color-border)] bg-white px-3 text-[14px] uppercase text-[var(--color-ink)] transition focus:border-[var(--color-accent-strong)]"
          />
        </label>
        <label className="grid gap-1.5 text-[12px] font-medium text-[var(--color-ink)]">
          Level
          <select
            name="bloomLevel"
            defaultValue="apply"
            className="min-h-10 rounded-[8px] border border-[var(--color-border)] bg-white px-3 text-[14px] text-[var(--color-ink)] transition focus:border-[var(--color-accent-strong)]"
          >
            <option value="understand">Understand</option>
            <option value="apply">Apply</option>
            <option value="analyze">Analyze</option>
            <option value="evaluate">Evaluate</option>
            <option value="create">Create</option>
          </select>
        </label>
        <label className="grid gap-1.5 text-[12px] font-medium text-[var(--color-ink)]">
          Weight %
          <input
            name="weight"
            type="number"
            min={1}
            max={100}
            step={1}
            defaultValue={10}
            className="min-h-10 rounded-[8px] border border-[var(--color-border)] bg-white px-3 text-[14px] text-[var(--color-ink)] transition focus:border-[var(--color-accent-strong)]"
          />
        </label>
      </div>
      <label className="grid gap-1.5 text-[12px] font-medium text-[var(--color-ink)]">
        Objective
        <textarea
          name="description"
          required
          className="min-h-24 resize-none rounded-[8px] border border-[var(--color-border)] bg-white px-3 py-3 text-[14px] leading-6 text-[var(--color-ink)] transition focus:border-[var(--color-accent-strong)]"
        />
      </label>
      <div>
        <ActionButton>
          <Plus size={14} strokeWidth={2} aria-hidden="true" />
          <span className="ml-1.5">Add objective</span>
        </ActionButton>
      </div>
    </form>
  );
}

function nextObjectiveLabel(objectives: InstructorWorkspace["objectives"]) {
  const highest = objectives.reduce((max, objective) => {
    const match = objective.code.match(/^LO(\d+)$/i);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `LO${highest + 1}`;
}

function InstructorRail({
  workspace,
  practiceBase,
}: {
  workspace: InstructorWorkspace;
  practiceBase: ReturnType<typeof practiceBaseForObjective> | null;
}) {
  const reviewItems = workspace.proposals.filter((proposal) => proposal.status !== "applied" && proposal.status !== "rejected");
  const ready = reviewItems.filter((proposal) => proposal.status === "pending" || proposal.status === "ready").length;
  const focus = priorityObjective(workspace.objectives);
  const live =
    workspace.modules.filter((module) => module.status === "approved").length +
    workspace.assignments.filter((assignment) => assignment.status === "approved").length;
  const drafts =
    workspace.modules.filter((module) => module.status !== "approved").length +
    workspace.assignments.filter((assignment) => assignment.status !== "approved").length;
  const latestNotice = workspace.notices[0];

  return (
    <div className="space-y-5">
      <Panel title="Course">
        <div className="space-y-3 text-[13px]">
          <RecordFact label="Live" value={live} />
          <RecordFact label="Draft" value={drafts} />
          <RecordFact label="Review" value={ready} />
          <RecordFact label="Gap" value={focus ? `${focus.code} / ${focus.coverage}%` : "-"} />
        </div>
        {focus ? (
          <div className="mt-5 border-t border-[var(--color-border)] pt-4">
            <IconLabel icon={Target}>Coverage</IconLabel>
            <p className="mt-2 text-[13px] font-semibold leading-5 text-[var(--color-ink)]">{focus.title}</p>
            <p className="mt-1 text-[12px] leading-5 text-[var(--color-muted)]">{focus.description}</p>
          </div>
        ) : null}
        {latestNotice ? (
          <div className="mt-5 border-t border-[var(--color-border)] pt-4">
            <IconLabel icon={FileText}>Note</IconLabel>
            <p className="mt-2 text-[13px] font-semibold leading-5 text-[var(--color-ink)]">{latestNotice.title}</p>
            {latestNotice.postedAt ? <p className="mt-1 text-[12px] text-[var(--color-faint)]">{formatShortDate(latestNotice.postedAt)}</p> : null}
          </div>
        ) : null}
      </Panel>

      {practiceBase ? (
        <Panel title="Practice">
          <PracticeBasePanel base={practiceBase} />
          <PracticeVariants base={practiceBase} />
        </Panel>
      ) : null}
    </div>
  );
}

function RecentDecisions({ proposals }: { proposals: InstructorWorkspace["proposals"] }) {
  return (
    <details className="mt-4 border-t border-[var(--color-border)] pt-3">
      <summary className="cursor-pointer text-[13px] font-medium text-[var(--color-muted)] marker:text-[var(--color-faint)]">
        Recent
      </summary>
      <div className="mt-3 divide-y divide-[var(--color-border)]">
        {proposals.map((proposal) => (
          <DecisionItem key={proposal.id ?? `${proposal.title}-${proposal.status}`} proposal={proposal} />
        ))}
      </div>
    </details>
  );
}

function DecisionItem({ proposal }: { proposal: InstructorWorkspace["proposals"][number] }) {
  const summary = uniqueText(proposal.summary, proposal.title) ? proposal.summary : null;
  const details = proposal.details.filter((detail) => uniqueText(detail, proposal.title, proposal.summary));

  return (
    <article className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold leading-5 text-[var(--color-ink)]">{proposal.title}</p>
          <p className="mt-1 text-[12px] text-[var(--color-muted)]">{formatKind(proposal.kind)}</p>
        </div>
        <StatusBadge tone={proposalTone[proposal.status]}>{proposalLabel[proposal.status]}</StatusBadge>
      </div>
      {summary ? <p className="mt-2 text-[12px] leading-5 text-[var(--color-muted)]">{summary}</p> : null}
      {details.length > 0 ? (
        <div className="mt-2 space-y-1">
          {details.slice(0, 2).map((detail) => (
            <p key={detail} className="text-[12px] leading-5 text-[var(--color-faint)]">
              {detail}
            </p>
          ))}
        </div>
      ) : null}
      {proposal.appliedRecords.length > 0 ? <AppliedRecordLinks records={proposal.appliedRecords} /> : null}
      <ProposalMeta proposal={proposal} />
    </article>
  );
}

function AppliedRecordLinks({ records }: { records: InstructorWorkspace["proposals"][number]["appliedRecords"] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {records.map((record) => (
        <TextLink key={`${record.label}-${record.href}`} href={record.href} className="text-[12px]">
          {record.label}
        </TextLink>
      ))}
    </div>
  );
}

function ReviewItem({ proposal, compact = false }: { proposal: InstructorWorkspace["proposals"][number]; compact?: boolean }) {
  const readyProposalId = proposal.status === "pending" ? proposal.id : undefined;
  const summary = uniqueText(proposal.summary, proposal.title) ? proposal.summary : null;
  const details = proposal.details.filter((detail) => uniqueText(detail, proposal.title, proposal.summary));
  const reviewAction = proposal.actionLabel ?? (["assignment", "import", "module"].includes(proposal.kind) ? "Make live" : "Apply");

  return (
    <article className={compact ? "py-3 first:pt-0 last:pb-0" : "py-1"}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[14px] font-semibold leading-5 text-[var(--color-ink)]">{proposal.title}</p>
          <p className="mt-1 text-[12px] text-[var(--color-muted)]">{formatKind(proposal.kind)}</p>
        </div>
        <StatusBadge tone={proposalTone[proposal.status]}>{proposalLabel[proposal.status]}</StatusBadge>
      </div>
      {!compact && summary ? <p className="mt-3 text-[13px] leading-5 text-[var(--color-muted)]">{summary}</p> : null}
      {!compact && details.length > 0 ? <ReviewDetails details={details} /> : null}
      {!compact && readyProposalId && proposal.editableDraft ? <ProposalEditForm proposalId={readyProposalId} draft={proposal.editableDraft} /> : null}
      <ProposalMeta proposal={proposal} />
      {readyProposalId ? <ProposalReviewActions proposalId={readyProposalId} primaryLabel={reviewAction} /> : null}
    </article>
  );
}

function ProposalEditForm({
  proposalId,
  draft,
}: {
  proposalId: string;
  draft: NonNullable<InstructorWorkspace["proposals"][number]["editableDraft"]>;
}) {
  return (
    <details className="mt-3 border-t border-[var(--color-border)] pt-3">
      <summary className="cursor-pointer text-[12px] font-medium text-[var(--color-muted)] marker:text-[var(--color-faint)]">
        Edit
      </summary>
      <form action={updateCourseProposal} className="mt-3 grid gap-3">
        <input type="hidden" name="proposalId" value={proposalId} />
        {draft.material ? (
          <div className="grid gap-3">
            <label className="grid gap-1.5 text-[12px] font-medium text-[var(--color-ink)]">
              Material
              <input
                name="materialTitle"
                type="text"
                defaultValue={draft.material.title}
                className="min-h-10 rounded-[8px] border border-[var(--color-border)] bg-white px-3 text-[14px] text-[var(--color-ink)] transition focus:border-[var(--color-accent-strong)]"
              />
            </label>
            <label className="grid gap-1.5 text-[12px] font-medium text-[var(--color-ink)]">
              Notes
              <textarea
                name="materialSummary"
                defaultValue={draft.material.summary}
                className="min-h-24 resize-none rounded-[8px] border border-[var(--color-border)] bg-white px-3 py-3 text-[14px] leading-6 text-[var(--color-ink)] transition focus:border-[var(--color-accent-strong)]"
              />
            </label>
          </div>
        ) : null}
        {draft.work ? (
          <div className="grid gap-3 border-t border-[var(--color-border)] pt-3">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px]">
              <label className="grid gap-1.5 text-[12px] font-medium text-[var(--color-ink)]">
                Work
                <input
                  name="workTitle"
                  type="text"
                  defaultValue={draft.work.title}
                  className="min-h-10 rounded-[8px] border border-[var(--color-border)] bg-white px-3 text-[14px] text-[var(--color-ink)] transition focus:border-[var(--color-accent-strong)]"
                />
              </label>
              <label className="grid gap-1.5 text-[12px] font-medium text-[var(--color-ink)]">
                Points
                <input
                  name="workPoints"
                  type="number"
                  min={0.01}
                  step="0.01"
                  defaultValue={draft.work.points}
                  className="min-h-10 rounded-[8px] border border-[var(--color-border)] bg-white px-3 text-[14px] text-[var(--color-ink)] transition focus:border-[var(--color-accent-strong)]"
                />
              </label>
            </div>
            <label className="grid gap-1.5 text-[12px] font-medium text-[var(--color-ink)]">
              Prompt
              <textarea
                name="workDetail"
                defaultValue={draft.work.detail}
                className="min-h-24 resize-none rounded-[8px] border border-[var(--color-border)] bg-white px-3 py-3 text-[14px] leading-6 text-[var(--color-ink)] transition focus:border-[var(--color-accent-strong)]"
              />
            </label>
          </div>
        ) : null}
        <div>
          <ActionButton variant="secondary">Save draft</ActionButton>
        </div>
      </form>
    </details>
  );
}

function ReviewDetails({ details }: { details: string[] }) {
  return (
    <details className="mt-3 border-t border-[var(--color-border)] pt-3">
      <summary className="cursor-pointer text-[12px] font-medium text-[var(--color-muted)] marker:text-[var(--color-faint)]">
        Details
      </summary>
      <div className="mt-3 space-y-2">
        {details.map((detail) => (
          <p key={detail} className="text-[13px] leading-5 text-[var(--color-muted)]">
            {detail}
          </p>
        ))}
      </div>
    </details>
  );
}

function ProposalReviewActions({ proposalId, primaryLabel }: { proposalId: string; primaryLabel: string }) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-2">
      <form action={reviewCourseProposal}>
        <input type="hidden" name="proposalId" value={proposalId} />
        <input type="hidden" name="decision" value="approved" />
        <ActionButton className="w-full">
          <Check size={14} strokeWidth={2} aria-hidden="true" />
          <span className="ml-1.5">{primaryLabel}</span>
        </ActionButton>
      </form>
      <form action={reviewCourseProposal}>
        <input type="hidden" name="proposalId" value={proposalId} />
        <input type="hidden" name="decision" value="rejected" />
        <ActionButton variant="danger" className="w-full">
          <X size={14} strokeWidth={2} aria-hidden="true" />
          <span className="ml-1.5">Dismiss</span>
        </ActionButton>
      </form>
    </div>
  );
}

function ProposalMeta({ proposal }: { proposal: InstructorWorkspace["proposals"][number] }) {
  const created = formatDate(proposal.createdAt);
  const decided = formatDate(proposal.decidedAt);
  const label = decided ? `Decided ${decided}` : created ? `Drafted ${created}` : null;

  if (!label) return null;

  return (
    <div className="mt-3 flex items-center gap-2 text-[12px] text-[var(--color-faint)]">
      <Clock3 size={13} strokeWidth={2} aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

function formatDate(value?: Date | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

function formatShortDate(value: Date) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(value);
}

function formatKind(value: string) {
  const labels: Record<string, string> = {
    course: "Request",
    syllabus: "Syllabus",
    module: "Week",
    assignment: "Work",
    quiz: "Quiz",
    rubric: "Rubric",
    objective: "Objective",
    alignment: "Alignment",
    import: "Plan",
  };
  if (labels[value]) return labels[value];

  return value
    .split("-")
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}

function recordTotal(modules: number, assignments: number) {
  const weekLabel = modules === 1 ? "week" : "weeks";
  const workLabel = assignments === 1 ? "work item" : "work items";
  return `${modules} ${weekLabel} / ${assignments} ${workLabel}`;
}

function decisionTime(proposal: InstructorWorkspace["proposals"][number]) {
  return proposal.decidedAt?.getTime() ?? proposal.createdAt?.getTime() ?? 0;
}

function uniqueText(value: string, ...existing: string[]) {
  const normalized = normalizeText(value);
  return Boolean(normalized) && existing.every((item) => normalizeText(item) !== normalized);
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ").replace(/[.!?]+$/, "").toLowerCase();
}

function priorityObjective(objectives: InstructorWorkspace["objectives"]) {
  return [...objectives].sort((a, b) => b.assessedWeight * (100 - b.coverage) - a.assessedWeight * (100 - a.coverage))[0];
}
