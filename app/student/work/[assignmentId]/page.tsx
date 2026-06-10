import type { ReactNode } from "react";
import { BookOpenCheck, Check, ClipboardCheck, Target } from "lucide-react";
import { redirect } from "next/navigation";
import { PracticeBasePanel } from "@/components/atlas/practice-base";
import { ActionButton, BackLink, CodeList, IconLabel, Panel, ProgressBar, StatusBadge, TextLink } from "@/components/atlas/primitives";
import { EmptyRecord, ObjectiveMeter, RecordFact } from "@/components/atlas/record";
import { ProductShell } from "@/components/atlas/product-shell";
import { auth } from "@/lib/auth";
import { submitAssignment } from "@/lib/student/actions";
import { CuePanel } from "@/components/agent/cue-panel";
import {
  loadStudentAssignmentWorkspace,
  type StudentAssignment,
  type StudentAssignmentWorkspace,
  type StudentMaterial,
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

export default async function StudentAssignmentPage({ params }: { params: Promise<{ assignmentId: string }> }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in?role=student");
  }
  if (session.user.role !== "student") {
    redirect("/teach");
  }

  const { assignmentId } = await params;
  const workspace = await loadStudentAssignmentWorkspace(session.user, assignmentId);

  return (
    <ProductShell
      active="student"
      persona="Student"
      title={workspace.course.name}
      subtitle={`${workspace.course.code} / ${workspace.course.term}`}
      actor={session.user}
      rail={workspace.problem ? undefined : <StudentWorkRail workspace={workspace} />}
    >
      <BackLink href="/student#work">Work</BackLink>
      {workspace.problem || !workspace.assignment ? (
        <Panel title={workspace.problem?.title ?? "Work unavailable"}>
          <p className="text-[14px] leading-6 text-[var(--color-muted)]">
            {workspace.problem?.detail ?? "This work is not attached to the active course record."}
          </p>
        </Panel>
      ) : (
        <>
          <StudentWorkRecord
            assignment={workspace.assignment}
            material={workspace.materials[0]}
            studyPackage={workspace.studyPackage}
            returnTo={`/student/work/${workspace.assignment.id}`}
            cue={
              workspace.course.id && workspace.assignment.id ? (
                <CuePanel
                  target={{ courseId: workspace.course.id, targetType: "assignment", targetId: workspace.assignment.id }}
                  availability={workspace.cuePolicy}
                />
              ) : null
            }
          />
          <RelatedMaterial workspace={workspace} />
          <RelatedObjectives workspace={workspace} />
        </>
      )}
    </ProductShell>
  );
}

function StudentWorkRecord({
  assignment,
  material,
  studyPackage,
  returnTo,
  cue,
}: {
  assignment: StudentAssignment;
  material?: StudentMaterial;
  studyPackage?: StudentStudyPackage;
  returnTo: string;
  cue?: ReactNode;
}) {
  const meta = assignmentMeta(assignment);
  const score = assignmentScore(assignment);
  const response = assignment.response?.trim();
  const canSubmit = Boolean(assignment.id) && assignment.status !== "graded";
  const canRevise = canSubmit && assignment.status === "submitted";

  return (
    <Panel title={assignment.name} action={<StatusBadge tone={assignmentTone[assignment.status]}>{assignmentLabel[assignment.status]}</StatusBadge>}>
      <div className="grid gap-6">
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-[var(--color-muted)]">{meta}</p>
            {assignment.description ? (
              <p className="mt-3 max-w-3xl text-[15px] leading-7 text-[var(--color-ink)]">{assignment.description}</p>
            ) : null}
            {assignment.objectiveCodes.length > 0 ? (
              <div className="mt-3">
                <CodeList codes={assignment.objectiveCodes} />
              </div>
            ) : null}
          </div>
          <aside className="grid content-start gap-3 border-t border-[var(--color-border)] pt-4 text-[13px] lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
            <RecordFact label="Status" value={assignmentLabel[assignment.status]} />
            <RecordFact label="Score" value={score ?? "-"} />
            <RecordFact label="Points" value={assignment.points ? Math.round(assignment.points) : "-"} />
          </aside>
        </section>

        {material ? <WorkMaterialContext material={material} assignment={assignment} /> : null}
        {cue}
        <StudentResult assignment={assignment} score={score} />
        {response ? <StudentResponse body={response} /> : null}
        {studyPackage ? <StudyPackageContext studyPackage={studyPackage} /> : null}

        {canRevise ? (
          <details className="max-w-3xl border-t border-[var(--color-border)] pt-4">
            <summary className="cursor-pointer rounded-[6px] text-[13px] font-medium text-[var(--color-muted)] marker:text-[var(--color-faint)]">
              Revise
            </summary>
            <ResponseForm assignment={assignment} returnTo={returnTo} response={response} className="mt-4" bordered={false} />
          </details>
        ) : canSubmit ? (
          <ResponseForm assignment={assignment} returnTo={returnTo} response={response} />
        ) : null}
      </div>
    </Panel>
  );
}

