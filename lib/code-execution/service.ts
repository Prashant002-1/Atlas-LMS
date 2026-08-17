import { createHash } from "node:crypto";
import { and, eq, isNull, lt, ne, or } from "drizzle-orm";
import type { AgentSession } from "@/lib/db/schema";
import { db } from "@/lib/db";
import {
  codeExecutionArtifacts,
  codeExecutions,
  codeExecutionWorkspaces,
} from "@/lib/db/code-execution-schema";
import {
  DEFAULT_EXECUTION_TIMEOUT_MS,
  DEFAULT_SESSION_TIMEOUT_SECONDS,
  executeCodeInputSchema,
  type CodeExecutionRuntime,
  type ExecuteCodeInput,
  type ExecuteCodeOutput,
  type RuntimeExecutionResult,
} from "@/lib/code-execution/contracts";
import {
  AgentCoreCodeExecutionRuntime,
  DEFAULT_AGENTCORE_INTERPRETER_ID,
  isExpiredAgentCoreSessionError,
} from "@/lib/code-execution/agentcore";

type Workspace = typeof codeExecutionWorkspaces.$inferSelect;
type Execution = typeof codeExecutions.$inferSelect;

export function codeExecutionEnabled(): boolean {
  return process.env.ATLAS_CODE_EXECUTION_ENABLED?.toLowerCase() !== "false";
}

