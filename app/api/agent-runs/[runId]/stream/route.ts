import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getRun } from "workflow/api";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { agentSessions } from "@/lib/db/schema";
import { workflowStreamResponse } from "@/lib/agent/workflow-stream";

export const maxDuration = 120;

export async function GET(request: Request, { params }: { params: Promise<{ runId: string }> }) {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || !user.orgId) {
    return NextResponse.json({ error: "Sign in to resume this run." }, { status: 401 });
  }

  const { runId } = await params;
  const [ownedRun] = await db
    .select({ id: agentSessions.id })
    .from(agentSessions)
    .where(
      and(
        eq(agentSessions.orgId, user.orgId),
        eq(agentSessions.userId, user.id),
        eq(agentSessions.activeRunId, runId)
      )
    )
    .limit(1);
  if (!ownedRun) {
    return NextResponse.json({ error: "That active run is no longer available." }, { status: 404 });
  }

  const rawIndex = new URL(request.url).searchParams.get("startIndex");
  const parsedIndex = rawIndex === null ? undefined : Number.parseInt(rawIndex, 10);
  if (parsedIndex !== undefined && !Number.isFinite(parsedIndex)) {
    return NextResponse.json({ error: "Malformed stream position." }, { status: 400 });
  }

  const run = getRun(runId);
  const readable = run.getReadable({ startIndex: parsedIndex });
  const tailIndex = await readable.getTailIndex();
  return workflowStreamResponse(readable, { "x-workflow-stream-tail-index": String(tailIndex) });
}
