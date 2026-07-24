import { and, eq, isNull } from "drizzle-orm";
import { getStepMetadata, getWorkflowMetadata, getWritable, sleep } from "workflow";
import { db } from "@/lib/db";
import { agentSessions, sessionSubmissions } from "@/lib/db/schema";
import { loadActiveCourseAgentConfig } from "@/lib/agent/course-agent-config";
import { resolvePlatformModel } from "@/lib/ai/platform-model";
import { runProfessorTurn } from "@/lib/agent/professor-runtime";
import { runGradingForSubmission } from "@/lib/agent/grading";
import { runSessionTurn } from "@/lib/agent/session-runtime";
import { runStudentAtlasTurn } from "@/lib/agent/student-atlas-runtime";
import { studentDisplayName } from "@/lib/agent/session-store";
import { loadInstitutionName } from "@/lib/workspace/institution";
import { concludeExpiredSession } from "@/lib/agent/session-conclusion";
import { loadSessionAssignmentBundle } from "@/lib/agent/session-store";
import { activateAgentRun, activateDeadlineRun } from "@/lib/agent/run-claims";

type ProfessorTurnArgs = {
  orgId: string;
  instructorId: string;
  courseId: string;
  sessionId: string;
  userText: string;
  runClaimId: string;
};

type StudentTurnArgs = {
  orgId: string;
  courseId: string;
  sessionId: string;
  assignmentId: string;
  userText: string;
  userTurnIndex: number;
  runClaimId: string;
};

type StudentAtlasTurnArgs = {
  orgId: string;
  studentId: string;
  sessionId: string;
  userText: string;
  runClaimId: string;
};

type SessionGradingArgs = {
  orgId: string;
  submissionId: string;
};

async function registerActiveRun(sessionId: string, claimId: string, runId: string) {
  "use step";
  if (!(await activateAgentRun(sessionId, claimId, runId))) {
    throw new Error("This session run no longer owns the active claim.");
  }
}

async function pipeResponseToWorkflow(response: Response) {
  const body = response.body;
  if (!body) throw new Error("Agent response has no stream.");
  await body.pipeTo(getWritable<Uint8Array>());
}

async function streamProfessorTurnStep(args: ProfessorTurnArgs, runId: string) {
  "use step";
  try {
    const [session] = await db
      .select()
      .from(agentSessions)
      .where(and(eq(agentSessions.id, args.sessionId), eq(agentSessions.orgId, args.orgId), isNull(agentSessions.archivedAt)))
      .limit(1);
    if (!session || session.userId !== args.instructorId || session.courseId !== args.courseId) {
      throw new Error("Professor chat not found.");
    }
    const resolved = resolvePlatformModel();
    if (!resolved) throw new Error("Atlas's model runtime is not configured.");

    await pipeResponseToWorkflow(await runProfessorTurn({
      session,
      scope: { orgId: args.orgId, instructorId: args.instructorId, courseId: args.courseId },
      model: resolved.model,
      userText: args.userText,
      userTurnPersisted: true,
    }));
  } finally {
    await db
      .update(agentSessions)
      .set({ activeRunId: null, activeRunStartedAt: null, updatedAt: new Date() })
      .where(and(eq(agentSessions.id, args.sessionId), eq(agentSessions.activeRunId, runId)));
  }
}
streamProfessorTurnStep.maxRetries = 0;

