import { auth } from "@/lib/auth";
import { loadStudentCourseWorkspace } from "@/lib/student/workspace";
import { isOverdue, opensLabel } from "@/lib/student/format";
import { PageHeader } from "@/components/teach/page-header";
import { RecordRow } from "@/components/atlas/primitives";

/** Every published module in the course, in order, each opening its material. */
export default async function StudentCourseModulesPage({ params }: { params: Promise<{ courseId: string }> }) {
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

  return (
    <>
      <PageHeader title="Modules" />

      {workspace.materials.length > 0 ? (
        <div className="divide-y divide-[var(--color-border)]">
          {workspace.materials.map((material) => {
            /* A module whose unlock date has not passed yet is still ahead. */
            const opensAhead = material.unlockAt ? !isOverdue(material.unlockAt) : false;
            return (
              <RecordRow
                key={material.id}
                href={`/student/material/${material.id}`}
                aside={
                  opensAhead && material.unlockAt ? (
                    <span className="text-[0.6875rem] text-[var(--color-faint)]">
                      {opensLabel(material.unlockAt)}
                    </span>
                  ) : undefined
                }
              >
                <span className="flex min-w-0 items-baseline gap-3.5">
                  <span className="w-5 shrink-0 text-[0.8125rem] tabular-nums text-[var(--color-faint)]">
                    {material.week}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[0.875rem] font-medium">{material.title}</span>
                    {material.summary ? (
                      <span className="mt-0.5 block truncate text-[0.78125rem] text-[var(--color-muted)]">{material.summary}</span>
                    ) : null}
                  </span>
                </span>
              </RecordRow>
            );
          })}
        </div>
      ) : (
        <p className="py-5 text-[0.8125rem] text-[var(--color-muted)]">No modules yet.</p>
      )}
    </>
  );
}
