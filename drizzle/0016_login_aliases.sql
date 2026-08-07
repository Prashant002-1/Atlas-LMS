-- Additional login emails for one stable Atlas identity.
--
-- The alias owns no course or agent data. Authentication resolves it to the
-- target user id, whose existing password hash and complete record remain the
-- single source of truth.
CREATE TABLE IF NOT EXISTS "login_aliases" (
  "email" text PRIMARY KEY NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "login_aliases_user_idx"
  ON "login_aliases" ("user_id");
