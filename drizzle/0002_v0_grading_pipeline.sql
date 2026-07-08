-- Phase 3: the grading pipeline's native rows.
-- Evidence spans (verbatim, string-match verified), journey reports (drafts
-- until the professor finalizes), and deterministic class rollups.
-- `npm run db:push` derives the same state from lib/db/schema.ts; this file
-- documents the delta for manual application.

CREATE TYPE "journey_report_status" AS ENUM ('draft', 'final');

CREATE TABLE IF NOT EXISTS "evidence_spans" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "session_id" uuid NOT NULL REFERENCES "agent_sessions"("id") ON DELETE CASCADE,
  "submission_id" uuid NOT NULL REFERENCES "session_submissions"("id") ON DELETE CASCADE,
  "turn_id" uuid NOT NULL REFERENCES "agent_turns"("id") ON DELETE CASCADE,
  "criterion_key" text NOT NULL,
  "char_start" integer NOT NULL,
  "char_end" integer NOT NULL,
  "quote" text NOT NULL,
  "verified" boolean NOT NULL DEFAULT true,
  "speaker" "agent_turn_role" NOT NULL,
  "previous_turn_id" uuid,
  "next_turn_id" uuid,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "evidence_spans_submission_idx" ON "evidence_spans" ("submission_id", "criterion_key");
CREATE INDEX IF NOT EXISTS "evidence_spans_session_idx" ON "evidence_spans" ("session_id");

CREATE TABLE IF NOT EXISTS "journey_reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "submission_id" uuid NOT NULL REFERENCES "session_submissions"("id") ON DELETE CASCADE,
  "session_id" uuid NOT NULL REFERENCES "agent_sessions"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "course_id" uuid NOT NULL REFERENCES "courses"("id") ON DELETE CASCADE,
  "assignment_id" uuid NOT NULL REFERENCES "assignments"("id") ON DELETE CASCADE,
  "rubric_id" uuid NOT NULL REFERENCES "rubrics"("id") ON DELETE RESTRICT,
  "rubric_version" integer NOT NULL DEFAULT 1,
  "scores" jsonb NOT NULL,
  "overall_score" real NOT NULL DEFAULT 0,
  "status" "journey_report_status" NOT NULL DEFAULT 'draft',
  "grader_label" text,
  "review_requested_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "journey_reports_submission_idx" ON "journey_reports" ("submission_id");
CREATE INDEX IF NOT EXISTS "journey_reports_course_assignment_idx" ON "journey_reports" ("course_id", "assignment_id");
CREATE INDEX IF NOT EXISTS "journey_reports_user_idx" ON "journey_reports" ("user_id");

CREATE TABLE IF NOT EXISTS "class_rollups" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "course_id" uuid NOT NULL REFERENCES "courses"("id") ON DELETE CASCADE,
  "assignment_id" uuid NOT NULL REFERENCES "assignments"("id") ON DELETE CASCADE,
  "stats" jsonb NOT NULL,
  "narrative_draft" text,
  "recommended_practice_set" jsonb,
  "computed_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "class_rollups_course_assignment_idx" ON "class_rollups" ("course_id", "assignment_id");
