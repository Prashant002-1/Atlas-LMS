ALTER TABLE "code_executions"
  ADD COLUMN IF NOT EXISTS "workflow_run_id" text;

CREATE INDEX IF NOT EXISTS "code_executions_workflow_idx"
  ON "code_executions" ("workflow_run_id");
