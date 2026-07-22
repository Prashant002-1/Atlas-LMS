-- Durable agent runs and server-owned assessed-session deadlines.
-- `npm run db:push` derives the same state from lib/db/schema.ts.

ALTER TABLE "agent_sessions" ADD COLUMN IF NOT EXISTS "active_run_id" text;
ALTER TABLE "agent_sessions" ADD COLUMN IF NOT EXISTS "active_run_started_at" timestamp with time zone;
ALTER TABLE "agent_sessions" ADD COLUMN IF NOT EXISTS "deadline_at" timestamp with time zone;
ALTER TABLE "agent_sessions" ADD COLUMN IF NOT EXISTS "deadline_run_id" text;

CREATE INDEX IF NOT EXISTS "agent_sessions_active_run_idx" ON "agent_sessions" ("active_run_id");
