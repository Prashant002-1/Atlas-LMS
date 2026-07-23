-- Assessed assignment transcripts are always instructor-visible course records.
-- Personal Student Atlas conversations use separate personal/org sessions and
-- are not stored in session_submissions.

ALTER TABLE "session_assignments"
  DROP COLUMN IF EXISTS "transcript_policy";