export async function executeCodeForSession(args: {
  session: AgentSession;
  toolCallId: string;
  input: ExecuteCodeInput;
  abortSignal?: AbortSignal;
  runtime?: CodeExecutionRuntime;
}): Promise<ExecuteCodeOutput> {
  if (!codeExecutionEnabled()) throw new Error("Code execution is disabled by school policy.");
  if (args.session.surface !== "cue" || args.session.anchorType !== "assignment" || !args.session.courseId) {
    throw new Error("Code execution is only enabled for assessed AI-assignment sessions.");
  }
  const input = executeCodeInputSchema.parse(args.input);
  const runtime = args.runtime ?? new AgentCoreCodeExecutionRuntime();
  let workspace = await ensureWorkspace(args.session);

  const existing = await loadExecutionByIdempotency(args.session, args.toolCallId);
  if (existing) return executionOutput(existing, await listArtifacts(args.session, existing.id));

  const inputFiles = input.inputFiles.map((file) => ({
    path: file.path,
    sizeBytes: Buffer.byteLength(file.content, "utf8"),
    checksumSha256: createHash("sha256").update(file.content).digest("hex"),
  }));
  const [created] = await db
    .insert(codeExecutions)
    .values({
      orgId: args.session.orgId,
      userId: args.session.userId,
      agentSessionId: args.session.id,
      workspaceId: workspace.id,
      idempotencyKey: args.toolCallId,
      workflowRunId: args.session.activeRunId,
      language: input.language,
      code: input.code,
      codeSha256: createHash("sha256").update(input.code).digest("hex"),
      inputFiles,
      outputFiles: input.outputFiles,
    })
    .onConflictDoNothing({ target: [codeExecutions.agentSessionId, codeExecutions.idempotencyKey] })
    .returning();
  if (!created) {
    const raced = await loadExecutionByIdempotency(args.session, args.toolCallId);
    if (!raced) throw new Error("Atlas could not recover the idempotent execution record.");
    return executionOutput(raced, await listArtifacts(args.session, raced.id));
  }

  const startedAt = new Date();
  await db.update(codeExecutions).set({ status: "running", startedAt, updatedAt: startedAt }).where(
    and(
      eq(codeExecutions.id, created.id),
      eq(codeExecutions.orgId, args.session.orgId),
      eq(codeExecutions.userId, args.session.userId),
      eq(codeExecutions.agentSessionId, args.session.id)
    )
  );

  const timeoutController = new AbortController();
  const timeout = setTimeout(() => timeoutController.abort(new Error("Code execution timed out.")), executionTimeoutMs());
  const signal = args.abortSignal
    ? AbortSignal.any([args.abortSignal, timeoutController.signal])
    : timeoutController.signal;
  let ownsWorkspaceLease = false;
  let leasedProviderSessionId: string | null = null;

  try {
    let result: RuntimeExecutionResult | null = null;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      workspace = await readyWorkspace(args.session, workspace, runtime, signal);
      workspace = await claimWorkspaceExecution(args.session, workspace, runtime, signal);
      ownsWorkspaceLease = true;
      leasedProviderSessionId = workspace.providerSessionId;
      try {
        result = await runtime.execute({ sessionId: workspace.providerSessionId!, input, abortSignal: signal });
        await releaseWorkspaceExecution(args.session, workspace);
        ownsWorkspaceLease = false;
        leasedProviderSessionId = null;
        break;
      } catch (error) {
        if (attempt === 1 && isExpiredAgentCoreSessionError(error)) {
          await markWorkspaceTerminated(args.session, workspace.id, leasedProviderSessionId);
          ownsWorkspaceLease = false;
          leasedProviderSessionId = null;
          workspace = await ensureWorkspace(args.session);
          await db.update(codeExecutions).set({ attempt: 2, workspaceId: workspace.id, updatedAt: new Date() }).where(eq(codeExecutions.id, created.id));
          continue;
        }
        if (!signal.aborted) {
          await releaseWorkspaceExecution(args.session, workspace);
          ownsWorkspaceLease = false;
          leasedProviderSessionId = null;
        }
        throw error;
      }
    }
    if (!result) throw new Error("AgentCore returned no execution result.");

    const status = result.isError ? "failed" : "succeeded";
    const finishedAt = new Date();
    await db.transaction(async (tx) => {
      await tx.update(codeExecutions).set({
        status,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        durationMs: result.durationMs === null ? null : Math.round(result.durationMs),
        error: result.isError ? result.stderr || "The code exited with an error." : null,
        finishedAt,
        updatedAt: finishedAt,
      }).where(eq(codeExecutions.id, created.id));
      if (result.files.length > 0) {
        await tx.insert(codeExecutionArtifacts).values(result.files.map((file) => ({
          orgId: args.session.orgId,
          ownerUserId: args.session.userId,
          agentSessionId: args.session.id,
          executionId: created.id,
          path: file.path,
          filename: file.path.split("/").at(-1) ?? "output",
          contentType: file.mediaType,
          sizeBytes: file.bytes.byteLength,
          checksumSha256: createHash("sha256").update(file.bytes).digest("hex"),
          bytes: Buffer.from(file.bytes),
        }))).onConflictDoNothing({ target: [codeExecutionArtifacts.executionId, codeExecutionArtifacts.path] });
      }
    });
  } catch (error) {
    const callerCanceled = args.abortSignal?.aborted === true;
    const timedOut = timeoutController.signal.aborted && !callerCanceled;
    const status = callerCanceled ? "canceled" : timedOut ? "timed_out" : "failed";
    const message = safeErrorMessage(error);
    const finishedAt = new Date();
    if ((callerCanceled || timedOut) && ownsWorkspaceLease && leasedProviderSessionId) {
      try {
        await runtime.stopSession({
          sessionId: leasedProviderSessionId,
          abortSignal: AbortSignal.timeout(10_000),
        });
      } catch (cleanupError) {
        console.error("code execution workspace cleanup failed after cancellation", cleanupError);
      } finally {
        await markWorkspaceTerminated(args.session, workspace.id, leasedProviderSessionId);
        ownsWorkspaceLease = false;
        leasedProviderSessionId = null;
      }
    }
    await db.update(codeExecutions).set({
      status,
      error: message,
      stderr: message,
      finishedAt,
      updatedAt: finishedAt,
    }).where(eq(codeExecutions.id, created.id));
  } finally {
    clearTimeout(timeout);
  }

  const completed = await loadExecutionById(args.session, created.id);
  if (!completed) throw new Error("Atlas could not reload the completed execution record.");
  return executionOutput(completed, await listArtifacts(args.session, completed.id));
}

