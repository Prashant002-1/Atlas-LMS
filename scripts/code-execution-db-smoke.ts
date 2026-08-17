import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../lib/db";
import { executeCodeForSession, stopCodeExecutionWorkspace } from "../lib/code-execution/service";
import type { CodeExecutionRuntime } from "../lib/code-execution/contracts";
import { codeExecutionArtifacts, codeExecutions, codeExecutionWorkspaces } from "../lib/db/code-execution-schema";
import { agentSessions, sessionSubmissions } from "../lib/db/schema";

class FakeRuntime implements CodeExecutionRuntime {
  starts = 0;
  executions = 0;
  stops = 0;
  activeExecutions = 0;
  maxActiveExecutions = 0;
  readonly slowExecutionStarted: Promise<void>;
  private readonly slowExecutionReleased: Promise<void>;
  readonly closeRaceExecutionStarted: Promise<void>;
  private readonly closeRaceExecutionReleased: Promise<void>;
  private resolveSlowExecutionStarted!: () => void;
  private resolveSlowExecutionReleased!: () => void;
  private resolveCloseRaceExecutionStarted!: () => void;
  private resolveCloseRaceExecutionReleased!: () => void;

  constructor() {
    this.slowExecutionStarted = new Promise((resolve) => {
      this.resolveSlowExecutionStarted = resolve;
    });
    this.slowExecutionReleased = new Promise((resolve) => {
      this.resolveSlowExecutionReleased = resolve;
    });
    this.closeRaceExecutionStarted = new Promise((resolve) => {
      this.resolveCloseRaceExecutionStarted = resolve;
    });
    this.closeRaceExecutionReleased = new Promise((resolve) => {
      this.resolveCloseRaceExecutionReleased = resolve;
    });
  }

  releaseSlowExecution() {
    this.resolveSlowExecutionReleased();
  }

  releaseCloseRaceExecution() {
    this.resolveCloseRaceExecutionReleased();
  }

  async startSession(args: { timeoutSeconds: number }) {
    this.starts += 1;
    return { sessionId: "local-smoke-session", expiresAt: new Date(Date.now() + args.timeoutSeconds * 1000) };
  }

  async execute(args: { input: { code: string }; abortSignal?: AbortSignal }) {
    this.executions += 1;
    this.activeExecutions += 1;
    this.maxActiveExecutions = Math.max(this.maxActiveExecutions, this.activeExecutions);
    try {
      if (args.input.code === "__provider_failure__") throw new Error("simulated provider failure");
      if (args.input.code === "__serialized__") {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (args.input.code === "__slow_success__") {
        this.resolveSlowExecutionStarted();
        await this.slowExecutionReleased;
      }
      if (args.input.code === "__close_race__") {
        this.resolveCloseRaceExecutionStarted();
        await this.closeRaceExecutionReleased;
      }
      if (args.input.code === "__wait__") {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(resolve, 10_000);
          args.abortSignal?.addEventListener("abort", () => {
            clearTimeout(timeout);
            reject(args.abortSignal?.reason);
          }, { once: true });
        });
      }
      return {
        stdout: "sum=16\n",
        stderr: "",
        exitCode: 0,
        durationMs: 12,
        isError: false,
        files: [{ path: "outputs/summary.csv", mediaType: "text/csv", bytes: new TextEncoder().encode("count,sum\n3,16\n") }],
      };
    } finally {
      this.activeExecutions -= 1;
    }
  }

  async getSession() {
    return { status: "ready" as const };
  }

  async stopSession() {
    this.stops += 1;
  }
}

