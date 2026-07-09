import { auth } from "@/lib/auth";
import { loadStudentCourseWorkspace, type StudentAssignment } from "@/lib/student/workspace";
import { shortDate } from "@/lib/student/format";
import { PageHeader } from "@/components/teach/page-header";
import { Panel, RecordRow, StatusBadge } from "@/components/atlas/primitives";
import { EmptyState } from "@/components/atlas/record";

/**
 * Grades: the returned work, each with its score, and the standing the
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
        <p className="max-w-lg text-[14px] leading-6 text-[var(--color-muted)]">{workspace.problem.detail}</p>
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
        course={`${workspace.course.code} / ${workspace.course.name}`}
        action={workspace.standing ? <StatusBadge tone="neutral">{workspace.standing}</StatusBadge> : undefined}
      />

      {graded.length > 0 || awaiting.length > 0 ? (
        <div className="space-y-6">
          {graded.length > 0 ? (
            <section>
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--color-faint)]">Returned</h2>
              <div className="mt-2.5 divide-y divide-[var(--color-border)] rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-panel)]">
                {graded.map((assignment) => (
                  <GradeRow key={assignment.id} assignment={assignment} />
                ))}
              </div>
            </section>
          ) : null}

          {awaiting.length > 0 ? (
            <section>
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--color-faint)]">
                Submitted, not yet graded
              </h2>
              <div className="mt-2.5 divide-y divide-[var(--color-border)] rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-panel)]">
                {awaiting.map((assignment) => (
                  <RecordRow key={assignment.id} href={`/student/work/${assignment.id}`}>
                    <span className="block truncate text-[14px] font-medium">{assignment.name}</span>
                    <span className="mt-0.5 block text-[12.5px] text-[var(--color-muted)]">
                      {assignment.submittedAt ? `Submitted ${shortDate(assignment.submittedAt)}` : "Submitted"}
                    </span>
                  </RecordRow>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : (
        <Panel>
          <EmptyState art="atlas" title="No grades yet" detail="Returned work appears here with its score." />
        </Panel>
      )}
    </>
  );
}

function GradeRow({ assignment }: { assignment: StudentAssignment }) {
  return (
    <RecordRow
      href={`/student/work/${assignment.id}`}
      aside={
        <>
          {typeof assignment.score === "number" && assignment.points ? (
            <span className="atlas-mono text-[13px] tabular-nums text-[var(--color-ink)]">
              {Math.round(assignment.score)}/{Math.round(assignment.points)}
            </span>
          ) : null}
          {assignment.grade ? <StatusBadge tone="good">{assignment.grade}</StatusBadge> : null}
        </>
      }
    >
      <span className="block truncate text-[14px] font-medium">{assignment.name}</span>
      <span className="mt-0.5 block text-[12.5px] text-[var(--color-muted)]">
        {assignment.gradedAt ? `Graded ${shortDate(assignment.gradedAt)}` : "Graded"}
      </span>
    </RecordRow>
  );
}
