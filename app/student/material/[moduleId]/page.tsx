import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { loadStudentMaterialWorkspace } from "@/lib/student/workspace";
import { PageHeader } from "@/components/teach/page-header";
import { BackLink, StatusBadge, TextLink } from "@/components/atlas/primitives";

const tone = { graded: "good", submitted: "accent", open: "neutral", missing: "warn" } as const;
const label = { graded: "Graded", submitted: "Submitted", open: "Open", missing: "Missing" } as const;

export default async function StudentMaterialPage({ params }: { params: Promise<{ moduleId: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in?role=student");
  const { moduleId } = await params;
  const workspace = await loadStudentMaterialWorkspace(session.user, moduleId);

  if (workspace.problem || !workspace.material) {
    return (
      <>
        <PageHeader title={workspace.problem?.title ?? "Material unavailable"} />
        <p className="max-w-lg text-[0.875rem] leading-6 text-[var(--color-muted)]">
          {workspace.problem?.detail ?? "This material is not part of this course."}
        </p>
      </>
    );
  }

  const material = workspace.material;

  return (
    <>
      <BackLink href={`/student/course/${workspace.course.id}/modules`}>Modules</BackLink>
      <div className="mt-3"><PageHeader title={material.title} course={`Week ${material.week}`} /></div>

      <section className="py-5">
        {material.summary ? (
          <p className="max-w-3xl whitespace-pre-wrap text-[0.90625rem] leading-7">{material.summary}</p>
        ) : (
          <p className="text-[0.875rem] text-[var(--color-muted)]">No summary is attached to this material.</p>
        )}
      </section>

      {workspace.relatedAssignments.length > 0 ? (
        <section className="mt-6">
          <p className="px-5 py-3 text-[0.75rem] font-medium text-[var(--color-muted)]">Related assignments</p>
          <div className="divide-y divide-[var(--color-border)]">
            {workspace.relatedAssignments.map((assignment) => (
              <div key={assignment.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <p className="min-w-0 truncate text-[0.875rem] font-medium">
                  <TextLink href={`/student/assignments/${assignment.id}`}>{assignment.name}</TextLink>
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
