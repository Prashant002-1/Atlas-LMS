import { auth } from "@/lib/auth";
import { loadInstructorWorkspace } from "@/lib/instructor/workspace";
import { PageHeader } from "@/components/teach/page-header";
import { ProposalHistory, ProposalPreview, ProposalQueue } from "@/components/teach/proposals";
import { EmptyState } from "@/components/atlas/record";
import { scopeLabel } from "@/lib/workspace/term-label";

/** One URL-selected draft, the open queue, and the course's decision history. */
export default async function TeachReviewPage({ searchParams }: { searchParams: Promise<{ proposal?: string }> }) {
  const session = await auth();
  const [workspace, params] = await Promise.all([loadInstructorWorkspace(session?.user), searchParams]);

  if (workspace.problem) {
    return (
      <>
        <PageHeader title="Review" />
        <p className="max-w-lg text-[0.875rem] leading-6 text-[var(--color-muted)]">{workspace.problem.detail}</p>
      </>
    );
  }

  const open = workspace.proposals.filter((proposal) => proposal.status === "pending");
  const decided = workspace.proposals.filter((proposal) => proposal.status === "applied" || proposal.status === "rejected");
  const selected = workspace.proposals.find((proposal) => proposal.id === params.proposal) ?? open[0] ?? decided[0];

  return (
    <>
      <PageHeader title="Review" course={scopeLabel({ code: workspace.course.code, termName: workspace.course.term })} />

      {selected ? (
        <>
          <div className="grid gap-8 lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start">
            <ProposalQueue proposals={open} selectedId={selected.id} />
            <ProposalPreview proposal={selected} />
          </div>
          <ProposalHistory proposals={decided} selectedId={selected.id} />
        </>
      ) : (
        <EmptyState art="horizon" title="No drafts" />
      )}
    </>
  );
}
