-- Phase 4: the publish audit on journey reports.
-- AI drafts, the educator publishes: finalize stamps who confirmed the grade
-- and when. `npm run db:push` derives the same state from lib/db/schema.ts.

ALTER TABLE "journey_reports" ADD COLUMN IF NOT EXISTS "finalized_at" timestamp with time zone;
ALTER TABLE "journey_reports" ADD COLUMN IF NOT EXISTS "finalized_by_id" uuid REFERENCES "users"("id") ON DELETE SET NULL;
