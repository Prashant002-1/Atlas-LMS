import { auth } from "@/lib/auth";
import { loadInstructorWorkspace, type InstructorWorkspace } from "@/lib/instructor/workspace";
import { PageHeader } from "@/components/teach/page-header";
import { StatusBadge, TextLink } from "@/components/atlas/primitives";
import { EmptyState } from "@/components/atlas/record";

/** The roster and where the work stands, plainly. */
export default async function TeachStudentsPage() {
  const session = await auth();
  const workspace = await loadInstructorWorkspace(session?.user);

  if (workspace.problem) {
    return (
      <>
        <PageHeader title="Students" />
        <p className="max-w-lg text-[0.875rem] leading-6 text-[var(--color-muted)]">{workspace.problem.detail}</p>
      </>
    );
  }

  /* Record order, not a queue: work sorts by its own due dates. */
  const active = [...workspace.workProgress].sort((a, b) => {
    if (a.dueAt && b.dueAt) return a.dueAt.getTime() - b.dueAt.getTime();
    if (a.dueAt) return -1;
    if (b.dueAt) return 1;
    return a.title.localeCompare(b.title);
  });

  return (
    <>
      <PageHeader title="Students" course={`${workspace.course.code} / ${workspace.course.term}`} />

      <section>
        <h2 className="text-[0.8125rem] font-semibold uppercase tracking-[0.08em] text-[var(--color-faint)]">
          Roster ({workspace.students.length})
        </h2>
        {workspace.students.length > 0 ? (
          <div className="mt-2.5 space-y-2">
            {workspace.students.map((student) => (
              <article key={student.id ?? student.name} className="atlas-card-hover group flex items-center gap-4 rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-panel)]">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.875rem] font-medium leading-6">
                    {student.id ? <TextLink href={`/teach/student/${student.id}`}>{student.name}</TextLink> : student.name}
                  </p>
                  <p className="text-[0.78125rem] text-[var(--color-muted)]">
                    {student.graded} graded / {student.submitted - student.graded > 0 ? `${student.submitted - student.graded} waiting / ` : ""}
                    {student.open} open{student.missing > 0 ? ` / ${student.missing} missing` : ""}
                  </p>
                </div>
                <StatusBadge tone={student.missing > 0 ? "warn" : "neutral"}>{student.standing}</StatusBadge>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-2.5 rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-panel)]">
            <EmptyState art="atlas" title="No students" detail="No one is enrolled in this course yet." />
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-[0.8125rem] font-semibold uppercase tracking-[0.08em] text-[var(--color-faint)]">Work</h2>
        {active.length > 0 ? (
          <div className="mt-2.5 space-y-2">
            {active.map((item) => <ProgressRow key={item.assignmentId ?? item.title} item={item} />)}
          </div>
        ) : (
          <div className="mt-2.5 rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-panel)]">
            <EmptyState art="atlas" title="No work" detail="Published assignments appear here with their submission state." />
          </div>
        )}
      </section>
    </>
  );
}

function ProgressRow({ item }: { item: InstructorWorkspace["workProgress"][number] }) {
  const waiting = Math.max(0, item.submitted - item.graded);
  return (
    <article className="atlas-card-hover group flex items-center gap-4 rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-panel)]">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.875rem] font-medium leading-6">
          {item.assignmentId ? <TextLink href={`/teach/work/${item.assignmentId}`}>{item.title}</TextLink> : item.title}
        </p>
        <p className="text-[0.78125rem] text-[var(--color-muted)]">
          {item.graded} graded / {item.submitted} submitted / {item.open} open
          {item.missing > 0 ? ` / ${item.missing} missing` : ""}
        </p>
      </div>
      {waiting > 0 ? <StatusBadge tone="warn">{waiting} ungraded</StatusBadge> : <StatusBadge tone="good">All graded</StatusBadge>}
    </article>
  );
}
