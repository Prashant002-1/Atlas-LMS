-- Instructor feedback on a submission: the reason beside the number.
--
-- A score and a comment are different records. The gradebook reads the score;
-- the student reads the comment. Keeping them in one column would have meant
-- either losing the comment on a regrade or parsing prose out of a number.
ALTER TABLE "submissions" ADD COLUMN IF NOT EXISTS "feedback" text;
ALTER TABLE "submissions" ADD COLUMN IF NOT EXISTS "feedback_at" timestamp with time zone;
ALTER TABLE "submissions" ADD COLUMN IF NOT EXISTS "feedback_by_id" uuid;

DO $$
BEGIN
  ALTER TABLE "submissions"
    ADD CONSTRAINT "submissions_feedback_by_id_users_id_fk"
    FOREIGN KEY ("feedback_by_id") REFERENCES "users"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
