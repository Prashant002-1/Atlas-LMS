ALTER TABLE "code_execution_workspaces"
  DROP CONSTRAINT IF EXISTS "code_execution_workspaces_status_check";

ALTER TABLE "code_execution_workspaces"
  ADD CONSTRAINT "code_execution_workspaces_status_check"
  CHECK ("status" IN ('new', 'starting', 'ready', 'busy', 'failed', 'terminated'));
