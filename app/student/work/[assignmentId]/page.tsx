import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { submitAssignment } from "@/lib/student/actions";
import { loadStudentAssignmentWorkspace, type StudentAssignment } from "@/lib/student/workspace";
import { PageHeader } from "@/components/teach/page-header";
import { CuePanel } from "@/components/agent/cue-panel";
import { ActionButton, BackLink, CodeList, StatusBadge, TextLink } from "@/components/atlas/primitives";

const tone = { graded: "good", submitted: "accent", open: "neutral", missing: "warn" } as const;
const label = { graded: "Done", submitted: "Submitted", open: "Open", missing: "Missing" } as const;

/** One piece of work: the brief, the material behind it, your response. */
export default async function StudentWorkPage({ params }: { params: Promise<{ assignmentId: string }> }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in?role=student");
  }
  const { assignmentId } = await params;
  const workspace = await loadStudentAssignmentWorkspace(session.user, assignmentId);

  if (workspace.problem || !workspace.assignment) {
    return (
      <>
        <PageHeader title={workspace.problem?.title ?? "Work unavailable"} />
        <p className="max-w-lg text-[14px] leading-6 text-[var(--color-muted)]">
          {workspace.problem?.detail ?? "This work is not in the course record."}
        </p>
      </>
    );
  }

  const assignment = workspace.assignment;
  const returnTo = `/student/work/${assignment.id}`;
  const canSubmit = assignment.status === "open" || assignment.status === "missing";
  const canRevise = assignment.status === "submitted";

  return (
    <>
      <BackLink href={`/student/course/${workspace.course.id}`}>{workspace.course.code}</BackLink>

      <div className="mt-3">
        <PageHeader
          title={assignment.name}
          course={meta(assignment)}
          action={<StatusBadge tone={tone[assignment.status]}>{label[assignment.status]}</StatusBadge>}
        />
      </div>

      <section className="rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-panel)]">
        {assignment.description ? (
          <p className="max-w-3xl whitespace-pre-wrap text-[14.5px] leading-7">{assignment.description}</p>
        ) : (
          <p className="text-[14px] text-[var(--color-muted)]">No instructions are attached.</p>
        )}
        {assignment.objectiveCodes.length > 0 ? (
          <div className="mt-4">
            <CodeList codes={assignment.objectiveCodes} />
          </div>
        ) : null}

        {workspace.relatedMaterials.length > 0 ? (
          <div className="mt-5 border-t border-[var(--color-border)] pt-4">
            <p className="atlas-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-faint)]">Material behind this</p>
            <div className="mt-2 space-y-1">
              {workspace.relatedMaterials.map((material) => (
                <p key={material.id} className="text-[13.5px]">
                  <TextLink href={`/student/material/${material.id}`}>
                    Week {material.week}: {material.title}
                  </TextLink>
                </p>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-5">
          <CuePanel
            target={{ courseId: workspace.course.id, targetType: "assignment", targetId: assignment.id }}
            availability={workspace.cuePolicy}
          />
        </div>
      </section>

      {assignment.status === "graded" ? (
        <section className="mt-4 rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-panel)]">
          <p className="atlas-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-faint)]">Result</p>
          <p className="mt-2 text-[20px] font-semibold">
            {typeof assignment.score === "number" ? Math.round(assignment.score) : ""}
            {assignment.points ? ` / ${Math.round(assignment.points)}` : ""}
            {assignment.grade ? `  (${assignment.grade})` : ""}
          </p>
        </section>
      ) : null}

      {assignment.response ? (
        <section className="mt-4 rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-panel)]">
          <p className="atlas-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-faint)]">Your response</p>
          <p className="mt-2 max-w-3xl whitespace-pre-wrap text-[14px] leading-6">{assignment.response}</p>
        </section>
      ) : null}

      {canSubmit || canRevise ? (
        <section className="mt-4 rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-panel)]">
          <p className="text-[14px] font-semibold">{canRevise ? "Revise your response" : "Submit your response"}</p>
          <form action={submitAssignment} className="mt-3 grid max-w-3xl gap-3">
            <input type="hidden" name="assignmentId" value={assignment.id} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <label className="sr-only" htmlFor="response-body">
              Response
            </label>
            <textarea
              id="response-body"
              name="body"
              required
              minLength={20}
              rows={6}
              defaultValue={assignment.response ?? ""}
              placeholder="Write your response here."
              className="w-full resize-y rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2.5 text-[14px] leading-6 transition focus:border-[var(--color-accent-strong)] focus:bg-[var(--color-surface)]"
            />
            <div>
              <ActionButton>{canRevise ? "Update response" : "Submit response"}</ActionButton>
            </div>
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
  return parts.join(" / ");
}
