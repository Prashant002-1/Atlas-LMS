import { auth } from "@/lib/auth";
import { loadInstructorWorkspace } from "@/lib/instructor/workspace";
import { PageHeader } from "@/components/teach/page-header";
import { ProposalHistory, ProposalPreview, ProposalQueue } from "@/components/teach/proposals";
import { BackLink } from "@/components/atlas/primitives";
import { scopeLabel } from "@/lib/workspace/term-label";

/** A review index, with one deliberately opened draft or completed review. */
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
  const selected = params.proposal
    ? workspace.proposals.find((proposal) => proposal.id === params.proposal)
    : undefined;
  const courseLabel = scopeLabel({ code: workspace.course.code, termName: workspace.course.term });

  if (selected) {
    return (
      <>
        <BackLink href="/teach/review">Review</BackLink>
        <div className="mt-3">
          <PageHeader title={selected.title} course={`${courseLabel} / ${selected.recordLabel}`} />
        </div>
        <ProposalPreview proposal={selected} />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Review" course={courseLabel} />
      <ProposalQueue proposals={open} />
      <ProposalHistory proposals={decided} />
    </>
  );
}
