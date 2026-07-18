-- Instructor profile facts on the user record: a title, an office location,
-- and office hours. Shown on the account page and composed into the syllabus.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "title" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "office_location" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "office_hours" text;
