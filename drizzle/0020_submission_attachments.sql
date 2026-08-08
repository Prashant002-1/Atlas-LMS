-- Student uploads are private files attached to one durable assignment
-- submission. They do not enter the course material library, and the composite
-- submission foreign key keeps the file on the same student record.

ALTER TABLE "document_attachments"
  ADD COLUMN IF NOT EXISTS "submission_assignment_id" uuid,
  ADD COLUMN IF NOT EXISTS "submission_user_id" uuid;

ALTER TABLE "document_attachments"
  DROP CONSTRAINT IF EXISTS "document_attachments_one_owner_check",
  DROP CONSTRAINT IF EXISTS "document_attachments_private_thread_check";

ALTER TABLE "document_attachments"
  ADD CONSTRAINT "document_attachments_one_owner_check"
    CHECK (
      num_nonnulls("submission_assignment_id", "submission_user_id") IN (0, 2)
      AND num_nonnulls("course_material_id", "syllabus_course_id", "assignment_id", "agent_session_id")
        + CASE WHEN "submission_assignment_id" IS NULL THEN 0 ELSE 1 END = 1
    ),
  ADD CONSTRAINT "document_attachments_private_thread_check"
    CHECK (
      "owner_user_id" IS NULL OR (
        "course_id" IS NULL
        AND "course_material_id" IS NULL
        AND "syllabus_course_id" IS NULL
        AND "assignment_id" IS NULL
        AND (
          (
            "agent_session_id" IS NOT NULL
            AND "submission_assignment_id" IS NULL
            AND "submission_user_id" IS NULL
          )
          OR (
            "agent_session_id" IS NULL
            AND "submission_assignment_id" IS NOT NULL
            AND "submission_user_id" = "owner_user_id"
          )
        )
      )
    );

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'document_attachments_submission_fk') THEN
    ALTER TABLE "document_attachments"
      ADD CONSTRAINT "document_attachments_submission_fk"
      FOREIGN KEY ("submission_assignment_id", "submission_user_id")
      REFERENCES "submissions"("assignment_id", "user_id")
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "document_attachments_submission_file_idx"
  ON "document_attachments" ("submission_assignment_id", "submission_user_id", "file_id");
CREATE INDEX IF NOT EXISTS "document_attachments_submission_owner_idx"
  ON "document_attachments" ("org_id", "owner_user_id", "submission_assignment_id", "submission_user_id");
