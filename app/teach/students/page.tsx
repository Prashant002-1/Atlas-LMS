import { auth } from "@/lib/auth";
import { loadInstructorWorkspace, type InstructorWorkspace } from "@/lib/instructor/workspace";
import { PageHeader } from "@/components/teach/page-header";
import { StatusBadge, TextLink } from "@/components/atlas/primitives";
import { EmptyRecord } from "@/components/atlas/record";
import { StaggerGrid, MotionItem } from "@/components/atlas/motion";

/** The roster and where the work stands, plainly. */
export default async function TeachStudentsPage() {
  const session = await auth();
  const workspace = await loadInstructorWorkspace(session?.user);

  if (workspace.problem) {
    return (
      <>
        <PageHeader title="Students" />
        <p className="max-w-lg text-[14px] leading-6 text-[var(--color-muted)]">{workspace.problem.detail}</p>
      </>
    );
  }

  const active = [...workspace.workProgress].sort(
    (a, b) => Math.max(0, b.submitted - b.graded) - Math.max(0, a.submitted - a.graded)
  );

  return (
    <>
      <PageHeader title="Students" course={`${workspace.course.code} / ${workspace.course.term}`} />

      <section>
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--color-faint)]">Work in motion</h2>
        {active.length > 0 ? (
          <StaggerGrid className="mt-2.5 space-y-2" stagger={0.04}>
            {active.map((item) => (
              <MotionItem key={item.assignmentId ?? item.title}>
                <ProgressRow item={item} />
              </MotionItem>
            ))}
          </StaggerGrid>
        ) : (
          <div className="mt-2.5 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-5 shadow-[var(--shadow-panel)]">
            <EmptyRecord title="No live work" detail="Publish work to see it move." />
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--color-faint)]">
          Roster ({workspace.students.length})
        </h2>
        {workspace.students.length > 0 ? (
          <StaggerGrid className="mt-2.5 space-y-2" stagger={0.03}>
            {workspace.students.map((student) => (
              <MotionItem key={student.id ?? student.name}>
                <article className="atlas-card-hover group flex items-center gap-4 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-panel)]">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium leading-6">
                      {student.id ? <TextLink href={`/teach/student/${student.id}`}>{student.name}</TextLink> : student.name}
                    </p>
                    <p className="text-[12.5px] text-[var(--color-muted)]">
                      {student.graded} graded / {student.submitted - student.graded > 0 ? `${student.submitted - student.graded} waiting / ` : ""}
                      {student.open} open{student.missing > 0 ? ` / ${student.missing} missing` : ""}
                    </p>
                  </div>
                  <StatusBadge tone={student.missing > 0 ? "warn" : "neutral"}>{student.standing}</StatusBadge>
                </article>
              </MotionItem>
            ))}
          </StaggerGrid>
        ) : (
          <div className="mt-2.5 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-5 shadow-[var(--shadow-panel)]">
            <EmptyRecord title="No students" detail="No one is enrolled in this course yet." />
          </div>
        )}
      </section>
    </>
  );
}

function ProgressRow({ item }: { item: InstructorWorkspace["workProgress"][number] }) {
  const waiting = Math.max(0, item.submitted - item.graded);
  return (
    <article className="atlas-card-hover group flex items-center gap-4 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-panel)]">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium leading-6">
          {item.assignmentId ? <TextLink href={`/teach/work/${item.assignmentId}`}>{item.title}</TextLink> : item.title}
        </p>
        <p className="text-[12.5px] text-[var(--color-muted)]">
          {item.graded} graded / {item.submitted} submitted / {item.open} open
          {item.missing > 0 ? ` / ${item.missing} missing` : ""}
        </p>
      </div>
      {waiting > 0 ? <StatusBadge tone="warn">{waiting} to grade</StatusBadge> : <StatusBadge tone="good">Up to date</StatusBadge>}
    </article>
  );
}