function WorkMaterialContext({ material, assignment }: { material: StudentMaterial; assignment: StudentAssignment }) {
  const action = assignment.status === "graded" ? "Review" : assignment.status === "submitted" ? "Check" : "Use";

  return (
    <section className="max-w-3xl border-t border-[var(--color-border)] pt-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[12px] font-medium text-[var(--color-ink)]">Material</p>
          <h3 className="mt-1 text-[15px] font-semibold leading-6 text-[var(--color-ink)]">
            {material.id ? <TextLink href={`/student/material/${material.id}`}>{material.title}</TextLink> : material.title}
          </h3>
          {material.summary ? <p className="mt-2 text-[13px] leading-5 text-[var(--color-muted)]">{material.summary}</p> : null}
        </div>
        <StatusBadge tone="neutral">{action}</StatusBadge>
      </div>
      <div className="mt-3">
        <CodeList codes={material.objectiveCodes} />
      </div>
    </section>
  );
}

function StudentResponse({ body }: { body: string }) {
  return (
    <section className="max-w-3xl border-t border-[var(--color-border)] pt-5">
      <p className="text-[12px] font-medium text-[var(--color-ink)]">Response</p>
      <p className="mt-2 text-[14px] leading-6 text-[var(--color-muted)]">{body}</p>
    </section>
  );
}

function ResponseForm({
  assignment,
  returnTo,
  response,
  className = "",
  bordered = true,
}: {
  assignment: StudentAssignment;
  returnTo: string;
  response?: string;
  className?: string;
  bordered?: boolean;
}) {
  if (!assignment.id) return null;

  const frame = bordered ? "border-t border-[var(--color-border)] pt-5" : "";

  return (
    <form action={submitAssignment} className={`grid max-w-3xl gap-3 ${frame} ${className}`.trim()}>
      <input type="hidden" name="assignmentId" value={assignment.id} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <label className="grid gap-2 text-[13px] font-medium text-[var(--color-ink)]">
        Response
        <textarea
          name="body"
          defaultValue={response ?? ""}
          required
          minLength={20}
          className="min-h-40 resize-none rounded-[8px] border border-[var(--color-border)] bg-white px-3 py-3 text-[14px] leading-6 text-[var(--color-ink)] transition focus:border-[var(--color-accent-strong)]"
        />
      </label>
      <div>
        <ActionButton>
          <Check size={14} strokeWidth={2} aria-hidden="true" />
          <span className="ml-1.5">{response ? "Update response" : "Submit response"}</span>
        </ActionButton>
      </div>
    </form>
  );
}

