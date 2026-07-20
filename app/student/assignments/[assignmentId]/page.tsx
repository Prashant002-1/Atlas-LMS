import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { submitAssignment } from "@/lib/student/actions";
import { loadStudentAssignmentWorkspace, type StudentAssignment } from "@/lib/student/workspace";
import { loadSessionAssignmentBundle } from "@/lib/agent/session-store";
import { PageHeader } from "@/components/teach/page-header";
import { ActionButton, BackLink, ButtonLink, StatusBadge, TextLink } from "@/components/atlas/primitives";

const tone = { graded: "good", submitted: "accent", open: "neutral", missing: "warn" } as const;
const label = { graded: "Graded", submitted: "Submitted", open: "Open", missing: "Missing" } as const;

/** One assignment: instructions, material, submission state, and grade. */
export default async function StudentAssignmentPage({ params }: { params: Promise<{ assignmentId: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in?role=student");
  const { assignmentId } = await params;
  const workspace = await loadStudentAssignmentWorkspace(session.user, assignmentId);

  if (workspace.problem || !workspace.assignment) {
    return (
      <>
        <PageHeader title={workspace.problem?.title ?? "Assignment unavailable"} />
        <p className="max-w-lg text-[0.875rem] leading-6 text-[var(--color-muted)]">
          {workspace.problem?.detail ?? "This assignment is not part of this course."}
        </p>
      </>
    );
  }

  const assignment = workspace.assignment;
  const returnTo = `/student/assignments/${assignment.id}`;
  const sessionBundle = session.user.orgId ? await loadSessionAssignmentBundle(session.user.orgId, assignment.id) : null;
  const canSubmit = !sessionBundle && (assignment.status === "open" || assignment.status === "missing");
  const canRevise = !sessionBundle && assignment.status === "submitted";

  return (
    <>
      <BackLink href={`/student/course/${workspace.course.id}/assignments`}>Assignments</BackLink>

      <div className="mt-3">
        <PageHeader title={assignment.name} course={meta(assignment)} action={<StatusBadge tone={tone[assignment.status]}>{label[assignment.status]}</StatusBadge>} />
      </div>

      <section className="border-y border-[var(--color-border)] py-5">
        {assignment.description ? (
          <p className="max-w-3xl whitespace-pre-wrap text-[0.90625rem] leading-7">{assignment.description}</p>
        ) : (
          <p className="text-[0.875rem] text-[var(--color-muted)]">No instructions are attached.</p>
        )}
        {workspace.relatedMaterials.length > 0 ? (
          <div className="mt-5 border-t border-[var(--color-border)] pt-4">
            <p className="text-[0.75rem] font-medium text-[var(--color-muted)]">Course material</p>
            <div className="mt-2 space-y-1">
              {workspace.relatedMaterials.map((material) => (
                <p key={material.id} className="text-[0.84375rem]">
                  <TextLink href={`/student/material/${material.id}`}>Week {material.week}: {material.title}</TextLink>
                </p>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {sessionBundle ? (
        <section className="mt-4 border-y border-[var(--color-border)] py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[0.8125rem] font-semibold text-[var(--color-ink)]">Assignment session</p>
              <p className="mt-1 max-w-3xl text-[0.8125rem] leading-6 text-[var(--color-muted)]">
                Complete this assignment in a live session. The transcript and submission draft are assessed against the rubric. Allow about {sessionBundle.config.durationMinutes} minutes.
              </p>
            </div>
            <ButtonLink href={`/student/session/${assignment.id}`} size="sm">
              {assignment.status === "open" || assignment.status === "missing" ? "Begin session" : "View session"}
            </ButtonLink>
          </div>
        </section>
      ) : null}

      {assignment.status === "graded" ? (
        <section className="mt-6 border-y border-[var(--color-border)] py-5">
          <p className="text-[0.8125rem] font-semibold text-[var(--color-ink)]">Grade</p>
          <p className="mt-2 text-[1.25rem] font-semibold">
            {typeof assignment.score === "number" ? Math.round(assignment.score) : ""}
            {assignment.points ? ` / ${Math.round(assignment.points)}` : ""}
            {assignment.grade ? `  (${assignment.grade})` : ""}
          </p>
        </section>
      ) : null}

      {assignment.response ? (
        <section className="mt-6 border-y border-[var(--color-border)] py-5">
          <p className="text-[0.8125rem] font-semibold text-[var(--color-ink)]">Your response</p>
          <p className="mt-2 max-w-3xl whitespace-pre-wrap text-[0.875rem] leading-6">{assignment.response}</p>
        </section>
      ) : null}

      {canSubmit || canRevise ? (
        <section className="mt-4 rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-panel)]">
          <p className="text-[0.875rem] font-semibold">{canRevise ? "Revise your response" : "Submit your response"}</p>
          <form action={submitAssignment} className="mt-3 grid max-w-3xl gap-3">
            <input type="hidden" name="assignmentId" value={assignment.id} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <label className="sr-only" htmlFor="response-body">Response</label>
            <textarea
              id="response-body"
              name="body"
              required
              minLength={20}
              rows={6}
              defaultValue={assignment.response ?? ""}
              placeholder="Write your response here."
              className="w-full resize-y rounded-control border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2.5 text-[0.875rem] leading-6 transition focus:border-[var(--color-accent-strong)] focus:bg-[var(--color-surface)]"
            />
            <div><ActionButton>{canRevise ? "Update response" : "Submit response"}</ActionButton></div>
          </form>
        </section>
      ) : null}
    </>
  );
}

function meta(assignment: StudentAssignment): string {
  const parts: string[] = [];
  if (assignment.dueAt) parts.push(`Due ${assignment.dueAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`);
  if (assignment.points) parts.push(`${Math.round(assignment.points)} pts`);
  return parts.join(", ");
}
