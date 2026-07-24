ALTER TABLE "journey_reports"
  DROP COLUMN IF EXISTS "review_requested_at";

UPDATE "class_rollups"
SET "stats" = "stats" - 'reviewRequestedCount'
WHERE "stats" ? 'reviewRequestedCount';
