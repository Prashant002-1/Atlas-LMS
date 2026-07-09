import { auth } from "@/lib/auth";
import { loadStudentCourseWorkspace } from "@/lib/student/workspace";
import { isOverdue, opensLabel } from "@/lib/student/format";
import { PageHeader } from "@/components/teach/page-header";
import { RecordRow } from "@/components/atlas/primitives";
import { EmptyState } from "@/components/atlas/record";

/** Every published module in the course, in order, each opening its material. */
export default async function StudentCourseModulesPage({ params }: { params: Promise<{ courseId: string }> }) {
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

  return (
    <>
      <PageHeader title="Modules" course={`${workspace.course.code} / ${workspace.course.name}`} />

      {workspace.materials.length > 0 ? (
        <div className="divide-y divide-[var(--color-border)] rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-panel)]">
          {workspace.materials.map((material) => {
            /* A module whose unlock date has not passed yet is still ahead. */
            const opensAhead = material.unlockAt ? !isOverdue(material.unlockAt) : false;
            return (
              <RecordRow
                key={material.id}
                href={`/student/material/${material.id}`}
                aside={
                  opensAhead && material.unlockAt ? (
                    <span className="atlas-mono text-[11px] uppercase tracking-[0.06em] text-[var(--color-faint)]">
                      {opensLabel(material.unlockAt)}
                    </span>
                  ) : undefined
                }
              >
                <span className="flex min-w-0 items-baseline gap-3.5">
                  <span className="atlas-mono w-5 shrink-0 text-[13px] tabular-nums text-[var(--color-faint)]">
                    {material.week}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-medium">{material.title}</span>
                    {material.summary ? (
                      <span className="mt-0.5 block truncate text-[12.5px] text-[var(--color-muted)]">{material.summary}</span>
                    ) : null}
                  </span>
                </span>
              </RecordRow>
            );
          })}
        </div>
      ) : (
        <div className="rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-panel)]">
          <EmptyState art="atlas" title="No modules yet" detail="Published material appears here module by module." />
        </div>
      )}
    </>
  );
}