export async function stopCodeExecutionWorkspace(args: {
  orgId: string;
  sessionId: string;
  runtime?: CodeExecutionRuntime;
}): Promise<void> {
  const [workspace] = await db.select().from(codeExecutionWorkspaces).where(and(
    eq(codeExecutionWorkspaces.orgId, args.orgId),
    eq(codeExecutionWorkspaces.agentSessionId, args.sessionId)
  )).limit(1);
  if (!workspace?.providerSessionId || workspace.status === "terminated") return;
  const runtime = args.runtime ?? new AgentCoreCodeExecutionRuntime();
  try {
    await runtime.stopSession({
      sessionId: workspace.providerSessionId,
      abortSignal: AbortSignal.timeout(10_000),
    });
  } finally {
    await db.update(codeExecutionWorkspaces).set({
      status: "terminated",
      providerSessionId: null,
      expiresAt: null,
      terminatedAt: new Date(),
      updatedAt: new Date(),
    }).where(and(
      eq(codeExecutionWorkspaces.id, workspace.id),
      eq(codeExecutionWorkspaces.orgId, args.orgId),
      eq(codeExecutionWorkspaces.agentSessionId, args.sessionId)
    ));
  }
}

async function ensureWorkspace(session: AgentSession): Promise<Workspace> {
  await db.insert(codeExecutionWorkspaces).values({
    orgId: session.orgId,
    userId: session.userId,
    agentSessionId: session.id,
    providerResourceId: process.env.ATLAS_CODE_INTERPRETER_ID ?? DEFAULT_AGENTCORE_INTERPRETER_ID,
  }).onConflictDoNothing({ target: codeExecutionWorkspaces.agentSessionId });
  const [workspace] = await db.select().from(codeExecutionWorkspaces).where(and(
    eq(codeExecutionWorkspaces.orgId, session.orgId),
    eq(codeExecutionWorkspaces.userId, session.userId),
    eq(codeExecutionWorkspaces.agentSessionId, session.id)
  )).limit(1);
  if (!workspace) throw new Error("Atlas could not establish a code execution workspace.");
  return workspace;
}

async function readyWorkspace(
  session: AgentSession,
  initial: Workspace,
  runtime: CodeExecutionRuntime,
  abortSignal: AbortSignal
): Promise<Workspace> {
  let workspace = initial;
  const waitDeadline = Date.now() + Math.min(executionTimeoutMs(), 30_000);

  while (true) {
    if (hasUsableReadySession(workspace) || workspace.status === "busy") return workspace;

    const claimTime = new Date();
    const minimumExpiry = new Date(Date.now() + executionTimeoutMs() + 5_000);
    const [claimed] = await db.update(codeExecutionWorkspaces).set({
      status: "starting",
      updatedAt: claimTime,
    }).where(and(
      eq(codeExecutionWorkspaces.id, workspace.id),
      eq(codeExecutionWorkspaces.orgId, session.orgId),
      eq(codeExecutionWorkspaces.userId, session.userId),
      eq(codeExecutionWorkspaces.agentSessionId, session.id),
      ne(codeExecutionWorkspaces.status, "busy"),
      or(
        and(
          ne(codeExecutionWorkspaces.status, "starting"),
          or(
            ne(codeExecutionWorkspaces.status, "ready"),
            isNull(codeExecutionWorkspaces.providerSessionId),
            isNull(codeExecutionWorkspaces.expiresAt),
            lt(codeExecutionWorkspaces.expiresAt, minimumExpiry)
          )
        ),
        and(
          eq(codeExecutionWorkspaces.status, "starting"),
          lt(codeExecutionWorkspaces.updatedAt, new Date(Date.now() - 30_000))
        )
      )
    )).returning();

    if (claimed) return startWorkspaceSession(session, claimed, runtime, abortSignal);
    if (Date.now() >= waitDeadline) {
      throw new Error("Another code execution is still starting this chat's sandbox. Try again.");
    }
    await delay(250, abortSignal);
    workspace = await ensureWorkspace(session);
  }
}