async function streamStudentTurnStep(args: StudentTurnArgs, runId: string) {
  "use step";
  try {
    const [session] = await db
      .select()
      .from(agentSessions)
      .where(and(eq(agentSessions.id, args.sessionId), eq(agentSessions.orgId, args.orgId), isNull(agentSessions.archivedAt)))
      .limit(1);
    if (!session || session.courseId !== args.courseId || session.anchorId !== args.assignmentId) {
      throw new Error("Student session not found.");
    }
    const [bundle, courseAgent] = await Promise.all([
      loadSessionAssignmentBundle(args.orgId, args.assignmentId),
      loadActiveCourseAgentConfig(args.orgId, args.courseId),
    ]);
    const resolved = resolvePlatformModel();
    if (!bundle) throw new Error("Session assignment contract not found.");
    if (!resolved) throw new Error("Atlas's model runtime is not configured.");

    await pipeResponseToWorkflow(await runSessionTurn({
      session,
      bundle,
      courseAgent,
      model: resolved.model,
      userText: args.userText,
      userTurnIndex: args.userTurnIndex,
    }));
  } finally {
    await db
      .update(agentSessions)
      .set({ activeRunId: null, activeRunStartedAt: null, updatedAt: new Date() })
      .where(and(eq(agentSessions.id, args.sessionId), eq(agentSessions.activeRunId, runId)));
  }
}
streamStudentTurnStep.maxRetries = 0;

export async function professorTurnWorkflow(args: ProfessorTurnArgs) {
  "use workflow";
  const { workflowRunId } = getWorkflowMetadata();
  await registerActiveRun(args.sessionId, args.runClaimId, workflowRunId);
  await streamProfessorTurnStep(args, workflowRunId);
}

export async function studentTurnWorkflow(args: StudentTurnArgs) {
  "use workflow";
  const { workflowRunId } = getWorkflowMetadata();
  await registerActiveRun(args.sessionId, args.runClaimId, workflowRunId);
  await streamStudentTurnStep(args, workflowRunId);
}

