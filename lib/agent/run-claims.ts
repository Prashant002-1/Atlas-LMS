import { randomUUID } from "node:crypto";
import { and, eq, isNull, like, lt, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { agentSessions } from "@/lib/db/schema";

function pendingClaimId() {
  return `pending:${randomUUID()}`;
}

const STALE_CLAIM_AFTER_MS = 2 * 60_000;

/** Never expose a private coordination token as a resumable Workflow id. */
export function publicWorkflowRunId(runId: string | null | undefined): string | null {
  return runId && !runId.startsWith("pending:") ? runId : null;
}

/** Claim one session response before starting external work. */
export async function claimActiveAgentRun(sessionId: string): Promise<string | null> {
  const claimId = pendingClaimId();
  const [claimed] = await db
    .update(agentSessions)
    .set({ activeRunId: claimId, activeRunStartedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(agentSessions.id, sessionId),
        or(
          isNull(agentSessions.activeRunId),
          and(
            like(agentSessions.activeRunId, "pending:%"),
            lt(agentSessions.activeRunStartedAt, new Date(Date.now() - STALE_CLAIM_AFTER_MS))
          )
        )
      )
    )
    .returning({ id: agentSessions.id });
  return claimed ? claimId : null;
}

/** Replace a private claim token with the addressable Workflow run id. */
export async function activateAgentRun(sessionId: string, claimId: string, runId: string): Promise<boolean> {
  const [activated] = await db
    .update(agentSessions)
    .set({ activeRunId: runId, activeRunStartedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(agentSessions.id, sessionId),
        or(eq(agentSessions.activeRunId, claimId), eq(agentSessions.activeRunId, runId))
      )
    )
    .returning({ id: agentSessions.id });
  return Boolean(activated);
}

export async function releaseAgentRunClaim(sessionId: string, claimId: string) {
  await db
    .update(agentSessions)
    .set({ activeRunId: null, activeRunStartedAt: null, updatedAt: new Date() })
    .where(and(eq(agentSessions.id, sessionId), eq(agentSessions.activeRunId, claimId)));
}

/** Claim the one server-owned deadline workflow for an assessed session. */
export async function claimDeadlineRun(sessionId: string): Promise<string | null> {
  const claimId = pendingClaimId();
  const [claimed] = await db
    .update(agentSessions)
    .set({ deadlineRunId: claimId, updatedAt: new Date() })
    .where(
      and(
        eq(agentSessions.id, sessionId),
        or(
          isNull(agentSessions.deadlineRunId),
          and(
            like(agentSessions.deadlineRunId, "pending:%"),
            lt(agentSessions.updatedAt, new Date(Date.now() - STALE_CLAIM_AFTER_MS))
          )
        )
      )
    )
    .returning({ id: agentSessions.id });
  return claimed ? claimId : null;
}

export async function activateDeadlineRun(sessionId: string, claimId: string, runId: string): Promise<boolean> {
  const [activated] = await db
    .update(agentSessions)
    .set({ deadlineRunId: runId, updatedAt: new Date() })
    .where(
      and(
        eq(agentSessions.id, sessionId),
        or(eq(agentSessions.deadlineRunId, claimId), eq(agentSessions.deadlineRunId, runId))
      )
    )
    .returning({ id: agentSessions.id });
  return Boolean(activated);
}

export async function releaseDeadlineRunClaim(sessionId: string, claimId: string) {
  await db
    .update(agentSessions)
    .set({ deadlineRunId: null, updatedAt: new Date() })
    .where(and(eq(agentSessions.id, sessionId), eq(agentSessions.deadlineRunId, claimId)));
}