async function startWorkspaceSession(
  session: AgentSession,
  workspace: Workspace,
  runtime: CodeExecutionRuntime,
  abortSignal: AbortSignal
): Promise<Workspace> {
  const claimTime = workspace.updatedAt;
  let startedSessionId: string | null = null;
  try {
    if (workspace.providerSessionId) {
      try {
        await runtime.stopSession({
          sessionId: workspace.providerSessionId,
          abortSignal: AbortSignal.timeout(10_000),
        });
      } catch (error) {
        if (!isExpiredAgentCoreSessionError(error)) throw error;
      }
    }

    const timeoutSeconds = sessionTimeoutSeconds();
    const started = await runtime.startSession({
      name: `atlas-${workspace.id}`,
      clientToken: createHash("sha256").update(`${workspace.id}:${claimTime.getTime()}`).digest("hex"),
      timeoutSeconds,
      abortSignal,
    });
    startedSessionId = started.sessionId;
    const [updated] = await db.update(codeExecutionWorkspaces).set({
      providerSessionId: started.sessionId,
      status: "ready",
      expiresAt: started.expiresAt,
      terminatedAt: null,
      updatedAt: new Date(),
    }).where(and(
      eq(codeExecutionWorkspaces.id, workspace.id),
      eq(codeExecutionWorkspaces.orgId, session.orgId),
      eq(codeExecutionWorkspaces.userId, session.userId),
      eq(codeExecutionWorkspaces.agentSessionId, session.id),
      eq(codeExecutionWorkspaces.status, "starting"),
      eq(codeExecutionWorkspaces.updatedAt, claimTime)
    )).returning();
    if (!updated) {
      await runtime.stopSession({
        sessionId: started.sessionId,
        abortSignal: AbortSignal.timeout(10_000),
      });
      startedSessionId = null;
      throw new Error("Atlas lost ownership of the code execution workspace.");
    }
    return updated;
  } catch (error) {
    if (startedSessionId) {
      try {
        await runtime.stopSession({
          sessionId: startedSessionId,
          abortSignal: AbortSignal.timeout(10_000),
        });
      } catch (cleanupError) {
        console.error("code execution workspace cleanup failed after startup", cleanupError);
      }
    }
    await db.update(codeExecutionWorkspaces).set({ status: "failed", updatedAt: new Date() }).where(and(
      eq(codeExecutionWorkspaces.id, workspace.id),
      eq(codeExecutionWorkspaces.orgId, session.orgId),
      eq(codeExecutionWorkspaces.userId, session.userId),
      eq(codeExecutionWorkspaces.agentSessionId, session.id),
      eq(codeExecutionWorkspaces.status, "starting"),
      eq(codeExecutionWorkspaces.updatedAt, claimTime)
    ));
    throw error;
  }
}

