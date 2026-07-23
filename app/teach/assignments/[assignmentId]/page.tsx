import { redirect } from "next/navigation";
import { ActionButton, BackLink, ButtonLink, TextLink } from "@/components/atlas/primitives";
import { PageHeader } from "@/components/teach/page-header";
import { SubmissionReviewTable, type SubmissionReviewRow } from "@/components/teach/submission-review-table";
import { RecordDialog } from "@/components/teach/record-dialog";
import { auth } from "@/lib/auth";
import { isInstructorLike } from "@/lib/auth/session";
import { publishAssignment, updateAssignmentRecord } from "@/lib/instructor/actions";
import {
  type InstructorAssignment,
  loadInstructorAssignmentWorkspace,
  type InstructorAssignmentWorkspace,
} from "@/lib/instructor/workspace";
import { loadSessionAssignmentBundle } from "@/lib/agent/session-store";

// The former "Journeys and rubric" entry is now the direct "Sessions and grades" entry.
export default async function InstructorAssignmentPage({ params }: { params: Promise<{ assignmentId: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  if (!isInstructorLike(session.user.role)) redirect("/student");

  const { assignmentId } = await params;
  const workspace = await loadInstructorAssignmentWorkspace(session.user, assignmentId);
  const sessionBundle = session.user.orgId ? await loadSessionAssignmentBundle(session.user.orgId, assignmentId) : null;

  if (workspace.problem || !workspace.assignment) {
    return (
      <>
        <BackLink href="/teach/assignments">Assignments</BackLink>
        <div className="mt-3"><PageHeader title={workspace.problem?.title ?? "Assignment unavailable"} /></div>
        <p className="max-w-lg text-[0.875rem] leading-6 text-[var(--color-muted)]">
          {workspace.problem?.detail ?? "This assignment is not in a course you teach."}
        </p>
      </>
    );
  }

  const assignment = workspace.assignment;
  const progress = workspace.progress;
  const rows: SubmissionReviewRow[] = workspace.submissions.map((submission, index) => ({
    rowId: submission.studentId ?? `roster-${index}`,
    studentId: submission.studentId ?? null,
    studentName: submission.studentName,
    standing: submission.standing,
    status: submission.status,
    submittedAt: submission.submittedAt?.toISOString() ?? null,
    gradedAt: submission.gradedAt?.toISOString() ?? null,
    score: submission.score ?? null,
    grade: submission.grade ?? null,
    body: submission.body ?? null,
    sessionSubmissionId: submission.sessionSubmissionId ?? null,
    draftScore: submission.draftScore ?? null,
    draftReportStatus: submission.draftReportStatus ?? null,
  }));

  return (
    <>
      <BackLink href="/teach/assignments">Assignments</BackLink>
      <div className="mt-3">
        <PageHeader
          title={assignment.title}
          course={`${workspace.course.code} / Assignment`}
          action={assignment.id ? (
            <div className="flex items-center gap-2">
              {assignment.status !== "approved" ? <PublishControl assignmentId={assignment.id} /> : null}
              <AssignmentEditDialog assignment={assignment} />
            </div>
          ) : undefined}
        />
      </div>

      <div className="-mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[0.78125rem] text-[var(--color-muted)]">
        {assignment.status !== "approved" ? <span>Draft</span> : null}
        {assignment.dueAt ? <span className={assignment.isPastDue ? "font-medium text-[var(--color-danger)]" : undefined}>{assignment.isPastDue ? "Past due" : "Upcoming"}, {formatShortDate(assignment.dueAt)}</span> : <span>No due date</span>}
        {assignment.points ? <span>{Math.round(assignment.points)} points</span> : null}
      </div>

      {assignment.detail ? <p className="mt-6 max-w-4xl whitespace-pre-wrap text-[0.90625rem] leading-7 text-[var(--color-ink)]">{assignment.detail}</p> : null}

      {workspace.materials.length > 0 ? <AssignmentMaterials materials={workspace.materials} /> : null}

      {sessionBundle ? (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-y border-[var(--color-border)] py-3">
          <div>
            <p className="text-[0.8125rem] font-semibold text-[var(--color-ink)]">AI assignment</p>
            <p className="mt-0.5 text-[0.75rem] text-[var(--color-muted)]">Students complete this assignment in a session with Atlas.</p>
          </div>
          <ButtonLink href={`/teach/ai-assignments/${assignmentId}`} variant="secondary" size="sm">Sessions and grades</ButtonLink>
        </div>
      ) : null}

      <dl className="mt-8 grid border-y border-[var(--color-border)] sm:grid-cols-2 lg:grid-cols-4">
        <SummaryFact label="Submitted" value={`${progress?.submitted ?? 0} / ${workspace.submissions.length}`} />
        <SummaryFact label="Graded" value={String(progress?.graded ?? 0)} />
        <SummaryFact label="Missing" value={String(progress?.missing ?? 0)} />
        <SummaryFact label="Not submitted" value={String(progress?.open ?? 0)} />
      </dl>

      <div className="mt-8">
        <SubmissionReviewTable assignmentId={assignment.id ?? assignmentId} pointsPossible={assignment.points ?? null} rows={rows} />
      </div>
    </>
  );
}

function PublishControl({ assignmentId }: { assignmentId: string }) {
  return (
    <form action={publishAssignment}>
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <input type="hidden" name="returnTo" value={`/teach/assignments/${assignmentId}`} />
      <ActionButton size="sm">Publish</ActionButton>
    </form>
  );
}

function AssignmentMaterials({ materials }: { materials: InstructorAssignmentWorkspace["materials"] }) {
  return (
    <section aria-labelledby="course-material-heading" className="mt-6 max-w-4xl border-t border-[var(--color-border)] pt-4">
      <h2 id="course-material-heading" className="text-[0.75rem] font-medium text-[var(--color-muted)]">Course material</h2>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-[0.8125rem]">
        {materials.map((material) => (
          <TextLink key={material.id ?? `${material.week}-${material.title}`} href={material.id ? `/teach/week/${material.id}` : "/teach/weeks"}>
            Week {material.week}: {material.title}
          </TextLink>
        ))}
      </div>
    </section>
  );
}

function AssignmentEditDialog({ assignment }: { assignment: InstructorAssignment }) {
  if (!assignment.id) return null;
  return (
    <RecordDialog mode="edit" triggerLabel="Edit assignment" title="Edit assignment" description="Update the assignment without exposing an editing form in the grading workspace." triggerVariant="secondary">
      <form action={updateAssignmentRecord} className="grid gap-4">
        <input type="hidden" name="assignmentId" value={assignment.id} />
        <input type="hidden" name="returnTo" value={`/teach/assignments/${assignment.id}`} />
        {assignment.objectiveCodes.map((code) => <input key={code} type="hidden" name="objectiveCode" value={code} />)}
        <label className="grid gap-1.5 text-[0.75rem] font-medium text-[var(--color-ink)]">
          Title
          <input name="title" type="text" defaultValue={assignment.title} required autoFocus className={fieldClass} />
        </label>
        <label className="grid gap-1.5 text-[0.75rem] font-medium text-[var(--color-ink)]">
          Description
          <textarea name="description" rows={10} defaultValue={assignment.detail ?? ""} className={`${fieldClass} min-h-56 resize-y py-3 leading-6`} />
        </label>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
          <label className="grid gap-1.5 text-[0.75rem] font-medium text-[var(--color-ink)]">
            Due
            <input name="dueDate" type="date" defaultValue={dateInputValue(assignment.dueAt)} className={fieldClass} />
          </label>
          <label className="grid gap-1.5 text-[0.75rem] font-medium text-[var(--color-ink)]">
            Points
            <input name="points" type="number" min={0.01} step="0.01" defaultValue={assignment.points ?? ""} className={fieldClass} />
          </label>
        </div>
        <div className="flex justify-end border-t border-[var(--color-border)] pt-4"><ActionButton>Save assignment</ActionButton></div>
      </form>
    </RecordDialog>
  );
}

function SummaryFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-[var(--color-border)] px-4 py-4 first:pl-0 last:border-b-0 lg:border-b-0 lg:border-r lg:last:border-r-0">
      <dt className="text-[0.75rem] text-[var(--color-muted)]">{label}</dt>
      <dd className="mt-1 text-[1.25rem] font-semibold tabular-nums text-[var(--color-ink)]">{value}</dd>
    </div>
  );
}

function formatShortDate(value: Date) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(value);
}

function dateInputValue(value?: Date | null) {
  return value ? value.toISOString().slice(0, 10) : "";
}

const fieldClass = "min-h-10 rounded-control border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 text-[0.8125rem] text-[var(--color-ink)] outline-none transition focus:border-[var(--color-accent-strong)] focus:bg-[var(--color-surface)]";