function StudyPackageContext({ studyPackage }: { studyPackage: StudentStudyPackage }) {
  return (
    <section className="grid gap-3 border-t border-[var(--color-border)] pt-5 text-[13px] md:grid-cols-[minmax(0,1fr)_minmax(180px,0.4fr)]">
      <div className="min-w-0">
        <p className="text-[12px] font-medium text-[var(--color-ink)]">Package</p>
        <h3 className="mt-1 text-[15px] font-semibold leading-6 text-[var(--color-ink)]">{studyPackage.title}</h3>
        <p className="mt-2 text-[14px] leading-6 text-[var(--color-muted)]">{studyPackage.practice}</p>
      </div>
      <div className="grid content-start gap-2">
        <RecordFact label="Review" value={studyPackage.reviewHref ? <TextLink href={studyPackage.reviewHref}>{studyPackage.review}</TextLink> : studyPackage.review} />
        <RecordFact label="Check" value={studyPackage.check} />
      </div>
    </section>
  );
}

function StudentResult({ assignment, score }: { assignment: StudentAssignment; score: string | null }) {
  if (!assignment.gradedAt && !score) return null;

  return (
    <section className="grid gap-3 border-t border-[var(--color-border)] pt-5 text-[13px] sm:grid-cols-3">
      <RecordFact label="Score" value={score ?? "-"} variant="stack" />
      <RecordFact label="Grade" value={assignment.grade ?? "-"} variant="stack" />
      <RecordFact label="Graded" value={assignment.gradedAt ? formatShortDate(assignment.gradedAt) : "-"} variant="stack" />
    </section>
  );
}

function RelatedMaterial({ workspace }: { workspace: StudentAssignmentWorkspace }) {
  return (
    <Panel title="Material" action={<StatusBadge tone="neutral">{workspace.materials.length}</StatusBadge>}>
      <div className="divide-y divide-[var(--color-border)]">
        {workspace.materials.length > 0 ? (
          workspace.materials.map((material) => (
            <article key={material.id ?? material.title} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold leading-5 text-[var(--color-ink)]">
                    {material.id ? <TextLink href={`/student/material/${material.id}`}>{material.title}</TextLink> : material.title}
                  </p>
                  {material.summary ? <p className="mt-2 text-[13px] leading-5 text-[var(--color-muted)]">{material.summary}</p> : null}
                </div>
                <StatusBadge tone="neutral">Week {material.week}</StatusBadge>
              </div>
              <div className="mt-2">
                <CodeList codes={material.objectiveCodes} />
              </div>
            </article>
          ))
        ) : (
          <EmptyRecord title="No material" detail="No published material is attached to this work." />
        )}
      </div>
    </Panel>
  );
}

function RelatedObjectives({ workspace }: { workspace: StudentAssignmentWorkspace }) {
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

function StudentWorkRail({ workspace }: { workspace: StudentAssignmentWorkspace }) {
  return (
    <div className="space-y-5">
      <Panel title="Course">
        <div className="space-y-3 text-[13px]">
          <RecordFact label="Standing" value={workspace.student.courseStanding} />
          <RecordFact label="Work" value={workspace.assignment?.status ? assignmentLabel[workspace.assignment.status] : "-"} />
        </div>
      </Panel>
      <Panel title="Practice">
        <PracticeBasePanel base={workspace.practice.base} />
        <div className="mt-4 border-t border-[var(--color-border)] pt-4">
          <IconLabel icon={Target}>{workspace.practice.objectiveCode}</IconLabel>
          <p className="mt-2 text-[13px] leading-5 text-[var(--color-muted)]">{workspace.practice.prompt}</p>
          <div className="mt-3">
            <ProgressBar value={workspace.objectives[0]?.coverage ?? 0} label="Completed" />
          </div>
        </div>
      </Panel>
      <Panel title="Record">
        <div className="space-y-3 text-[13px]">
          <IconLabel icon={ClipboardCheck}>Work</IconLabel>
          <IconLabel icon={BookOpenCheck}>Material</IconLabel>
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
