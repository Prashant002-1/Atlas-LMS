-- Personal agents and the policy ladder (ADR-0016).
-- The student profile owns an organization-wide session address, so
-- agent_sessions.course_id becomes nullable and the surface and anchor enums
-- gain 'personal' and 'org'. Two new records: agent_memories (small curated
-- per-person observation store) and org_agent_policies (append-only versioned
-- university policy for the student agent). Courses gain a typed grade scale
-- and class policies edited in Course setup and rendered on the syllabus.
-- `npm run db:push` derives the same state from lib/db/schema.ts.

ALTER TYPE "agent_surface" ADD VALUE IF NOT EXISTS 'personal';
ALTER TYPE "cue_target" ADD VALUE IF NOT EXISTS 'org';

ALTER TABLE "agent_sessions" ALTER COLUMN "course_id" DROP NOT NULL;
ALTER TABLE "agent_sessions" ADD COLUMN IF NOT EXISTS "archived_at" timestamp with time zone;

CREATE INDEX IF NOT EXISTS "agent_sessions_archive_idx"
  ON "agent_sessions" ("org_id", "user_id", "surface", "archived_at");

CREATE TABLE IF NOT EXISTS "agent_memories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "profile" text NOT NULL,
  "kind" text NOT NULL,
  "course_id" uuid REFERENCES "courses"("id") ON DELETE SET NULL,
  "content" text NOT NULL,
  "source_session_id" uuid REFERENCES "agent_sessions"("id") ON DELETE SET NULL,
  "status" text NOT NULL DEFAULT 'active',
  "replaces_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "archived_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "agent_memories_owner_idx"
  ON "agent_memories" ("org_id", "user_id", "profile", "status");

CREATE TABLE IF NOT EXISTS "org_agent_policies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "version" integer NOT NULL,
  "schema_version" integer NOT NULL DEFAULT 1,
  "policy" jsonb NOT NULL,
  "change_summary" text NOT NULL,
  "created_by_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "org_agent_policies_org_version_idx"
  ON "org_agent_policies" ("org_id", "version");

ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "grade_scale" jsonb;
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "class_policies" jsonb;