async function main() {
  const [session] = await db
    .select({ session: agentSessions })
    .from(agentSessions)
    .leftJoin(codeExecutionWorkspaces, eq(codeExecutionWorkspaces.agentSessionId, agentSessions.id))
    .leftJoin(sessionSubmissions, eq(sessionSubmissions.sessionId, agentSessions.id))
    .where(and(
      eq(agentSessions.surface, "cue"),
      eq(agentSessions.anchorType, "assignment"),
      isNull(codeExecutionWorkspaces.id),
      isNull(sessionSubmissions.id)
    ))
    .limit(1);
  assert(session?.session, "Local fixtures need one assessed session without a code workspace.");
  assert(session.session.anchorId && session.session.courseId, "The assessed session needs its assignment and course anchors.");

  const runtime = new FakeRuntime();
  const priorTimeout = process.env.ATLAS_CODE_EXECUTION_TIMEOUT_MS;
  let insertedSubmissionId: string | null = null;
  try {
    const toolCallId = `local-smoke-${Date.now()}`;
    const first = await executeCodeForSession({
      session: session.session,
      toolCallId,
      input: {
        language: "python",
        code: "print(sum([3, 5, 8]))",
        inputFiles: [],
        outputFiles: ["outputs/summary.csv"],
        clearContext: true,
      },
      runtime,
    });
    const replay = await executeCodeForSession({
      session: session.session,
      toolCallId,
      input: {
        language: "python",
        code: "print(sum([3, 5, 8]))",
        inputFiles: [],
        outputFiles: ["outputs/summary.csv"],
        clearContext: true,
      },
      runtime,
    });
    assert.equal(first.status, "succeeded");
    assert.equal(first.stdout, "sum=16\n");
    assert.equal(first.files.length, 1);
    assert.equal(replay.status, "succeeded");
    assert.equal(replay.executionId, first.executionId);
    await assert.rejects(executeCodeForSession({
      session: session.session,
      toolCallId,
      input: {
        language: "python",
        code: "print('different input')",
        inputFiles: [],
        outputFiles: [],
        clearContext: true,
      },
      runtime,
    }), /idempotency key cannot be reused/);

    const [workspace] = await db.select().from(codeExecutionWorkspaces).where(and(
      eq(codeExecutionWorkspaces.orgId, session.session.orgId),
      eq(codeExecutionWorkspaces.agentSessionId, session.session.id)
    )).limit(1);
    assert(workspace);
    const [artifact] = await db.select().from(codeExecutionArtifacts).where(and(
      eq(codeExecutionArtifacts.id, first.files[0]!.id),
      eq(codeExecutionArtifacts.orgId, session.session.orgId),
      eq(codeExecutionArtifacts.ownerUserId, session.session.userId),
      eq(codeExecutionArtifacts.agentSessionId, session.session.id)
    )).limit(1);
    assert(artifact);
    assert.equal(new TextDecoder().decode(artifact.bytes), "count,sum\n3,16\n");
    assert.equal(runtime.starts, 1);
    assert.equal(runtime.executions, 1);

    const replayToolCallId = `local-replay-wait-${Date.now()}`;
    const replayInput = {
      language: "python" as const,
      code: "__serialized__",
      inputFiles: [],
      outputFiles: ["outputs/summary.csv"],
      clearContext: true,
    };
    const [replayOwner, replayWaiter] = await Promise.all([
      executeCodeForSession({
        session: session.session,
        toolCallId: replayToolCallId,
        input: replayInput,
        runtime,
      }),
      executeCodeForSession({
        session: session.session,
        toolCallId: replayToolCallId,
        input: replayInput,
        runtime,
      }),
    ]);
    assert.equal(replayOwner.status, "succeeded");
    assert.equal(replayWaiter.status, "succeeded");
    assert.equal(replayWaiter.executionId, replayOwner.executionId);
    assert.equal(runtime.executions, 2);

    const concurrentInputs = {
      language: "python" as const,
      code: "__serialized__",
      inputFiles: [],
      outputFiles: ["outputs/summary.csv"],
      clearContext: true,
    };
    const [concurrentFirst, concurrentSecond] = await Promise.all([
      executeCodeForSession({
        session: session.session,
        toolCallId: `local-concurrent-a-${Date.now()}`,
        input: concurrentInputs,
        runtime,
      }),
      executeCodeForSession({
        session: session.session,
        toolCallId: `local-concurrent-b-${Date.now()}`,
        input: concurrentInputs,
        runtime,
      }),
    ]);
    assert.equal(concurrentFirst.status, "succeeded");
    assert.equal(concurrentSecond.status, "succeeded");
    assert.equal(runtime.starts, 1);
    assert.equal(runtime.executions, 4);
    assert.equal(runtime.maxActiveExecutions, 1);

    const longRunning = executeCodeForSession({
      session: session.session,
      toolCallId: `local-long-running-${Date.now()}`,
      input: {
        language: "python",
        code: "__slow_success__",
        inputFiles: [],
        outputFiles: [],
        clearContext: true,
      },
      runtime,
    });
    await runtime.slowExecutionStarted;
    process.env.ATLAS_CODE_EXECUTION_TIMEOUT_MS = "1000";
    try {
      const waiting = await executeCodeForSession({
        session: session.session,
        toolCallId: `local-waiting-timeout-${Date.now()}`,
        input: {
          language: "python",
          code: "print('never entered')",
          inputFiles: [],
          outputFiles: [],
          clearContext: true,
        },
        runtime,
      });
      assert.equal(waiting.status, "timed_out");
      assert.equal(runtime.executions, 5);
      assert.equal(runtime.stops, 0);
    } finally {
      if (priorTimeout === undefined) delete process.env.ATLAS_CODE_EXECUTION_TIMEOUT_MS;
      else process.env.ATLAS_CODE_EXECUTION_TIMEOUT_MS = priorTimeout;
      runtime.releaseSlowExecution();
    }
    assert.equal((await longRunning).status, "succeeded");
    assert.equal(runtime.maxActiveExecutions, 1);

    const closingExecution = executeCodeForSession({
      session: session.session,
      toolCallId: `local-close-race-${Date.now()}`,
      input: {
        language: "python",
        code: "__close_race__",
        inputFiles: [],
        outputFiles: [],
        clearContext: true,
      },
      runtime,
    });
    await runtime.closeRaceExecutionStarted;
    await stopCodeExecutionWorkspace({
      orgId: session.session.orgId,
      sessionId: session.session.id,
      runtime,
    });
    runtime.releaseCloseRaceExecution();
    assert.equal((await closingExecution).status, "canceled");
    assert.equal(runtime.executions, 6);
    assert.equal(runtime.stops, 1);

    const staleToolCallId = `local-stale-replay-${Date.now()}`;
    const staleCode = "print('abandoned')";
    const staleAt = new Date(Date.now() - 120_000);
    const [staleExecution] = await db.insert(codeExecutions).values({
      orgId: session.session.orgId,
      userId: session.session.userId,
      agentSessionId: session.session.id,
      workspaceId: workspace.id,
      idempotencyKey: staleToolCallId,
      workflowRunId: session.session.activeRunId,
      language: "python",
      code: staleCode,
      codeSha256: createHash("sha256").update(staleCode).digest("hex"),
      inputFiles: [],
      outputFiles: [],
      clearContext: true,
      status: "running",
      startedAt: staleAt,
      createdAt: staleAt,
      updatedAt: staleAt,
    }).returning();
    assert(staleExecution);
    await db.update(codeExecutionWorkspaces).set({
      status: "busy",
      providerSessionId: "local-smoke-session",
      activeExecutionId: staleExecution.id,
      expiresAt: new Date(Date.now() + 60_000),
      updatedAt: staleAt,
    }).where(eq(codeExecutionWorkspaces.id, workspace.id));
    const recoveredStale = await executeCodeForSession({
      session: session.session,
      toolCallId: staleToolCallId,
      input: {
        language: "python",
        code: staleCode,
        inputFiles: [],
        outputFiles: [],
        clearContext: true,
      },
      runtime,
    });
    assert.equal(recoveredStale.status, "timed_out");
    assert.match(recoveredStale.stderr, /stopped before reporting a result/);
    assert.equal(runtime.executions, 6);
    assert.equal(runtime.stops, 2);

    const failed = await executeCodeForSession({
      session: session.session,
      toolCallId: `local-failure-${Date.now()}`,
      input: {
        language: "python",
        code: "__provider_failure__",
        inputFiles: [],
        outputFiles: [],
        clearContext: true,
      },
      runtime,
    });
    assert.equal(failed.status, "failed");
    assert.match(failed.stderr, /simulated provider failure/);

    process.env.ATLAS_CODE_EXECUTION_TIMEOUT_MS = "1000";
    const timedOut = await executeCodeForSession({
      session: session.session,
      toolCallId: `local-timeout-${Date.now()}`,
      input: {
        language: "python",
        code: "__wait__",
        inputFiles: [],
        outputFiles: [],
        clearContext: true,
      },
      runtime,
    });
    assert.equal(timedOut.status, "timed_out");
    assert.equal(runtime.executions, 8);
    assert.equal(runtime.stops, 3);

    await stopCodeExecutionWorkspace({ orgId: session.session.orgId, sessionId: session.session.id, runtime });
    assert.equal(runtime.stops, 3);

    const [insertedSubmission] = await db.insert(sessionSubmissions).values({
      orgId: session.session.orgId,
      sessionId: session.session.id,
      assignmentId: session.session.anchorId,
      courseId: session.session.courseId,
      userId: session.session.userId,
      transcript: [],
      turnCount: 0,
      gradingStatus: "pending",
    }).returning({ id: sessionSubmissions.id });
    assert(insertedSubmission);
    insertedSubmissionId = insertedSubmission.id;
    const submittedReplay = await executeCodeForSession({
      session: session.session,
      toolCallId,
      input: {
        language: "python",
        code: "print(sum([3, 5, 8]))",
        inputFiles: [],
        outputFiles: ["outputs/summary.csv"],
        clearContext: true,
      },
      runtime,
    });
    assert.equal(submittedReplay.status, "succeeded");
    assert.equal(submittedReplay.executionId, first.executionId);
    await assert.rejects(executeCodeForSession({
      session: session.session,
      toolCallId: `local-after-submit-${Date.now()}`,
      input: {
        language: "python",
        code: "print('must not run')",
        inputFiles: [],
        outputFiles: [],
        clearContext: true,
      },
      runtime,
    }), /already been submitted/);
    assert.equal(runtime.starts, 2);
    assert.equal(runtime.executions, 8);
    assert.equal(runtime.stops, 3);
    console.log("Local code-execution persistence, ownership, strict idempotency, replay waiting and recovery, serialization, wait isolation, submission-close authority, terminal replay and new-work refusal after submission, artifact, provider-failure, timeout, and cleanup paths passed.");
  } finally {
    if (priorTimeout === undefined) delete process.env.ATLAS_CODE_EXECUTION_TIMEOUT_MS;
    else process.env.ATLAS_CODE_EXECUTION_TIMEOUT_MS = priorTimeout;
    if (insertedSubmissionId) {
      await db.delete(sessionSubmissions).where(eq(sessionSubmissions.id, insertedSubmissionId));
    }
    await db.delete(codeExecutionWorkspaces).where(and(
      eq(codeExecutionWorkspaces.orgId, session.session.orgId),
      eq(codeExecutionWorkspaces.userId, session.session.userId),
      eq(codeExecutionWorkspaces.agentSessionId, session.session.id)
    ));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
