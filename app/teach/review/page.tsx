import { auth } from "@/lib/auth";
import { loadInstructorWorkspace } from "@/lib/instructor/workspace";
import { PageHeader } from "@/components/teach/page-header";
import { ProposalCard } from "@/components/teach/proposals";
import { EmptyRecord } from "@/components/atlas/record";
import { StaggerGrid, MotionItem } from "@/components/atlas/motion";

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
        <p className="max-w-lg text-[14px] leading-6 text-[var(--color-muted)]">{workspace.problem.detail}</p>
      </>
    );
  }

  const open = workspace.proposals.filter((p) => p.status === "pending");
  const decided = workspace.proposals.filter((p) => p.status === "applied" || p.status === "rejected").slice(0, 5);

  return (
    <>
      <PageHeader title="Review" course={`${workspace.course.code} / ${workspace.course.term}`} />

      {open.length > 0 ? (
        <StaggerGrid className="space-y-3" stagger={0.06}>
          {open.map((proposal) => (
            <MotionItem key={proposal.id}>
              <ProposalCard proposal={proposal} />
            </MotionItem>
          ))}
        </StaggerGrid>
      ) : (
        <div className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-5 shadow-[var(--shadow-panel)]">
          <EmptyRecord title="Clear" detail="Nothing is waiting. Drafts from Atlas land here." />
        </div>
      )}

      {decided.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--color-faint)]">Recent decisions</h2>
          <StaggerGrid className="mt-2.5 space-y-3" stagger={0.05} delay={0.1}>
            {decided.map((proposal) => (
              <MotionItem key={proposal.id}>
                <ProposalCard proposal={proposal} compact />
              </MotionItem>
            ))}
          </StaggerGrid>
        </section>
      ) : null}
    </>
  );
}