async function claimWorkspaceExecution(
  session: AgentSession,
  initial: Workspace,
  runtime: CodeExecutionRuntime,
  abortSignal: AbortSignal
): Promise<Workspace> {
  let workspace = initial;

  while (true) {
    if (workspace.status === "ready") {
      if (!hasUsableReadySession(workspace)) {
        workspace = await readyWorkspace(session, workspace, runtime, abortSignal);
        continue;
      }
      const [claimed] = await db.update(codeExecutionWorkspaces).set({
        status: "busy",
        updatedAt: new Date(),
      }).where(and(
        eq(codeExecutionWorkspaces.id, workspace.id),
        eq(codeExecutionWorkspaces.orgId, session.orgId),
        eq(codeExecutionWorkspaces.userId, session.userId),
        eq(codeExecutionWorkspaces.agentSessionId, session.id),
        eq(codeExecutionWorkspaces.status, "ready"),
        eq(codeExecutionWorkspaces.providerSessionId, workspace.providerSessionId!),
        eq(codeExecutionWorkspaces.updatedAt, workspace.updatedAt)
      )).returning();
      if (claimed) return claimed;
    } else if (workspace.status === "busy") {
      const expired = !workspace.providerSessionId
        || !workspace.expiresAt
        || workspace.expiresAt.getTime() <= Date.now();
      const stale = workspace.updatedAt.getTime() <= Date.now() - executionTimeoutMs() - 15_000;
      if (expired || stale) {
        const recoveryTime = new Date();
        const [recovery] = await db.update(codeExecutionWorkspaces).set({
          status: "starting",
          updatedAt: recoveryTime,
        }).where(and(
          eq(codeExecutionWorkspaces.id, workspace.id),
          eq(codeExecutionWorkspaces.orgId, session.orgId),
          eq(codeExecutionWorkspaces.userId, session.userId),
          eq(codeExecutionWorkspaces.agentSessionId, session.id),
          eq(codeExecutionWorkspaces.status, "busy"),
          eq(codeExecutionWorkspaces.updatedAt, workspace.updatedAt)
        )).returning();
        if (recovery) {
          if (recovery.providerSessionId) {
            try {
              await runtime.stopSession({
                sessionId: recovery.providerSessionId,
                abortSignal: AbortSignal.timeout(10_000),
              });
            } catch (error) {
              if (!isExpiredAgentCoreSessionError(error)) {
                await db.update(codeExecutionWorkspaces).set({ status: "failed", updatedAt: new Date() }).where(and(
                  eq(codeExecutionWorkspaces.id, recovery.id),
                  eq(codeExecutionWorkspaces.orgId, session.orgId),
                  eq(codeExecutionWorkspaces.userId, session.userId),
                  eq(codeExecutionWorkspaces.agentSessionId, session.id),
                  eq(codeExecutionWorkspaces.status, "starting"),
                  eq(codeExecutionWorkspaces.updatedAt, recoveryTime)
                ));
                throw error;
              }
            }
          }
          await markWorkspaceTerminated(session, recovery.id, recovery.providerSessionId, recoveryTime);
          workspace = await ensureWorkspace(session);
          workspace = await readyWorkspace(session, workspace, runtime, abortSignal);
          continue;
        }
      }
    } else {
      workspace = await readyWorkspace(session, workspace, runtime, abortSignal);
      continue;
    }

    await delay(250, abortSignal);
    workspace = await ensureWorkspace(session);
  }
}

async function releaseWorkspaceExecution(session: AgentSession, workspace: Workspace) {
  if (!workspace.providerSessionId) return;
  const now = new Date();
  await db.update(codeExecutionWorkspaces).set({
    status: "ready",
    lastUsedAt: now,
    updatedAt: now,
  }).where(and(
    eq(codeExecutionWorkspaces.id, workspace.id),
    eq(codeExecutionWorkspaces.orgId, session.orgId),
    eq(codeExecutionWorkspaces.userId, session.userId),
    eq(codeExecutionWorkspaces.agentSessionId, session.id),
    eq(codeExecutionWorkspaces.status, "busy"),
    eq(codeExecutionWorkspaces.providerSessionId, workspace.providerSessionId),
    eq(codeExecutionWorkspaces.updatedAt, workspace.updatedAt)
  ));
}

function hasUsableReadySession(workspace: Workspace) {
  return workspace.status === "ready"
    && Boolean(workspace.providerSessionId)
    && Boolean(workspace.expiresAt)
    && workspace.expiresAt!.getTime() > Date.now() + executionTimeoutMs() + 5_000;
}

async function markWorkspaceTerminated(
  session: AgentSession,
  workspaceId: string,
  expectedProviderSessionId?: string | null,
  expectedUpdatedAt?: Date
) {
  const predicates = [
    eq(codeExecutionWorkspaces.id, workspaceId),
    eq(codeExecutionWorkspaces.orgId, session.orgId),
    eq(codeExecutionWorkspaces.userId, session.userId),
    eq(codeExecutionWorkspaces.agentSessionId, session.id),
  ];
  if (expectedProviderSessionId) {
    predicates.push(eq(codeExecutionWorkspaces.providerSessionId, expectedProviderSessionId));
  }
  if (expectedUpdatedAt) {
    predicates.push(eq(codeExecutionWorkspaces.updatedAt, expectedUpdatedAt));
  }
  await db.update(codeExecutionWorkspaces).set({
    status: "terminated",
    providerSessionId: null,
    expiresAt: null,
    terminatedAt: new Date(),
    updatedAt: new Date(),
  }).where(and(...predicates));
}

