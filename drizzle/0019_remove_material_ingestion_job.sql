-- Material intake is synchronous. Links are references, opaque uploads are
-- stored as ready files, and document parsing completes in the upload action.
DROP INDEX IF EXISTS "course_material_records_job_idx";

ALTER TABLE "course_material_records"
  DROP COLUMN IF EXISTS "ingestion_job_id";