async function gradeSessionSubmissionStep(args: SessionGradingArgs) {
  "use step";
  const { attempt } = getStepMetadata();
  await db
    .update(sessionSubmissions)
    .set({
      gradingStatus: attempt > 1 ? "retrying" : "running",
      gradingAttempt: attempt,
    })
    .where(and(eq(sessionSubmissions.id, args.submissionId), eq(sessionSubmissions.orgId, args.orgId)));

  console.log(`[session-grading] START submission=${args.submissionId} attempt=${attempt}`);

  try {
    const resolved = resolvePlatformModel();
    if (!resolved) throw new Error("Atlas's model runtime is not configured.");

    await runGradingForSubmission({
      orgId: args.orgId,
      submissionId: args.submissionId,
      model: resolved.model,
      graderLabel: `${resolved.provider}:${resolved.modelId}`,
    });

    await db
      .update(sessionSubmissions)
      .set({ gradingStatus: "completed", gradingAttempt: attempt })
      .where(and(eq(sessionSubmissions.id, args.submissionId), eq(sessionSubmissions.orgId, args.orgId)));
    console.log(`[session-grading] DONE submission=${args.submissionId} attempt=${attempt}`);
  } catch (error) {
    await db
      .update(sessionSubmissions)
      .set({ gradingStatus: "retrying", gradingAttempt: attempt })
      .where(and(eq(sessionSubmissions.id, args.submissionId), eq(sessionSubmissions.orgId, args.orgId)));
    console.error(
      `[session-grading] RETRY submission=${args.submissionId} attempt=${attempt}`,
      error instanceof Error ? error.message : String(error)
    );
    throw new Error(`Session grading failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
gradeSessionSubmissionStep.maxRetries = 2;

async function registerSessionGradingRunStep(args: SessionGradingArgs, runId: string) {
  "use step";
  await db
    .update(sessionSubmissions)
    .set({ gradingStatus: "queued", gradingWorkflowRunId: runId, gradingAttempt: 0 })
    .where(and(eq(sessionSubmissions.id, args.submissionId), eq(sessionSubmissions.orgId, args.orgId)));
}

async function markSessionGradingFailedStep(args: SessionGradingArgs) {
  "use step";
  await db
    .update(sessionSubmissions)
    .set({ gradingStatus: "failed" })
    .where(and(eq(sessionSubmissions.id, args.submissionId), eq(sessionSubmissions.orgId, args.orgId)));
}

/** Manual submit returns immediately; this durable run owns draft grading. */
export async function sessionGradingWorkflow(args: SessionGradingArgs) {
  "use workflow";
  const { workflowRunId } = getWorkflowMetadata();
  try {
    await registerSessionGradingRunStep(args, workflowRunId);
    await gradeSessionSubmissionStep(args);
  } catch (error) {
    await markSessionGradingFailedStep(args);
    throw error;
  }
}

async function streamStudentAtlasTurnStep(args: StudentAtlasTurnArgs, runId: string) {
  "use step";
  try {
    const [session] = await db
      .select()
      .from(agentSessions)
      .where(and(eq(agentSessions.id, args.sessionId), eq(agentSessions.orgId, args.orgId), isNull(agentSessions.archivedAt)))
      .limit(1);
    if (!session || session.userId !== args.studentId || session.surface !== "personal") {
      throw new Error("Personal chat not found.");
    }
    const resolved = resolvePlatformModel();
    if (!resolved) throw new Error("Atlas's model runtime is not configured.");
    const [studentName, institutionName] = await Promise.all([
      studentDisplayName(args.orgId, args.studentId),
      loadInstitutionName(args.orgId),
    ]);

    await pipeResponseToWorkflow(await runStudentAtlasTurn({
      session,
      scope: { orgId: args.orgId, studentId: args.studentId },
      studentName,
      institutionName,
      model: resolved.model,
      userText: args.userText,
      userTurnPersisted: true,
    }));
  } finally {
    await db
      .update(agentSessions)
      .set({ activeRunId: null, activeRunStartedAt: null, updatedAt: new Date() })
      .where(and(eq(agentSessions.id, args.sessionId), eq(agentSessions.activeRunId, runId)));
  }
}
streamStudentAtlasTurnStep.maxRetries = 0;

export async function studentAtlasTurnWorkflow(args: StudentAtlasTurnArgs) {
  "use workflow";
  const { workflowRunId } = getWorkflowMetadata();
  await registerActiveRun(args.sessionId, args.runClaimId, workflowRunId);
  await streamStudentAtlasTurnStep(args, workflowRunId);
}

async function registerDeadlineRun(sessionId: string, claimId: string, runId: string) {
  "use step";
  if (!(await activateDeadlineRun(sessionId, claimId, runId))) {
    throw new Error("This deadline workflow no longer owns the session claim.");
  }
}

async function sessionHasActiveTurn(sessionId: string): Promise<boolean> {
  "use step";
  const [row] = await db
    .select({ activeRunId: agentSessions.activeRunId })
    .from(agentSessions)
    .where(eq(agentSessions.id, sessionId))
    .limit(1);
  return Boolean(row?.activeRunId);
}

async function concludeExpiredSessionStep(orgId: string, sessionId: string) {
  "use step";
  return concludeExpiredSession({ orgId, sessionId });
}

/** Server-owned timer: survives navigation, refreshes, and client disconnects. */
export async function sessionDeadlineWorkflow(args: { orgId: string; sessionId: string; deadlineAt: string; runClaimId: string }) {
  "use workflow";
  const { workflowRunId } = getWorkflowMetadata();
  await registerDeadlineRun(args.sessionId, args.runClaimId, workflowRunId);
  await sleep(new Date(args.deadlineAt));

  // Let a response that began before the deadline finish and reach the frozen
  // transcript. A stale failed run cannot hold submission forever.
  for (let attempt = 0; attempt < 60 && await sessionHasActiveTurn(args.sessionId); attempt += 1) {
    await sleep("2s");
  }

  const { submissionId } = await concludeExpiredSessionStep(args.orgId, args.sessionId);
  const gradingArgs = { orgId: args.orgId, submissionId };
  try {
    await registerSessionGradingRunStep(gradingArgs, workflowRunId);
    await gradeSessionSubmissionStep(gradingArgs);
  } catch (error) {
    await markSessionGradingFailedStep(gradingArgs);
    throw error;
  }
}
