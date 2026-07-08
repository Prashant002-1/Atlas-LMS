import Link from "next/link";
import { auth } from "@/lib/auth";
import { loadStudentCourseWorkspace, type StudentAssignment } from "@/lib/student/workspace";
import { PageHeader } from "@/components/teach/page-header";
import { StatusBadge, TextLink } from "@/components/atlas/primitives";
import { EmptyRecord } from "@/components/atlas/record";

const tone = { graded: "good", submitted: "accent", open: "neutral", missing: "warn" } as const;
const label = { graded: "Done", submitted: "Submitted", open: "Open", missing: "Missing" } as const;

/** One course: this week, the work, the material, the notes, and the cues. */
export default async function StudentCoursePage({ params }: { params: Promise<{ courseId: string }> }) {
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

  const open = workspace.assignments.filter((a) => a.status === "open" || a.status === "missing");
  const done = workspace.assignments.filter((a) => a.status === "submitted" || a.status === "graded");
  const latestNote = workspace.notices[0];

  return (
    <>
      <PageHeader
        title={workspace.course.name}
        course={`${workspace.course.code} / ${workspace.course.term}`}
        action={workspace.standing ? <StatusBadge tone="neutral">{workspace.standing}</StatusBadge> : undefined}
      />

      {workspace.currentWeek ? (
        <section className="atlas-card-hover rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-panel)]">
          <p className="atlas-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-faint)]">This week</p>
          <p className="mt-1 text-[15px] font-semibold leading-6">
            <TextLink href={`/student/material/${workspace.currentWeek.id}`}>{workspace.currentWeek.title}</TextLink>
          </p>
          {workspace.currentWeek.summary ? (
            <p className="mt-1 line-clamp-2 text-[13.5px] leading-6 text-[var(--color-muted)]">{workspace.currentWeek.summary}</p>
          ) : null}
        </section>
      ) : null}

      {latestNote ? (
        <section className="mt-3 atlas-card-hover rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-panel)]">
          <p className="atlas-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-faint)]">From your professor</p>
          <p className="mt-1 text-[14px] font-medium">{latestNote.title}</p>
          {latestNote.message ? <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-[var(--color-muted)]">{latestNote.message}</p> : null}
        </section>
      ) : null}

      <section className="mt-7">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--color-faint)]">Work</h2>
        <div className="mt-2.5 divide-y divide-[var(--color-border)] rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-panel)]">
          {open.length + done.length > 0 ? (
            [...open, ...done].map((assignment) => <WorkRow key={assignment.id} assignment={assignment} />)
          ) : (
            <div className="px-4 py-4">
              <EmptyRecord title="No work yet" detail="Published work appears here." />
            </div>
          )}
        </div>
      </section>

      <section className="mt-7">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--color-faint)]">Material</h2>
        <div className="mt-2.5 divide-y divide-[var(--color-border)] rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-panel)]">
          {workspace.materials.length > 0 ? (
            workspace.materials.map((material) => (
              <Link
                key={material.id}
                href={`/student/material/${material.id}`}
                className="atlas-row-hover flex items-center gap-4 px-4 py-2.5 hover:bg-[var(--color-surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-accent-strong)]"
              >
                <span className="atlas-mono w-6 shrink-0 text-[12.5px] text-[var(--color-faint)]">{material.week}</span>
                <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{material.title}</span>
              </Link>
            ))
          ) : (
            <div className="px-4 py-4">
              <EmptyRecord title="No material yet" detail="Published weeks appear here." />
            </div>
          )}
        </div>
      </section>

    </>
  );
}

function WorkRow({ assignment }: { assignment: StudentAssignment }) {
  return (
    <Link
      href={`/student/work/${assignment.id}`}
      className="flex items-center gap-4 px-4 py-3 transition hover:bg-[var(--color-surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-accent-strong)]"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium">{assignment.name}</span>
        <span className="mt-0.5 block text-[12.5px] text-[var(--color-muted)]">
          {assignment.dueAt ? `Due ${assignment.dueAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "No due date"}
          {typeof assignment.score === "number" && assignment.points
            ? ` / ${Math.round(assignment.score)}/${Math.round(assignment.points)}`
            : ""}
        </span>
      </span>
      <StatusBadge tone={tone[assignment.status]}>{label[assignment.status]}</StatusBadge>
    </Link>
  );
}
