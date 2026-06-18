import { Check, CircleAlert } from "lucide-react";
import { redirect } from "next/navigation";
import { ActionButton, BackLink, CodeList, Panel, StatusBadge, TextLink } from "@/components/atlas/primitives";
import { EmptyRecord, ObjectiveChecklist, RecordFact } from "@/components/atlas/record";
import { auth } from "@/lib/auth";
import { isInstructorLike } from "@/lib/auth/session";
import { gradeSubmission, markSubmissionMissing, publishAssignment, updateAssignmentRecord } from "@/lib/instructor/actions";
import {
  type InstructorAssignment,
  loadInstructorAssignmentWorkspace,
  type InstructorAssignmentSubmission,
  type InstructorAssignmentWorkspace,
} from "@/lib/instructor/workspace";

const submissionTone = {
  graded: "good",
  submitted: "accent",
  missing: "warn",
  open: "neutral",
} as const;

const submissionLabel = {
  graded: "Graded",
  submitted: "Submitted",
  missing: "Missing",
  open: "Open",
} as const;

export default async function InstructorAssignmentPage({ params }: { params: Promise<{ assignmentId: string }> }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in");
  }
  if (!isInstructorLike(session.user.role)) {
    redirect("/student");
  }

  const { assignmentId } = await params;
  const workspace = await loadInstructorAssignmentWorkspace(session.user, assignmentId);

  return (
    <>
      <BackLink href="/teach/work">Work</BackLink>
      {workspace.problem || !workspace.assignment ? (
        <Panel title={workspace.problem?.title ?? "Work unavailable"}>
          <p className="text-[14px] leading-6 text-[var(--color-muted)]">
            {workspace.problem?.detail ?? "This work is not attached to the editable course record."}
          </p>
        </Panel>
      ) : (
        <>
          <InstructorWorkRecord workspace={workspace} />
          <SubmissionList workspace={workspace} />
        </>
      )}
    </>
  );
}

