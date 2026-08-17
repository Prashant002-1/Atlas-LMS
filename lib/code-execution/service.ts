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

  try {
    let result: RuntimeExecutionResult | null = null;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      workspace = await readyWorkspace(args.session, workspace, runtime, signal);
      try {
        result = await runtime.execute({ sessionId: workspace.providerSessionId!, input, abortSignal: signal });
        break;
      } catch (error) {
        if (attempt === 1 && isExpiredAgentCoreSessionError(error)) {
          await markWorkspaceTerminated(args.session, workspace.id);
          workspace = await ensureWorkspace(args.session);
          await db.update(codeExecutions).set({ attempt: 2, workspaceId: workspace.id, updatedAt: new Date() }).where(eq(codeExecutions.id, created.id));
          continue;
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
      await tx.update(codeExecutionWorkspaces).set({ lastUsedAt: finishedAt, updatedAt: finishedAt }).where(eq(codeExecutionWorkspaces.id, workspace.id));
    });
  } catch (error) {
    const callerCanceled = args.abortSignal?.aborted === true;
    const timedOut = timeoutController.signal.aborted && !callerCanceled;
    const status = callerCanceled ? "canceled" : timedOut ? "timed_out" : "failed";
    const message = safeErrorMessage(error);
    const finishedAt = new Date();
    if ((callerCanceled || timedOut) && workspace.providerSessionId) {
      try {
        await runtime.stopSession({
          sessionId: workspace.providerSessionId,
          abortSignal: AbortSignal.timeout(10_000),
        });
      } catch (cleanupError) {
        console.error("code execution workspace cleanup failed after cancellation", cleanupError);
      } finally {
        await markWorkspaceTerminated(args.session, workspace.id);
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
  const usable = workspace.status === "ready"
    && workspace.providerSessionId
    && workspace.expiresAt
    && workspace.expiresAt.getTime() > Date.now() + 5_000;
  if (usable) return workspace;

  const now = new Date();
  const [claimed] = await db.update(codeExecutionWorkspaces).set({ status: "starting", updatedAt: now }).where(and(
    eq(codeExecutionWorkspaces.id, workspace.id),
    eq(codeExecutionWorkspaces.orgId, session.orgId),
    eq(codeExecutionWorkspaces.userId, session.userId),
    or(
      ne(codeExecutionWorkspaces.status, "starting"),
      lt(codeExecutionWorkspaces.updatedAt, new Date(Date.now() - 30_000))
    ),
    or(isNull(codeExecutionWorkspaces.expiresAt), lt(codeExecutionWorkspaces.expiresAt, new Date(Date.now() + 5_000)), ne(codeExecutionWorkspaces.status, "ready"))
  )).returning();

  if (!claimed) {
    for (let count = 0; count < 20; count += 1) {
      await delay(250, abortSignal);
      workspace = await ensureWorkspace(session);
      if (workspace.status === "ready" && workspace.providerSessionId && workspace.expiresAt && workspace.expiresAt > new Date()) return workspace;
      if (workspace.status === "failed") break;
    }
    throw new Error("Another code execution is still starting this chat's sandbox. Try again.");
  }

  try {
    const timeoutSeconds = sessionTimeoutSeconds();
    const started = await runtime.startSession({
      name: `atlas-${workspace.id}`,
      clientToken: createHash("sha256").update(`${workspace.id}:${Date.now()}`).digest("hex"),
      timeoutSeconds,
      abortSignal,
    });
    const [updated] = await db.update(codeExecutionWorkspaces).set({
      providerSessionId: started.sessionId,
      status: "ready",
      expiresAt: started.expiresAt,
      terminatedAt: null,
      updatedAt: new Date(),
    }).where(and(
      eq(codeExecutionWorkspaces.id, workspace.id),
      eq(codeExecutionWorkspaces.orgId, session.orgId),
      eq(codeExecutionWorkspaces.userId, session.userId)
    )).returning();
    if (!updated) throw new Error("Atlas lost ownership of the code execution workspace.");
    return updated;
  } catch (error) {
    await db.update(codeExecutionWorkspaces).set({ status: "failed", updatedAt: new Date() }).where(eq(codeExecutionWorkspaces.id, workspace.id));
    throw error;
  }
}

async function markWorkspaceTerminated(session: AgentSession, workspaceId: string) {
  await db.update(codeExecutionWorkspaces).set({
    status: "terminated",
    providerSessionId: null,
    expiresAt: null,
    terminatedAt: new Date(),
    updatedAt: new Date(),
  }).where(and(
    eq(codeExecutionWorkspaces.id, workspaceId),
    eq(codeExecutionWorkspaces.orgId, session.orgId),
    eq(codeExecutionWorkspaces.userId, session.userId),
    eq(codeExecutionWorkspaces.agentSessionId, session.id)
  ));
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
  return Number.isInteger(configured) && configured >= 60 && configured <= 28_800
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
    const timeout = setTimeout(resolve, ms);
    abortSignal.addEventListener("abort", () => {
      clearTimeout(timeout);
      reject(abortSignal.reason);
    }, { once: true });
  });
}
