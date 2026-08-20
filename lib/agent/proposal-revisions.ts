import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { changeProposals, proposalBlocks } from "@/lib/db/schema";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type ProposalRevision = {
  revision: number;
  supersedesProposalId: string | null;
};

/**
 * Resolve an explicit draft revision inside the transaction that creates it.
 * A revision can only replace an open draft from the same course and chat.
 */
export async function resolveProposalRevision(
  tx: Tx,
  args: {
    orgId: string;
    courseId: string;
    sessionId: string;
    revisesProposalId?: string;
    kind: string;
    targetKey?: string;
  }
): Promise<ProposalRevision> {
  const [current] = args.revisesProposalId ? await tx
    .select({
      id: changeProposals.id,
      kind: changeProposals.kind,
      status: changeProposals.status,
      revision: changeProposals.revision,
      diff: changeProposals.diff,
    })
    .from(changeProposals)
    .where(
      and(
        eq(changeProposals.id, args.revisesProposalId),
        eq(changeProposals.orgId, args.orgId),
        eq(changeProposals.courseId, args.courseId),
        eq(changeProposals.sessionId, args.sessionId)
      )
    )
    .limit(1) : [];
  if (args.revisesProposalId && (!current || current.status !== "pending")) {
    throw new Error("That draft is no longer open for revision.");
  }
  if (current && current.kind !== args.kind) {
    throw new Error("That draft is a different kind of course change.");
  }
  const currentTarget = (current?.diff as { revisionKey?: unknown } | null)?.revisionKey;
  if (current && args.targetKey && currentTarget !== args.targetKey) {
    throw new Error("That draft belongs to a different course record.");
  }
  if (args.targetKey) {
    const pending = await tx
      .select({ id: changeProposals.id, diff: changeProposals.diff })
      .from(changeProposals)
      .where(
        and(
          eq(changeProposals.orgId, args.orgId),
          eq(changeProposals.courseId, args.courseId),
          eq(changeProposals.sessionId, args.sessionId),
          eq(changeProposals.status, "pending")
        )
      );
    if (pending.some((proposal) => proposal.id !== current?.id && (proposal.diff as { revisionKey?: unknown } | null)?.revisionKey === args.targetKey)) {
      throw new Error("A draft for that course change is already open. Revise that draft instead.");
    }
  }
  return current
    ? { revision: current.revision + 1, supersedesProposalId: current.id }
    : { revision: 1, supersedesProposalId: null };
}

/** Mark the replaced card as history only after its successor is safely stored. */
export async function supersedeProposal(tx: Tx, proposalId: string | null): Promise<void> {
  if (!proposalId) return;
  await tx
    .update(proposalBlocks)
    .set({ status: "superseded" })
    .where(and(eq(proposalBlocks.proposalId, proposalId), eq(proposalBlocks.status, "pending")));
  await tx
    .update(changeProposals)
    .set({ status: "superseded", decidedAt: new Date() })
    .where(and(eq(changeProposals.id, proposalId), eq(changeProposals.status, "pending")));
}
