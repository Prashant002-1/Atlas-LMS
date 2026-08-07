-- Give existing login aliases credentials independent from their target users.
ALTER TABLE "login_aliases"
  ADD COLUMN IF NOT EXISTS "password_hash" text;

UPDATE "login_aliases" AS alias
SET "password_hash" = target."password_hash"
FROM "users" AS target
WHERE alias."user_id" = target."id"
  AND alias."password_hash" IS NULL;

ALTER TABLE "login_aliases"
  ALTER COLUMN "password_hash" SET NOT NULL;
