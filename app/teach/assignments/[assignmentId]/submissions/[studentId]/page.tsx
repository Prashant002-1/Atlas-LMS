import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight, ExternalLink, FileText } from "lucide-react";
import { auth } from "@/lib/auth";
import { displayLoginEmail } from "@/lib/auth/display-email";
import { isInstructorLike } from "@/lib/auth/session";
import { loadSubmissionDetail, type SubmissionDetailView } from "@/lib/instructor/submission-detail";
import { gradeSubmission, markSubmissionMissing } from "@/lib/instructor/actions";
import { saveSubmissionFeedback } from "@/lib/instructor/feedback-actions";
import { ActionButton, BackLink, ButtonLink, StatusBadge, TextLink } from "@/components/atlas/primitives";
import { PageHeader } from "@/components/teach/page-header";
import { RichTextEditor } from "@/components/teach/rich-text-editor";
import { Markdown } from "@/components/agent/markdown";

/**
 * One student, one submission, everything a grader needs in one place.
 *
 * This page exists because a table row cannot hold a submission. Expanding a
 * row put a paragraph of prose inside a cell, gave an uploaded file nowhere to
 * render, and made the score box compete with the work for the same few
 * hundred pixels. Grading one student is a task with its own screen.
 *
 * The work leads, because that is what is being judged. The score and the
 * comment sit beside it and save independently: a grader often writes the
 * reason before settling on the number. Previous and next walk the roster, so
 * grading a class does not mean returning to the list between students.
 */
