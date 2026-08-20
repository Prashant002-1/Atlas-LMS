CREATE TABLE IF NOT EXISTS "code_execution_workspaces" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "agent_session_id" uuid NOT NULL REFERENCES "agent_sessions"("id") ON DELETE CASCADE,
  "provider" text DEFAULT 'aws-agentcore' NOT NULL,
  "provider_resource_id" text NOT NULL,
  "provider_session_id" text,
  "status" text DEFAULT 'new' NOT NULL,
  "expires_at" timestamp with time zone,
  "last_used_at" timestamp with time zone,
  "terminated_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "code_execution_workspaces_status_check" CHECK ("status" IN ('new', 'starting', 'ready', 'failed', 'terminated'))
);
CREATE UNIQUE INDEX IF NOT EXISTS "code_execution_workspaces_session_idx" ON "code_execution_workspaces" ("agent_session_id");
CREATE INDEX IF NOT EXISTS "code_execution_workspaces_owner_idx" ON "code_execution_workspaces" ("org_id", "user_id", "agent_session_id");
CREATE INDEX IF NOT EXISTS "code_execution_workspaces_expiry_idx" ON "code_execution_workspaces" ("status", "expires_at");

CREATE TABLE IF NOT EXISTS "code_executions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "agent_session_id" uuid NOT NULL REFERENCES "agent_sessions"("id") ON DELETE CASCADE,
  "workspace_id" uuid NOT NULL REFERENCES "code_execution_workspaces"("id") ON DELETE CASCADE,
  "idempotency_key" text NOT NULL,
  "language" text NOT NULL,
  "code" text NOT NULL,
  "code_sha256" text NOT NULL,
  "input_files" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "output_files" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "status" text DEFAULT 'queued' NOT NULL,
  "attempt" integer DEFAULT 1 NOT NULL,
  "stdout" text DEFAULT '' NOT NULL,
  "stderr" text DEFAULT '' NOT NULL,
  "exit_code" integer,
  "duration_ms" integer,
  "error" text,
  "started_at" timestamp with time zone,
  "finished_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "code_executions_language_check" CHECK ("language" IN ('python', 'javascript', 'typescript')),
  CONSTRAINT "code_executions_status_check" CHECK ("status" IN ('queued', 'running', 'succeeded', 'failed', 'timed_out', 'canceled')),
  CONSTRAINT "code_executions_attempt_check" CHECK ("attempt" > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS "code_executions_idempotency_idx" ON "code_executions" ("agent_session_id", "idempotency_key");
CREATE INDEX IF NOT EXISTS "code_executions_owner_idx" ON "code_executions" ("org_id", "user_id", "agent_session_id", "created_at");
CREATE INDEX IF NOT EXISTS "code_executions_workspace_idx" ON "code_executions" ("workspace_id", "created_at");

CREATE TABLE IF NOT EXISTS "code_execution_artifacts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "owner_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "agent_session_id" uuid NOT NULL REFERENCES "agent_sessions"("id") ON DELETE CASCADE,
  "execution_id" uuid NOT NULL REFERENCES "code_executions"("id") ON DELETE CASCADE,
  "path" text NOT NULL,
  "filename" text NOT NULL,
  "content_type" text NOT NULL,
  "size_bytes" integer NOT NULL,
  "checksum_sha256" text NOT NULL,
  "bytes" bytea NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "code_execution_artifacts_size_check" CHECK ("size_bytes" >= 0 AND "size_bytes" <= 5000000)
);
CREATE UNIQUE INDEX IF NOT EXISTS "code_execution_artifacts_execution_path_idx" ON "code_execution_artifacts" ("execution_id", "path");
CREATE INDEX IF NOT EXISTS "code_execution_artifacts_owner_idx" ON "code_execution_artifacts" ("org_id", "owner_user_id", "agent_session_id");