async function loadExecutionByIdempotency(session: AgentSession, key: string) {
  const [row] = await db.select().from(codeExecutions).where(and(
    eq(codeExecutions.orgId, session.orgId),
    eq(codeExecutions.userId, session.userId),
    eq(codeExecutions.agentSessionId, session.id),
    eq(codeExecutions.idempotencyKey, key)
  )).limit(1);
  return row ?? null;
}

async function loadExecutionById(session: AgentSession, executionId: string) {
  const [row] = await db.select().from(codeExecutions).where(and(
    eq(codeExecutions.id, executionId),
    eq(codeExecutions.orgId, session.orgId),
    eq(codeExecutions.userId, session.userId),
    eq(codeExecutions.agentSessionId, session.id)
  )).limit(1);
  return row ?? null;
}

async function listArtifacts(session: AgentSession, executionId: string) {
  return db.select({
    id: codeExecutionArtifacts.id,
    filename: codeExecutionArtifacts.filename,
    contentType: codeExecutionArtifacts.contentType,
    sizeBytes: codeExecutionArtifacts.sizeBytes,
  }).from(codeExecutionArtifacts).where(and(
    eq(codeExecutionArtifacts.orgId, session.orgId),
    eq(codeExecutionArtifacts.ownerUserId, session.userId),
    eq(codeExecutionArtifacts.agentSessionId, session.id),
    eq(codeExecutionArtifacts.executionId, executionId)
  ));
}

function executionOutput(execution: Execution, artifacts: Awaited<ReturnType<typeof listArtifacts>>): ExecuteCodeOutput {
  const status = execution.status === "queued" ? "running" : execution.status as ExecuteCodeOutput["status"];
  return {
    ok: status === "succeeded",
    executionId: execution.id,
    status,
    title: execution.language === "python" ? "Python" : execution.language === "typescript" ? "TypeScript" : "JavaScript",
    command: execution.code,
    stdout: execution.stdout,
    stderr: execution.stderr,
    exitCode: execution.exitCode,
    durationMs: execution.durationMs,
    files: artifacts.map((artifact) => ({
      id: artifact.id,
      url: `/code-execution/artifacts/${artifact.id}/${encodeURIComponent(artifact.filename)}`,
      mediaType: artifact.contentType,
      filename: artifact.filename,
      sizeBytes: artifact.sizeBytes,
    })),
    ...(execution.error ? { error: execution.error } : {}),
  };
}

function sessionTimeoutSeconds() {
  const configured = Number(process.env.ATLAS_CODE_EXECUTION_SESSION_TIMEOUT_SECONDS ?? DEFAULT_SESSION_TIMEOUT_SECONDS);
  return Number.isInteger(configured)
    && configured >= 60
    && configured <= 28_800
    && configured * 1_000 > executionTimeoutMs() + 5_000
    ? configured
    : DEFAULT_SESSION_TIMEOUT_SECONDS;
}

function executionTimeoutMs() {
  const configured = Number(process.env.ATLAS_CODE_EXECUTION_TIMEOUT_MS ?? DEFAULT_EXECUTION_TIMEOUT_MS);
  return Number.isInteger(configured) && configured >= 1_000 && configured <= 110_000
    ? configured
    : DEFAULT_EXECUTION_TIMEOUT_MS;
}

function safeErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message.trim().slice(0, 2_000);
  return "AgentCore could not complete the code execution.";
}

function delay(ms: number, abortSignal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (abortSignal.aborted) {
      reject(abortSignal.reason);
      return;
    }
    const onAbort = () => {
      clearTimeout(timeout);
      reject(abortSignal.reason);
    };
    const timeout = setTimeout(() => {
      abortSignal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    abortSignal.addEventListener("abort", onAbort, { once: true });
  });
}
