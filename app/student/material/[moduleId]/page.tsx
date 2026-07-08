import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { loadStudentMaterialWorkspace } from "@/lib/student/workspace";
import { PageHeader } from "@/components/teach/page-header";
import { BackLink, CodeList, StatusBadge, TextLink } from "@/components/atlas/primitives";

const tone = { graded: "good", submitted: "accent", open: "neutral", missing: "warn" } as const;
const label = { graded: "Done", submitted: "Submitted", open: "Open", missing: "Missing" } as const;

/** One week of material, with the work it leads to and the cues to go deeper. */
export default async function StudentMaterialPage({ params }: { params: Promise<{ moduleId: string }> }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in?role=student");
  }
  const { moduleId } = await params;
  const workspace = await loadStudentMaterialWorkspace(session.user, moduleId);

  if (workspace.problem || !workspace.material) {
    return (
      <>
        <PageHeader title={workspace.problem?.title ?? "Material unavailable"} />
        <p className="max-w-lg text-[14px] leading-6 text-[var(--color-muted)]">
          {workspace.problem?.detail ?? "This material is not in the course record."}
        </p>
      </>
    );
  }

  const material = workspace.material;

  return (
    <>
      <BackLink href={`/student/course/${workspace.course.id}`}>{workspace.course.code}</BackLink>

      <div className="mt-3">
        <PageHeader title={material.title} course={`Week ${material.week}`} />
      </div>

      <section className="rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-panel)]">
        {material.summary ? (
          <p className="max-w-3xl whitespace-pre-wrap text-[14.5px] leading-7">{material.summary}</p>
        ) : (
          <p className="text-[14px] text-[var(--color-muted)]">No summary is attached to this material.</p>
        )}
        {material.objectiveCodes.length > 0 ? (
          <div className="mt-4">
            <CodeList codes={material.objectiveCodes} />
          </div>
        ) : null}
      </section>

      {workspace.relatedAssignments.length > 0 ? (
        <section className="mt-4 rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-panel)]">
          <p className="atlas-mono border-b border-[var(--color-border)] px-5 py-3 text-[11px] uppercase tracking-[0.08em] text-[var(--color-faint)]">
            Work this leads to
          </p>
          <div className="divide-y divide-[var(--color-border)]">
            {workspace.relatedAssignments.map((assignment) => (
              <div key={assignment.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <p className="min-w-0 truncate text-[14px] font-medium">
                  <TextLink href={`/student/work/${assignment.id}`}>{assignment.name}</TextLink>
                </p>
                <StatusBadge tone={tone[assignment.status]}>{label[assignment.status]}</StatusBadge>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
