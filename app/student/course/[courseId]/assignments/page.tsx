import { auth } from "@/lib/auth";
import { loadStudentCourseWorkspace, type StudentAssignment } from "@/lib/student/workspace";
import { dueLabel, isOverdue, shortDate } from "@/lib/student/format";
import { PageHeader } from "@/components/teach/page-header";
import { RecordRow, StatusBadge } from "@/components/atlas/primitives";

const tone = { graded: "good", submitted: "accent", open: "neutral", missing: "warn" } as const;
const label = { graded: "Graded", submitted: "Submitted", open: "Open", missing: "Missing" } as const;

/** Every published assignment: open assignments first, then submitted records. */
export default async function StudentCourseAssignmentsPage({ params }: { params: Promise<{ courseId: string }> }) {
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

  const open = workspace.assignments.filter((a) => a.status === "open" || a.status === "missing");
  const done = workspace.assignments.filter((a) => a.status === "submitted" || a.status === "graded");

  return (
    <>
      <PageHeader title="Assignments" />

      <section>
        <h2 className="mb-2 text-[1rem] font-semibold text-[var(--color-ink)]">Open</h2>
        <div>
          {open.length > 0 ? (
            <div className="divide-y divide-[var(--color-border)]">
              {open.map((assignment) => (
                <AssignmentRow key={assignment.id} assignment={assignment} />
              ))}
            </div>
          ) : done.length > 0 ? (
            <p className="py-5 text-[0.8125rem] text-[var(--color-muted)]">No open assignments.</p>
          ) : (
            <p className="py-5 text-[0.8125rem] text-[var(--color-muted)]">No assignments yet.</p>
          )}
        </div>
      </section>

      {done.length > 0 ? (
        <section className="mt-7">
          <h2 className="mb-2 text-[1rem] font-semibold text-[var(--color-ink)]">Submitted</h2>
          <div className="divide-y divide-[var(--color-border)]">
            {done.map((assignment) => (
              <AssignmentRow key={assignment.id} assignment={assignment} />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

function AssignmentRow({ assignment }: { assignment: StudentAssignment }) {
  const openState = assignment.status === "open" || assignment.status === "missing";
  const overdue = openState && assignment.dueAt ? isOverdue(assignment.dueAt) : false;

  const facts: string[] = [];
  if (openState && assignment.dueAt) facts.push(dueLabel(assignment.dueAt));
  if (!openState && assignment.submittedAt) facts.push(`Submitted ${shortDate(assignment.submittedAt)}`);
  if (typeof assignment.score === "number" && assignment.points) {
    facts.push(`${Math.round(assignment.score)}/${Math.round(assignment.points)}`);
  } else if (assignment.points) {
    facts.push(`${Math.round(assignment.points)} pts`);
  }

  return (
    <RecordRow
      href={`/student/assignments/${assignment.id}`}
      aside={<StatusBadge tone={tone[assignment.status]}>{label[assignment.status]}</StatusBadge>}
    >
      <span className="block truncate text-[0.875rem] font-medium">{assignment.name}</span>
      <span
        className={`mt-0.5 block truncate text-[0.78125rem] ${
          overdue ? "font-medium text-[var(--color-danger)]" : "text-[var(--color-muted)]"
        }`}
      >
        {facts.length > 0 ? facts.join(", ") : "No due date"}
      </span>
    </RecordRow>
  );
}
