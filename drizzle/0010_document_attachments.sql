-- Reusable document attachment ownership and model-derived document structure.
-- Migration 0008 owns personal agents and 0009 owns assessed transcript access;
-- document workflows follow both in 0010.

ALTER TYPE "material_visibility" ADD VALUE IF NOT EXISTS 'private';

ALTER TABLE "files"
  ALTER COLUMN "course_id" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "owner_user_id" uuid REFERENCES "users"("id") ON DELETE CASCADE;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'files_one_scope_check') THEN
    ALTER TABLE "files" ADD CONSTRAINT "files_one_scope_check"
      CHECK (num_nonnulls("course_id", "owner_user_id") = 1);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "files_owner_idx"
  ON "files" ("org_id", "owner_user_id");

ALTER TABLE "course_material_records"
  ALTER COLUMN "course_id" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "owner_user_id" uuid REFERENCES "users"("id") ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS "extraction" jsonb,
  ADD COLUMN IF NOT EXISTS "extraction_provider" text,
  ADD COLUMN IF NOT EXISTS "extraction_model" text,
  ADD COLUMN IF NOT EXISTS "extraction_input_mode" text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'course_material_records_one_scope_check') THEN
    ALTER TABLE "course_material_records" ADD CONSTRAINT "course_material_records_one_scope_check"
      CHECK (num_nonnulls("course_id", "owner_user_id") = 1);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "course_material_records_owner_idx"
  ON "course_material_records" ("org_id", "owner_user_id", "processing_status");

CREATE TABLE IF NOT EXISTS "document_attachments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "course_id" uuid REFERENCES "courses"("id") ON DELETE CASCADE,
  "owner_user_id" uuid REFERENCES "users"("id") ON DELETE CASCADE,
  "file_id" uuid NOT NULL REFERENCES "files"("id") ON DELETE CASCADE,
  "course_material_id" uuid REFERENCES "course_material_records"("id") ON DELETE CASCADE,
  "syllabus_course_id" uuid REFERENCES "courses"("id") ON DELETE CASCADE,
  "assignment_id" uuid REFERENCES "assignments"("id") ON DELETE CASCADE,
  "agent_session_id" uuid REFERENCES "agent_sessions"("id") ON DELETE CASCADE,
  "created_by_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "document_attachments_one_owner_check"
    CHECK (num_nonnulls("course_material_id", "syllabus_course_id", "assignment_id", "agent_session_id") = 1),
  CONSTRAINT "document_attachments_one_scope_check"
    CHECK (num_nonnulls("course_id", "owner_user_id") = 1),
  CONSTRAINT "document_attachments_private_thread_check"
    CHECK ("owner_user_id" IS NULL OR (
      "agent_session_id" IS NOT NULL AND
      "course_material_id" IS NULL AND
      "syllabus_course_id" IS NULL AND
      "assignment_id" IS NULL
    ))
);

ALTER TABLE "document_attachments"
  ALTER COLUMN "course_id" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "owner_user_id" uuid REFERENCES "users"("id") ON DELETE CASCADE;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'document_attachments_one_scope_check') THEN
    ALTER TABLE "document_attachments" ADD CONSTRAINT "document_attachments_one_scope_check"
      CHECK (num_nonnulls("course_id", "owner_user_id") = 1);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'document_attachments_private_thread_check') THEN
    ALTER TABLE "document_attachments" ADD CONSTRAINT "document_attachments_private_thread_check"
      CHECK ("owner_user_id" IS NULL OR (
        "agent_session_id" IS NOT NULL AND
        "course_material_id" IS NULL AND
        "syllabus_course_id" IS NULL AND
        "assignment_id" IS NULL
      ));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "document_attachments_material_file_idx"
  ON "document_attachments" ("course_material_id", "file_id");
CREATE UNIQUE INDEX IF NOT EXISTS "document_attachments_syllabus_file_idx"
  ON "document_attachments" ("syllabus_course_id", "file_id");
CREATE UNIQUE INDEX IF NOT EXISTS "document_attachments_assignment_file_idx"
  ON "document_attachments" ("assignment_id", "file_id");
CREATE UNIQUE INDEX IF NOT EXISTS "document_attachments_session_file_idx"
  ON "document_attachments" ("agent_session_id", "file_id");
CREATE INDEX IF NOT EXISTS "document_attachments_scope_idx"
  ON "document_attachments" ("org_id", "course_id", "file_id");
CREATE INDEX IF NOT EXISTS "document_attachments_owner_idx"
  ON "document_attachments" ("org_id", "owner_user_id", "agent_session_id", "file_id");

INSERT INTO "document_attachments" ("org_id", "course_id", "file_id", "course_material_id", "created_by_id")
SELECT record."org_id", record."course_id", record."file_id", record."id", record."updated_by_id"
FROM "course_material_records" record
WHERE record."material_kind" IN ('document', 'slides', 'assessment')
ON CONFLICT ("course_material_id", "file_id") DO NOTHING;
