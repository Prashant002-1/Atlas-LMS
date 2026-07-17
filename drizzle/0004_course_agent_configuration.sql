-- Shared course agent configuration and course material processing metadata.
-- Configuration is append-only. Existing files remain valid without an
-- extension row and are treated as ready, course-visible legacy material.

DO $$ BEGIN
  CREATE TYPE "material_kind" AS ENUM ('document', 'slides', 'assessment', 'media', 'link', 'package', 'other');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "material_source" AS ENUM ('upload', 'common_cartridge', 'qti', 'lms_import', 'external', 'seed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "material_status" AS ENUM ('queued', 'processing', 'ready', 'failed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "material_visibility" AS ENUM ('course', 'instructors');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "course_agent_configs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "course_id" uuid NOT NULL REFERENCES "courses"("id") ON DELETE CASCADE,
  "version" integer NOT NULL,
  "schema_version" integer DEFAULT 1 NOT NULL,
  "configuration" jsonb NOT NULL,
  "student_disclosure" text NOT NULL,
  "change_summary" text NOT NULL,
  "source_session_id" uuid REFERENCES "agent_sessions"("id") ON DELETE SET NULL,
  "created_by_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "course_agent_configs_course_version_idx"
  ON "course_agent_configs" USING btree ("course_id", "version");
CREATE INDEX IF NOT EXISTS "course_agent_configs_active_idx"
  ON "course_agent_configs" USING btree ("org_id", "course_id", "version");

CREATE TABLE IF NOT EXISTS "course_material_records" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "course_id" uuid NOT NULL REFERENCES "courses"("id") ON DELETE CASCADE,
  "file_id" uuid NOT NULL REFERENCES "files"("id") ON DELETE CASCADE,
  "ingestion_job_id" text,
  "material_kind" "material_kind" NOT NULL,
  "ingestion_source" "material_source" NOT NULL,
  "processing_status" "material_status" DEFAULT 'queued' NOT NULL,
  "visibility" "material_visibility" DEFAULT 'course' NOT NULL,
  "page_count" integer,
  "checksum_sha256" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "processing_error" text,
  "updated_by_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "course_material_records_file_idx"
  ON "course_material_records" USING btree ("file_id");
CREATE UNIQUE INDEX IF NOT EXISTS "course_material_records_job_idx"
  ON "course_material_records" USING btree ("ingestion_job_id");
CREATE INDEX IF NOT EXISTS "course_material_records_course_idx"
  ON "course_material_records" USING btree ("org_id", "course_id", "processing_status");
