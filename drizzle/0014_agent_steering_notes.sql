-- Steering notes: real mid-run redirection instead of a queued next turn.
-- A note typed while a response streams is recorded against that response's
-- durable run id, and the run drains it at its next step boundary through
-- prepareStep, so the answer in flight changes course. The queue lives in
-- Postgres rather than the browser so a refresh or a second tab cannot lose a
-- redirection the server already accepted.
CREATE TABLE IF NOT EXISTS "agent_steering_notes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "session_id" uuid NOT NULL REFERENCES "agent_sessions"("id") ON DELETE CASCADE,
  "run_id" text NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "text" text NOT NULL,
  "consumed_at" timestamp with time zone,
  "consumed_at_step" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- The drain query: unconsumed notes for one run, in arrival order.
CREATE INDEX IF NOT EXISTS "agent_steering_notes_run_idx"
  ON "agent_steering_notes" ("session_id", "run_id", "consumed_at");
