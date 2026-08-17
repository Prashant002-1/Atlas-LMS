import { sql } from "drizzle-orm";
import { check, customType, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { agentSessions, organizations, users } from "./schema";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

/** One lazy AgentCore workspace per active Atlas chat. */
export const codeExecutionWorkspaces = pgTable(
  "code_execution_workspaces",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    agentSessionId: uuid("agent_session_id").notNull().references(() => agentSessions.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().default("aws-agentcore"),
    providerResourceId: text("provider_resource_id").notNull(),
    providerSessionId: text("provider_session_id"),
    status: text("status").notNull().default("new"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    terminatedAt: timestamp("terminated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check("code_execution_workspaces_status_check", sql`${table.status} IN ('new', 'starting', 'ready', 'failed', 'terminated')`),
    uniqueIndex("code_execution_workspaces_session_idx").on(table.agentSessionId),
    index("code_execution_workspaces_owner_idx").on(table.orgId, table.userId, table.agentSessionId),
    index("code_execution_workspaces_expiry_idx").on(table.status, table.expiresAt),
  ]
);

/** Every tool call is a durable, idempotent execution record. */
export const codeExecutions = pgTable(
  "code_executions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    agentSessionId: uuid("agent_session_id").notNull().references(() => agentSessions.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id").notNull().references(() => codeExecutionWorkspaces.id, { onDelete: "cascade" }),
    idempotencyKey: text("idempotency_key").notNull(),
    workflowRunId: text("workflow_run_id"),
    language: text("language").notNull(),
    code: text("code").notNull(),
    codeSha256: text("code_sha256").notNull(),
    inputFiles: jsonb("input_files").notNull().default([]),
    outputFiles: jsonb("output_files").notNull().default([]),
    status: text("status").notNull().default("queued"),
    attempt: integer("attempt").notNull().default(1),
    stdout: text("stdout").notNull().default(""),
    stderr: text("stderr").notNull().default(""),
    exitCode: integer("exit_code"),
    durationMs: integer("duration_ms"),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check("code_executions_language_check", sql`${table.language} IN ('python', 'javascript', 'typescript')`),
    check("code_executions_status_check", sql`${table.status} IN ('queued', 'running', 'succeeded', 'failed', 'timed_out', 'canceled')`),
    check("code_executions_attempt_check", sql`${table.attempt} > 0`),
    uniqueIndex("code_executions_idempotency_idx").on(table.agentSessionId, table.idempotencyKey),
    index("code_executions_owner_idx").on(table.orgId, table.userId, table.agentSessionId, table.createdAt),
    index("code_executions_workspace_idx").on(table.workspaceId, table.createdAt),
    index("code_executions_workflow_idx").on(table.workflowRunId),
  ]
);

/** Declared output files copied out of the disposable sandbox for durable replay. */
export const codeExecutionArtifacts = pgTable(
  "code_execution_artifacts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    ownerUserId: uuid("owner_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    agentSessionId: uuid("agent_session_id").notNull().references(() => agentSessions.id, { onDelete: "cascade" }),
    executionId: uuid("execution_id").notNull().references(() => codeExecutions.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    filename: text("filename").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    checksumSha256: text("checksum_sha256").notNull(),
    bytes: bytea("bytes").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check("code_execution_artifacts_size_check", sql`${table.sizeBytes} >= 0 AND ${table.sizeBytes} <= 5000000`),
    uniqueIndex("code_execution_artifacts_execution_path_idx").on(table.executionId, table.path),
    index("code_execution_artifacts_owner_idx").on(table.orgId, table.ownerUserId, table.agentSessionId),
  ]
);
