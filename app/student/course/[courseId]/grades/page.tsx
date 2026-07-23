import { auth } from "@/lib/auth";
import { loadStudentCourseWorkspace, type StudentAssignment } from "@/lib/student/workspace";
import { shortDate } from "@/lib/student/format";
import { PageHeader } from "@/components/teach/page-header";
import { RecordRow, StatusBadge } from "@/components/atlas/primitives";

/**
 * Grades: returned assignments with their scores, and the standing the
 * gradebook currently records. Facts from rows; nothing is projected.
 */
export default async function StudentCourseGradesPage({ params }: { params: Promise<{ courseId: string }> }) {
  const session = await auth();
  const { courseId } = await params;
  const workspace = await loadStudentCourseWorkspace(session?.user, courseId);

  if (workspace.problem) {
    return (
      <>
        <PageHeader title={workspace.problem.title} />
        <p className="max-w-lg text-[0.875rem] leading-6 text-[var(--color-muted)]">{workspace.problem.detail}</p>
      </>
    );
  }

  const graded = workspace.assignments
    .filter((a) => a.status === "graded")
    .sort((a, b) => (b.gradedAt?.getTime() ?? 0) - (a.gradedAt?.getTime() ?? 0));
  const awaiting = workspace.assignments
    .filter((a) => a.status === "submitted")
    .sort((a, b) => (b.submittedAt?.getTime() ?? 0) - (a.submittedAt?.getTime() ?? 0));

  return (
    <>
      <PageHeader
        title="Grades"
        action={workspace.standing ? <span className="text-[0.8125rem] font-medium tabular-nums text-[var(--color-muted)]">{workspace.standing}</span> : undefined}
      />

      {graded.length > 0 || awaiting.length > 0 ? (
        <div className="space-y-6">
          {graded.length > 0 ? (
            <section>
              <h2 className="pb-2.5 text-[0.8125rem] font-semibold text-[var(--color-ink)]">Returned</h2>
              <div className="divide-y divide-[var(--color-border)]">
                {graded.map((assignment) => (
                  <GradeRow key={assignment.id} assignment={assignment} />
                ))}
              </div>
            </section>
          ) : null}

          {awaiting.length > 0 ? (
            <section>
              <h2 className="pb-2.5 text-[0.8125rem] font-semibold text-[var(--color-ink)]">
                Submitted, not yet graded
              </h2>
              <div className="divide-y divide-[var(--color-border)]">
                {awaiting.map((assignment) => (
                  <RecordRow key={assignment.id} href={`/student/assignments/${assignment.id}`}>
                    <span className="block truncate text-[0.875rem] font-medium">{assignment.name}</span>
                    <span className="mt-0.5 block text-[0.78125rem] text-[var(--color-muted)]">
                      {assignment.submittedAt ? `Submitted ${shortDate(assignment.submittedAt)}` : "Submitted"}
                    </span>
                  </RecordRow>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : (
        <p className="py-5 text-[0.8125rem] text-[var(--color-muted)]">No grades yet.</p>
      )}
    </>
  );
}

function GradeRow({ assignment }: { assignment: StudentAssignment }) {
  return (
    <RecordRow
      href={`/student/assignments/${assignment.id}`}
      aside={
        <>
          {typeof assignment.score === "number" && assignment.points ? (
            <span className="atlas-mono text-[0.8125rem] tabular-nums text-[var(--color-ink)]">
              {Math.round(assignment.score)}/{Math.round(assignment.points)}
            </span>
          ) : null}
          {assignment.grade ? <StatusBadge tone="good">{assignment.grade}</StatusBadge> : null}
        </>
      }
    >
      <span className="block truncate text-[0.875rem] font-medium">{assignment.name}</span>
      <span className="mt-0.5 block text-[0.78125rem] text-[var(--color-muted)]">
        {assignment.gradedAt ? `Graded ${shortDate(assignment.gradedAt)}` : "Graded"}
      </span>
    </RecordRow>
  );
}
