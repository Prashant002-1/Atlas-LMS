import { auth } from "@/lib/auth";
import { loadInstructorWorkspace, type InstructorWorkspace } from "@/lib/instructor/workspace";
import { PageHeader } from "@/components/teach/page-header";
import { StatusBadge, TextLink } from "@/components/atlas/primitives";
import { EmptyRecord } from "@/components/atlas/record";

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
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[var(--color-faint)]">Work in motion</h2>
        <div className="mt-2 divide-y divide-[var(--color-border)] rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-panel)]">
          {active.length > 0 ? (
            active.map((item) => <ProgressRow key={item.assignmentId ?? item.title} item={item} />)
          ) : (
            <div className="px-4 py-4">
              <EmptyRecord title="No live work" detail="Publish work to see it move." />
            </div>
          )}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[var(--color-faint)]">
          Roster ({workspace.students.length})
        </h2>
        <div className="mt-2 divide-y divide-[var(--color-border)] rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-panel)]">
          {workspace.students.map((student) => (
            <article key={student.id ?? student.name} className="flex items-center gap-4 px-4 py-3">
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
          ))}
        </div>
      </section>
    </>
  );
}

function ProgressRow({ item }: { item: InstructorWorkspace["workProgress"][number] }) {
  const waiting = Math.max(0, item.submitted - item.graded);
  return (
    <article className="flex items-center gap-4 px-4 py-3">
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
