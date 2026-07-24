DO $$ BEGIN
  CREATE TYPE "session_grading_status" AS ENUM (
    'pending',
    'queued',
    'running',
    'retrying',
    'completed',
    'failed'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "session_submissions"
  ADD COLUMN IF NOT EXISTS "grading_status" "session_grading_status" NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS "grading_workflow_run_id" text,
  ADD COLUMN IF NOT EXISTS "grading_attempt" integer NOT NULL DEFAULT 0;

UPDATE "session_submissions" AS submission
SET
  "grading_status" = 'completed',
  "grading_attempt" = GREATEST("grading_attempt", 1)
WHERE EXISTS (
  SELECT 1
  FROM "journey_reports" AS report
  WHERE report."submission_id" = submission."id"
);