export default async function SubmissionDetailPage({
  params,
}: {
  params: Promise<{ assignmentId: string; studentId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  if (!isInstructorLike(session.user.role)) redirect("/student");

  const { assignmentId, studentId } = await params;
  const view = await loadSubmissionDetail(session.user, assignmentId, studentId);

  if (view.problem) {
    return (
      <>
        <BackLink href={`/teach/assignments/${assignmentId}`}>Assignment</BackLink>
        <div className="mt-3"><PageHeader title={view.problem.title} /></div>
        <p className="max-w-lg text-[0.875rem] leading-6 text-[var(--color-muted)]">{view.problem.detail}</p>
      </>
    );
  }

  const studentEmail = await displayLoginEmail({
    viewerEmail: session.user.email,
    userId: view.student.id,
    fallback: view.student.email,
  });

  const returnTo = `/teach/assignments/${assignmentId}/submissions/${studentId}`;

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <BackLink href={`/teach/assignments/${assignmentId}`}>{view.assignment.name}</BackLink>
        <RosterPager view={view} assignmentId={assignmentId} />
      </div>

      <PageHeader
        title={view.student.name}
        course={view.course.code}
        action={
          view.sessionSubmissionId ? (
            <ButtonLink href={`/teach/ai-assignments/session/${view.sessionSubmissionId}`} variant="secondary" size="sm">
              Open session
            </ButtonLink>
          ) : undefined
        }
      />

      <div className="-mt-4 mb-8 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.78125rem] text-[var(--color-muted)]">
        <span>{statusLabel(view.submission.status)}</span>
        {view.submission.submittedAt ? <span>Submitted {stamp(view.submission.submittedAt)}</span> : null}
        {view.submission.late ? <StatusBadge tone="warn">Late</StatusBadge> : null}
        {view.student.standing ? <span>Course standing {view.student.standing}</span> : null}
        {studentEmail ? <span className="atlas-mono text-[0.71875rem]">{studentEmail}</span> : null}
      </div>

      <div className="grid gap-10 xl:grid-cols-[minmax(0,1.35fr)_minmax(19rem,0.65fr)] xl:items-start">
        <div className="min-w-0">
          <SubmittedWork view={view} />
        </div>

        <div className="min-w-0 space-y-9">
          <GradeCard view={view} assignmentId={assignmentId} studentId={studentId} returnTo={returnTo} />
          <FeedbackCard view={view} assignmentId={assignmentId} studentId={studentId} returnTo={returnTo} />
          {view.documents.length > 0 ? <AssignmentHandouts view={view} /> : null}
        </div>
      </div>
    </>
  );
}

/** The work itself, rendered as whatever shape it actually is. */
function SubmittedWork({ view }: { view: SubmissionDetailView }) {
  const { submission } = view;

  return (
    <section aria-labelledby="submitted-work-heading">
      <h2 id="submitted-work-heading" className="text-[1rem] font-semibold text-[var(--color-ink)]">
        Submission
      </h2>

      {submission.kind === "session" ? (
        <div className="mt-3 border-t border-[var(--color-border)] pt-4">
          <p className="text-[0.8125rem] leading-6 text-[var(--color-muted)]">
            This assignment was completed as a session with Atlas. The transcript, the final work, and the
            rubric grade live on the session record.
          </p>
          {view.sessionSubmissionId ? (
            <p className="mt-3">
              <TextLink href={`/teach/ai-assignments/session/${view.sessionSubmissionId}`}>
                Open the session record
              </TextLink>
            </p>
          ) : null}
        </div>
      ) : submission.kind === "file" || submission.kind === "link" ? (
        <div className="mt-3 border-t border-[var(--color-border)] pt-4">
          {view.submissionDocuments.length > 0 ? (
            <ul className="divide-y divide-[var(--color-border)]">
              {view.submissionDocuments.map((document) => (
                <li key={document.attachmentId} className="flex items-start gap-2.5 py-2.5">
                  <FileText size={14} aria-hidden className="mt-0.5 shrink-0 text-[var(--color-muted)]" />
                  <div className="min-w-0">
                    <Link
                      href={`/teach/documents/${document.fileId}`}
                      className="text-[0.8125rem] font-medium text-[var(--color-ink)] underline decoration-[color-mix(in_oklch,var(--color-ink)_24%,transparent)] underline-offset-[3px] transition hover:text-[var(--color-accent-strong)]"
                    >
                      {document.displayName}
                    </Link>
                    <p className="mt-0.5 text-[0.6875rem] text-[var(--color-faint)]">
                      {[document.filename, fileSize(document.sizeBytes)].filter(Boolean).join(" / ")}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
          {submission.url ? (
            <p className={view.submissionDocuments.length > 0 ? "mt-4" : undefined}>
              <a
                href={submission.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-[0.875rem] font-medium text-[var(--color-ink)] underline decoration-[color-mix(in_oklch,var(--color-ink)_24%,transparent)] underline-offset-[3px] transition hover:text-[var(--color-accent-strong)]"
              >
                <ExternalLink size={14} aria-hidden />
                Open the submitted link
              </a>
            </p>
          ) : view.submissionDocuments.length === 0 ? (
            <p className="text-[0.8125rem] text-[var(--color-muted)]">
              The submission record has no readable location.
            </p>
          ) : null}
          {submission.body ? (
            <div className="mt-5 border-t border-[var(--color-border)] pt-4">
              <p className="text-[0.71875rem] font-medium uppercase tracking-[0.06em] text-[var(--color-faint)]">
                Student note
              </p>
              <Markdown className="mt-2 max-w-3xl text-[0.875rem] leading-7">{submission.body}</Markdown>
            </div>
          ) : null}
        </div>
      ) : submission.kind === "text" && submission.body ? (
        <Markdown className="mt-3 max-w-3xl border-t border-[var(--color-border)] pt-4 text-[0.875rem] leading-7">
          {submission.body}
        </Markdown>
      ) : (
        <p className="mt-3 border-t border-[var(--color-border)] pt-4 text-[0.8125rem] text-[var(--color-muted)]">
          {submission.status === "missing" ? "Marked missing. Nothing was submitted." : "Nothing submitted yet."}
        </p>
      )}
    </section>
  );
}

function GradeCard({
  view,
  assignmentId,
  studentId,
  returnTo,
}: {
  view: SubmissionDetailView;
  assignmentId: string;
  studentId: string;
  returnTo: string;
}) {
  const possible = view.assignment.pointsPossible;

  return (
    <section aria-labelledby="grade-heading">
      <h2 id="grade-heading" className="text-[1rem] font-semibold text-[var(--color-ink)]">Grade</h2>

      <form action={gradeSubmission} className="mt-3 border-t border-[var(--color-border)] pt-4">
        <input type="hidden" name="assignmentId" value={assignmentId} />
        <input type="hidden" name="studentId" value={studentId} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-[0.75rem] font-medium text-[var(--color-ink)]">
            Score
            <span className="flex items-center gap-1.5">
              <input
                name="score"
                type="number"
                step="0.01"
                min={0}
                max={possible ?? undefined}
                defaultValue={view.submission.score ?? ""}
                className={fieldClass}
              />
              {possible ? (
                <span className="shrink-0 text-[0.75rem] font-normal text-[var(--color-muted)]">
                  / {Math.round(possible)}
                </span>
              ) : null}
            </span>
          </label>
          <label className="grid gap-1.5 text-[0.75rem] font-medium text-[var(--color-ink)]">
            Letter grade
            <input name="grade" type="text" maxLength={24} defaultValue={view.submission.grade ?? ""} className={fieldClass} />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <ActionButton size="sm">Save grade</ActionButton>
          {view.submission.gradedAt ? (
            <span className="text-[0.71875rem] text-[var(--color-faint)]">Graded {stamp(view.submission.gradedAt)}</span>
          ) : null}
        </div>
      </form>

      {view.submission.status !== "missing" ? (
        <form action={markSubmissionMissing} className="mt-3">
          <input type="hidden" name="assignmentId" value={assignmentId} />
          <input type="hidden" name="studentId" value={studentId} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <button
            type="submit"
            className="text-[0.71875rem] font-medium text-[var(--color-muted)] underline decoration-[color-mix(in_oklch,currentColor_40%,transparent)] underline-offset-[3px] transition hover:text-[var(--color-danger)]"
          >
            Mark missing
          </button>
        </form>
      ) : null}
    </section>
  );
}

function FeedbackCard({
  view,
  assignmentId,
  studentId,
  returnTo,
}: {
  view: SubmissionDetailView;
  assignmentId: string;
  studentId: string;
  returnTo: string;
}) {
  return (
    <section aria-labelledby="feedback-heading">
      <h2 id="feedback-heading" className="text-[1rem] font-semibold text-[var(--color-ink)]">Feedback</h2>

      <form action={saveSubmissionFeedback} className="mt-3 border-t border-[var(--color-border)] pt-4">
        <input type="hidden" name="assignmentId" value={assignmentId} />
        <input type="hidden" name="studentId" value={studentId} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <RichTextEditor
          name="feedback"
          label="Comment to this student"
          labelHidden
          defaultValue={view.submission.feedback ?? ""}
          rows={9}
          maxLength={8000}
          placeholder="What went well, what to fix, and what to do next."
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <ActionButton size="sm">Save feedback</ActionButton>
          {view.submission.feedbackAt ? (
            <span className="text-[0.71875rem] text-[var(--color-faint)]">
              Saved {stamp(view.submission.feedbackAt)}
              {view.submission.feedbackByName ? ` by ${view.submission.feedbackByName}` : ""}
            </span>
          ) : null}
        </div>
      </form>
    </section>
  );
}

/** The instructor's own handouts for this assignment, for reference while grading. */
function AssignmentHandouts({ view }: { view: SubmissionDetailView }) {
  return (
    <section aria-labelledby="handouts-heading">
      <h2 id="handouts-heading" className="text-[1rem] font-semibold text-[var(--color-ink)]">Assignment documents</h2>
      <ul className="mt-3 divide-y divide-[var(--color-border)] border-t border-[var(--color-border)]">
        {view.documents.map((item) => (
          <li key={item.attachmentId} className="flex items-start gap-2.5 py-2.5">
            <FileText size={14} strokeWidth={1.8} aria-hidden className="mt-0.5 shrink-0 text-[var(--color-muted)]" />
            <Link
              href={`/teach/documents/${item.fileId}`}
              className="min-w-0 flex-1 truncate text-[0.8125rem] text-[var(--color-ink)] underline decoration-[color-mix(in_oklch,var(--color-ink)_24%,transparent)] underline-offset-[3px] transition hover:text-[var(--color-accent-strong)]"
            >
              {item.displayName}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Walk the roster without going back to the list between students. */
function RosterPager({ view, assignmentId }: { view: SubmissionDetailView; assignmentId: string }) {
  const base = `/teach/assignments/${assignmentId}/submissions`;
  return (
    <nav aria-label="Students" className="flex items-center gap-1">
      {view.previous ? (
        <Link
          href={`${base}/${view.previous.studentId}`}
          title={view.previous.studentName}
          aria-label={`Previous student, ${view.previous.studentName}`}
          className="inline-flex size-8 items-center justify-center rounded-control text-[var(--color-muted)] transition hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]"
        >
          <ChevronLeft size={15} aria-hidden />
        </Link>
      ) : (
        <span className="inline-flex size-8 items-center justify-center text-[var(--color-faint)] opacity-40" aria-hidden>
          <ChevronLeft size={15} />
        </span>
      )}
      <span className="min-w-[4.5rem] text-center text-[0.71875rem] tabular-nums text-[var(--color-muted)]">
        {view.position.index} of {view.position.total}
      </span>
      {view.next ? (
        <Link
          href={`${base}/${view.next.studentId}`}
          title={view.next.studentName}
          aria-label={`Next student, ${view.next.studentName}`}
          className="inline-flex size-8 items-center justify-center rounded-control text-[var(--color-muted)] transition hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]"
        >
          <ChevronRight size={15} aria-hidden />
        </Link>
      ) : (
        <span className="inline-flex size-8 items-center justify-center text-[var(--color-faint)] opacity-40" aria-hidden>
          <ChevronRight size={15} />
        </span>
      )}
    </nav>
  );
}

function statusLabel(status: SubmissionDetailView["submission"]["status"]) {
  return { graded: "Graded", submitted: "Submitted, not graded", missing: "Missing", open: "Not submitted" }[status];
}

function stamp(date: Date) {
  return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function fileSize(bytes: number | null) {
  if (typeof bytes !== "number") return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const fieldClass =
  "min-h-10 w-full rounded-control border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 text-[0.8125rem] text-[var(--color-ink)] outline-none transition focus:border-[var(--color-accent-strong)] focus:bg-[var(--color-surface)]";