function InstructorWorkRecord({ workspace }: { workspace: InstructorAssignmentWorkspace }) {
  const assignment = workspace.assignment;
  if (!assignment) return null;
  const progress = workspace.progress;

  return (
    <Panel title={assignment.title} action={<StatusBadge tone={assignment.status === "approved" ? "good" : "neutral"}>{assignment.status === "approved" ? "Live" : "Draft"}</StatusBadge>}>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
        <section className="min-w-0">
          {assignment.detail ? <p className="max-w-3xl text-[15px] leading-7 text-[var(--color-ink)]">{assignment.detail}</p> : null}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {assignment.dueAt ? <StatusBadge tone="neutral">Due {formatShortDate(assignment.dueAt)}</StatusBadge> : null}
            {assignment.points ? <StatusBadge tone="neutral">{Math.round(assignment.points)} pts</StatusBadge> : null}
            <CodeList codes={assignment.objectiveCodes} />
          </div>
          <InstructorWorkMaterialContext materials={workspace.materials} />
          {assignment.id ? <AssignmentEditForm assignment={assignment} objectives={workspace.courseObjectives} /> : null}
        </section>
        <aside className="grid content-start gap-3 border-t border-[var(--color-border)] pt-4 text-[13px] lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
          <RecordFact label="Submitted" value={progress?.submitted ?? 0} />
          <RecordFact label="Graded" value={progress?.graded ?? 0} />
          <RecordFact label="Open" value={progress?.open ?? 0} />
          <RecordFact label="Missing" value={progress?.missing ?? 0} />
          {assignment.id && assignment.status !== "approved" ? (
            <form action={publishAssignment}>
              <input type="hidden" name="assignmentId" value={assignment.id} />
              <input type="hidden" name="returnTo" value={`/teach/work/${assignment.id}`} />
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

function InstructorWorkMaterialContext({ materials }: { materials: InstructorAssignmentWorkspace["materials"] }) {
  if (materials.length === 0) return null;

  return (
    <section className="mt-5 max-w-3xl border-t border-[var(--color-border)] pt-5">
      <p className="text-[12px] font-medium text-[var(--color-ink)]">Material</p>
      <div className="mt-2 divide-y divide-[var(--color-border)]">
        {materials.map((material) => (
          <article key={material.id ?? `${material.week}-${material.title}`} className="py-3 first:pt-0 last:pb-0">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h3 className="text-[15px] font-semibold leading-6 text-[var(--color-ink)]">
                  {material.id ? <TextLink href={`/teach/week/${material.id}`}>{material.title}</TextLink> : material.title}
                </h3>
                {material.summary ? <p className="mt-2 text-[13px] leading-5 text-[var(--color-muted)]">{material.summary}</p> : null}
              </div>
              <StatusBadge tone="neutral">Week {material.week}</StatusBadge>
            </div>
            <div className="mt-2">
              <CodeList codes={material.objectiveCodes} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function AssignmentEditForm({
  assignment,
  objectives,
}: {
  assignment: InstructorAssignment;
  objectives: InstructorAssignmentWorkspace["courseObjectives"];
}) {
  if (!assignment.id) return null;

  return (
    <details className="mt-5 border-t border-[var(--color-border)] pt-4">
      <summary className="cursor-pointer rounded-[6px] text-[13px] font-medium text-[var(--color-muted)] marker:text-[var(--color-faint)]">
        Edit
      </summary>
      <form action={updateAssignmentRecord} className="mt-4 grid max-w-3xl gap-3">
        <input type="hidden" name="assignmentId" value={assignment.id} />
        <input type="hidden" name="returnTo" value={`/teach/work/${assignment.id}`} />
        <ObjectiveChecklist objectives={objectives} selectedCodes={assignment.objectiveCodes} />
        <label className="grid gap-1.5 text-[12px] font-medium text-[var(--color-ink)]">
          Title
          <input
            name="title"
            type="text"
            defaultValue={assignment.title}
            required
            className="min-h-10 rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 text-[14px] text-[var(--color-ink)] transition focus:border-[var(--color-accent-strong)] focus:bg-[var(--color-surface)]"
          />
        </label>
        <label className="grid gap-1.5 text-[12px] font-medium text-[var(--color-ink)]">
          Description
          <textarea
            name="description"
            defaultValue={assignment.detail ?? ""}
            className="min-h-32 resize-none rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-3 text-[14px] leading-6 text-[var(--color-ink)] transition focus:border-[var(--color-accent-strong)] focus:bg-[var(--color-surface)]"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
          <label className="grid gap-1.5 text-[12px] font-medium text-[var(--color-ink)]">
            Due
            <input
              name="dueDate"
              type="date"
              defaultValue={dateInputValue(assignment.dueAt)}
              className="min-h-10 rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 text-[14px] text-[var(--color-ink)] transition focus:border-[var(--color-accent-strong)] focus:bg-[var(--color-surface)]"
            />
          </label>
          <label className="grid gap-1.5 text-[12px] font-medium text-[var(--color-ink)]">
            Points
            <input
              name="points"
              type="number"
              min={0.01}
              step="0.01"
              defaultValue={assignment.points ?? ""}
              className="min-h-10 rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 text-[14px] text-[var(--color-ink)] transition focus:border-[var(--color-accent-strong)] focus:bg-[var(--color-surface)]"
            />
          </label>
        </div>
        <div>
          <ActionButton>Save work</ActionButton>
        </div>
      </form>
    </details>
  );
}

function SubmissionList({ workspace }: { workspace: InstructorAssignmentWorkspace }) {
  const assignment = workspace.assignment;

  return (
    <Panel title="Submissions" action={<StatusBadge tone="neutral">{workspace.submissions.length}</StatusBadge>}>
      <div className="divide-y divide-[var(--color-border)]">
        {workspace.submissions.length > 0 && assignment ? (
          workspace.submissions.map((submission) => (
            <SubmissionRow key={submission.studentId ?? submission.studentName} assignment={assignment} submission={submission} />
          ))
        ) : (
          <EmptyRecord title="No submissions" detail="Student work appears here after the assignment is live." />
        )}
      </div>
    </Panel>
  );
}

function SubmissionRow({ assignment, submission }: { assignment: InstructorAssignment; submission: InstructorAssignmentSubmission }) {
  const score = submission.grade ?? scoreLabel(submission.score);
  const canGrade = Boolean(
    assignment.id &&
      submission.studentId &&
      (submission.status === "submitted" || submission.status === "graded")
  );
  const canMarkMissing = Boolean(assignment.id && submission.studentId && submission.status === "open");

  return (
    <article className="py-4 first:pt-0 last:pb-0">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="text-[14px] font-semibold leading-5 text-[var(--color-ink)]">{submission.studentName}</p>
          <p className="mt-1 text-[12px] text-[var(--color-muted)]">{submissionMeta(submission)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          <StatusBadge tone="neutral">{submission.standing}</StatusBadge>
          {score ? <StatusBadge tone="neutral">{score}</StatusBadge> : null}
          <StatusBadge tone={submissionTone[submission.status]}>{submissionLabel[submission.status]}</StatusBadge>
        </div>
      </div>
      <SubmissionResponse body={submission.body} />
      {canMarkMissing ? <MissingForm assignment={assignment} submission={submission} /> : null}
      {canGrade ? <GradeForm assignment={assignment} submission={submission} /> : null}
    </article>
  );
}

function SubmissionResponse({ body }: { body?: string | null }) {
  const response = body?.trim();
  if (!response) return null;

  return (
    <div className="mt-3 border-t border-[var(--color-border)] pt-3">
      <p className="text-[12px] font-medium text-[var(--color-ink)]">Response</p>
      <p className="mt-2 text-[13px] leading-6 text-[var(--color-muted)]">{response}</p>
    </div>
  );
}

function MissingForm({ assignment, submission }: { assignment: InstructorAssignment; submission: InstructorAssignmentSubmission }) {
  if (!assignment.id || !submission.studentId) return null;

  return (
    <form action={markSubmissionMissing} className="mt-3 flex justify-end border-t border-[var(--color-border)] pt-3">
      <input type="hidden" name="assignmentId" value={assignment.id} />
      <input type="hidden" name="studentId" value={submission.studentId} />
      <input type="hidden" name="returnTo" value={`/teach/work/${assignment.id}`} />
      <ActionButton variant="quiet" className="min-h-8 px-2.5" title={`Mark ${submission.studentName} missing`}>
        <CircleAlert size={14} strokeWidth={2} aria-hidden="true" />
        <span className="ml-1.5">Mark missing</span>
      </ActionButton>
    </form>
  );
}

function GradeForm({ assignment, submission }: { assignment: InstructorAssignment; submission: InstructorAssignmentSubmission }) {
  if (!assignment.id || !submission.studentId) return null;
  const label = submission.status === "graded" ? "Update grade" : "Grade";

  return (
    <details className="mt-3 border-t border-[var(--color-border)] pt-3">
      <summary className="cursor-pointer text-[13px] font-medium text-[var(--color-muted)] marker:text-[var(--color-faint)]">
        {label}
      </summary>
      <form action={gradeSubmission} className="mt-3 grid gap-3 sm:grid-cols-[120px_110px_minmax(120px,auto)] sm:items-end">
        <input type="hidden" name="assignmentId" value={assignment.id} />
        <input type="hidden" name="studentId" value={submission.studentId} />
        <input type="hidden" name="returnTo" value={`/teach/work/${assignment.id}`} />
        <label className="grid gap-1.5 text-[12px] font-medium text-[var(--color-ink)]">
          Score
          <input
            name="score"
            type="number"
            min={0}
            max={assignment.points ?? undefined}
            step="0.01"
            defaultValue={typeof submission.score === "number" ? String(submission.score) : ""}
            required
            className="min-h-10 rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 text-[14px] text-[var(--color-ink)] transition focus:border-[var(--color-accent-strong)] focus:bg-[var(--color-surface)]"
          />
        </label>
        <label className="grid gap-1.5 text-[12px] font-medium text-[var(--color-ink)]">
          Grade
          <input
            name="grade"
            type="text"
            defaultValue={submission.grade ?? ""}
            className="min-h-10 rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 text-[14px] text-[var(--color-ink)] transition focus:border-[var(--color-accent-strong)] focus:bg-[var(--color-surface)]"
          />
        </label>
        <ActionButton className="w-full sm:w-auto">{label === "Grade" ? "Record grade" : "Save grade"}</ActionButton>
      </form>
    </details>
  );
}


function submissionMeta(submission: InstructorAssignmentSubmission) {
  if (submission.gradedAt) return `Graded ${formatShortDate(submission.gradedAt)}`;
  if (submission.submittedAt) return `Submitted ${formatShortDate(submission.submittedAt)}`;
  return submission.status === "missing" ? "Missing" : "No submission";
}

function scoreLabel(score?: number | null) {
  if (typeof score !== "number") return null;
  return `${Math.round(score)}%`;
}

function formatShortDate(value: Date) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(value);
}

function dateInputValue(value?: Date | null) {
  return value ? value.toISOString().slice(0, 10) : "";
}
