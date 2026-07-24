ALTER TABLE "course_ai_policies"
  DROP COLUMN IF EXISTS "student_daily_limit";

ALTER TABLE "session_assignments"
  DROP COLUMN IF EXISTS "transcript_policy",
  DROP COLUMN IF EXISTS "personal_record_side_notes";
