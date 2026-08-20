ALTER TABLE "code_execution_workspaces"
  ADD COLUMN IF NOT EXISTS "active_execution_id" uuid;

ALTER TABLE "code_executions"
  ADD COLUMN IF NOT EXISTS "clear_context" boolean DEFAULT false NOT NULL;

CREATE INDEX IF NOT EXISTS "code_execution_workspaces_active_execution_idx"
  ON "code_execution_workspaces" ("active_execution_id");
