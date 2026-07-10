import { auth } from "@/lib/auth";
import { loadStudentCourseWorkspace, type StudentAssignment } from "@/lib/student/workspace";
import { dueLabel, isOverdue, shortDate } from "@/lib/student/format";
import { PageHeader } from "@/components/teach/page-header";
import { RecordRow, StatusBadge } from "@/components/atlas/primitives";
import { EmptyState } from "@/components/atlas/record";

const tone = { graded: "good", submitted: "accent", open: "neutral", missing: "warn" } as const;
const label = { graded: "Graded", submitted: "Submitted", open: "Open", missing: "Missing" } as const;

/** Every published assignment: the open work first, then what is already in. */
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
      <PageHeader title="Assignments" course={`${workspace.course.code} / ${workspace.course.name}`} />

      <section>
        <h2 className="text-[0.8125rem] font-semibold uppercase tracking-[0.08em] text-[var(--color-faint)]">Open</h2>
        <div className="mt-2.5 rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-panel)]">
          {open.length > 0 ? (
            <div className="divide-y divide-[var(--color-border)]">
              {open.map((assignment) => (
                <AssignmentRow key={assignment.id} assignment={assignment} />
              ))}
            </div>
          ) : done.length > 0 ? (
            <EmptyState art="summit" title="Everything is in" detail="No open work in this course right now." />
          ) : (
            <EmptyState art="atlas" title="No assignments yet" detail="Published work appears here." />
          )}
        </div>
      </section>

      {done.length > 0 ? (
        <section className="mt-7">
          <h2 className="text-[0.8125rem] font-semibold uppercase tracking-[0.08em] text-[var(--color-faint)]">Turned in</h2>
          <div className="mt-2.5 divide-y divide-[var(--color-border)] rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-panel)]">
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
      href={`/student/work/${assignment.id}`}
      aside={<StatusBadge tone={tone[assignment.status]}>{label[assignment.status]}</StatusBadge>}
    >
      <span className="block truncate text-[0.875rem] font-medium">{assignment.name}</span>
      <span
        className={`mt-0.5 block truncate text-[0.78125rem] ${
          overdue ? "font-medium text-[var(--color-danger)]" : "text-[var(--color-muted)]"
        }`}
      >
        {facts.length > 0 ? facts.join(" / ") : "No due date"}
      </span>
    </RecordRow>
  );
}
