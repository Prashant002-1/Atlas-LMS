import { auth } from "@/lib/auth";
import { loadInstructorWorkspace } from "@/lib/instructor/workspace";
import { PageHeader } from "@/components/teach/page-header";
import { ProposalCard } from "@/components/teach/proposals";
import { EmptyState } from "@/components/atlas/record";

/**
 * Review: every draft Atlas has produced, waiting on a decision. Apply writes
 * the records; dismiss closes the draft. Nothing else touches the course.
 */
export default async function TeachReviewPage() {
  const session = await auth();
  const workspace = await loadInstructorWorkspace(session?.user);

  if (workspace.problem) {
    return (
      <>
        <PageHeader title="Review" />
        <p className="max-w-lg text-[0.875rem] leading-6 text-[var(--color-muted)]">{workspace.problem.detail}</p>
      </>
    );
  }

  const open = workspace.proposals.filter((p) => p.status === "pending");
  const decided = workspace.proposals.filter((p) => p.status === "applied" || p.status === "rejected").slice(0, 5);

  return (
    <>
      <PageHeader title="Review" course={`${workspace.course.code} / ${workspace.course.term}`} />

      {open.length > 0 ? (
        <div className="space-y-3">
          {open.map((proposal) => <ProposalCard key={proposal.id} proposal={proposal} />)}
        </div>
      ) : (
        <div className="rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-panel)]">
          <EmptyState art="horizon" title="Nothing waiting" detail="Drafts from Atlas land here for your decision." />
        </div>
      )}

      {decided.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-[0.8125rem] font-semibold uppercase tracking-[0.08em] text-[var(--color-faint)]">Recent decisions</h2>
          <div className="mt-2.5 space-y-3">
            {decided.map((proposal) => <ProposalCard key={proposal.id} proposal={proposal} compact />)}
          </div>
        </section>
      ) : null}
    </>
  );
}
