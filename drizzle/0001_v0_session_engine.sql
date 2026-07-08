-- Phase 2: the session engine's native rows.
-- Native tables only where the live pipeline needs queryable persistence
-- (docs/v0/implementation-plan.md, decisions at the door).
-- `npm run db:push` derives the same state from lib/db/schema.ts; this file
-- documents the delta for manual application.

CREATE TYPE "session_submission_status" AS ENUM ('submitted', 'graded');

ALTER TABLE "submissions" ADD COLUMN IF NOT EXISTS "topic_scores" jsonb;

CREATE TABLE IF NOT EXISTS "rubrics" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "course_id" uuid NOT NULL REFERENCES "courses"("id") ON DELETE CASCADE,
  "version" integer NOT NULL DEFAULT 1,
  "criteria" jsonb NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "rubrics_course_version_idx" ON "rubrics" ("course_id", "version");

CREATE TABLE IF NOT EXISTS "session_assignments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "course_id" uuid NOT NULL REFERENCES "courses"("id") ON DELETE CASCADE,
  "assignment_id" uuid NOT NULL REFERENCES "assignments"("id") ON DELETE CASCADE,
  "rubric_id" uuid NOT NULL REFERENCES "rubrics"("id") ON DELETE RESTRICT,
  "instructions" text NOT NULL,
  "duration_minutes" integer NOT NULL DEFAULT 30,
  "grounding_scope" jsonb NOT NULL DEFAULT '[]',
  "transcript_policy" text NOT NULL DEFAULT 'shared on request / for review',
  "personal_record_side_notes" boolean NOT NULL DEFAULT false,
  "side_note_triggers" jsonb NOT NULL DEFAULT '[]',
  "planning_session_id" uuid REFERENCES "agent_sessions"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "session_assignments_assignment_idx" ON "session_assignments" ("assignment_id");
CREATE INDEX IF NOT EXISTS "session_assignments_course_idx" ON "session_assignments" ("course_id");

CREATE TABLE IF NOT EXISTS "session_artifact_states" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "session_id" uuid NOT NULL REFERENCES "agent_sessions"("id") ON DELETE CASCADE,
  "turn_index" integer NOT NULL,
  "artifact_type" text NOT NULL,
  "state" jsonb NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "session_artifact_states_session_idx" ON "session_artifact_states" ("session_id", "turn_index");

CREATE TABLE IF NOT EXISTS "session_side_notes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "session_id" uuid NOT NULL REFERENCES "agent_sessions"("id") ON DELETE CASCADE,
  "turn_index" integer NOT NULL,
  "topic" text NOT NULL,
  "text" text NOT NULL,
  "source_refs" jsonb NOT NULL DEFAULT '[]',
  "source_page_slug" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "session_side_notes_session_idx" ON "session_side_notes" ("session_id", "turn_index");

CREATE TABLE IF NOT EXISTS "session_submissions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "session_id" uuid NOT NULL REFERENCES "agent_sessions"("id") ON DELETE CASCADE,
  "assignment_id" uuid NOT NULL REFERENCES "assignments"("id") ON DELETE CASCADE,
  "course_id" uuid NOT NULL REFERENCES "courses"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "status" "session_submission_status" NOT NULL DEFAULT 'submitted',
  "transcript" jsonb NOT NULL,
  "final_artifact" jsonb,
  "turn_count" integer NOT NULL DEFAULT 0,
  "rubric_id" uuid REFERENCES "rubrics"("id") ON DELETE SET NULL,
  "rubric_version" integer NOT NULL DEFAULT 1,
  "submitted_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "session_submissions_session_idx" ON "session_submissions" ("session_id");
CREATE INDEX IF NOT EXISTS "session_submissions_assignment_user_idx" ON "session_submissions" ("assignment_id", "user_id");
CREATE INDEX IF NOT EXISTS "session_submissions_course_idx" ON "session_submissions" ("course_id");
