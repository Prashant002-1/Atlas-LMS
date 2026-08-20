ALTER TYPE "proposal_status" ADD VALUE IF NOT EXISTS 'superseded';

CREATE TABLE IF NOT EXISTS "course_agent_directives" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "course_id" uuid NOT NULL REFERENCES "courses"("id") ON DELETE cascade,
  "key" text NOT NULL,
  "namespace" text NOT NULL,
  "revision" integer NOT NULL,
  "title" text NOT NULL,
  "instruction" text NOT NULL,
  "effect" text NOT NULL,
  "value" jsonb,
  "value_schema" text,
  "selectors" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "supersedes_id" uuid REFERENCES "course_agent_directives"("id") ON DELETE set null,
  "source_proposal_id" uuid REFERENCES "change_proposals"("id") ON DELETE set null,
  "source_session_id" uuid REFERENCES "agent_sessions"("id") ON DELETE set null,
  "created_by_id" uuid REFERENCES "users"("id") ON DELETE set null,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "course_agent_directives_revision_check" CHECK ("revision" > 0),
  CONSTRAINT "course_agent_directives_namespace_check" CHECK ("namespace" ~ '^[a-z][a-z0-9_-]*$'),
  CONSTRAINT "course_agent_directives_key_check" CHECK ("key" ~ '^[a-z][a-z0-9_-]*([.][a-z0-9][a-z0-9_-]*)+$'),
  CONSTRAINT "course_agent_directives_effect_check" CHECK ("effect" IN ('guide', 'require', 'prohibit', 'escalate'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "course_agent_directives_course_key_revision_idx"
  ON "course_agent_directives" ("course_id", "key", "revision");
CREATE INDEX IF NOT EXISTS "course_agent_directives_active_idx"
  ON "course_agent_directives" ("org_id", "course_id", "key", "revision");
CREATE INDEX IF NOT EXISTS "course_agent_directives_namespace_idx"
  ON "course_agent_directives" ("org_id", "course_id", "namespace", "revision");

WITH active_configs AS (
  SELECT DISTINCT ON ("course_id")
    "org_id",
    "course_id",
    "configuration",
    "source_session_id",
    "created_by_id",
    "created_at"
  FROM "course_agent_configs"
  ORDER BY "course_id", "version" DESC
), expanded AS (
  SELECT
    config."org_id",
    config."course_id",
    rule.value AS rule,
    config."source_session_id",
    config."created_by_id",
    config."created_at"
  FROM active_configs config
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(config."configuration"->'rules', '[]'::jsonb)) AS rule(value)
)
INSERT INTO "course_agent_directives" (
  "org_id",
  "course_id",
  "key",
  "namespace",
  "revision",
  "title",
  "instruction",
  "effect",
  "selectors",
  "enabled",
  "source_session_id",
  "created_by_id",
  "created_at"
)
SELECT
  expanded."org_id",
  expanded."course_id",
  'course.' || (expanded.rule->>'id'),
  'course',
  1,
  expanded.rule->>'title',
  expanded.rule->>'instruction',
  'guide',
  jsonb_build_object('surfaces', COALESCE(expanded.rule->'appliesTo', '[]'::jsonb)),
  COALESCE((expanded.rule->>'enabled')::boolean, true),
  expanded."source_session_id",
  expanded."created_by_id",
  expanded."created_at"
FROM expanded
WHERE expanded.rule ? 'id'
  AND expanded.rule ? 'title'
  AND expanded.rule ? 'instruction'
ON CONFLICT ("course_id", "key", "revision") DO NOTHING;

ALTER TABLE "change_proposals"
  ADD COLUMN IF NOT EXISTS "revision" integer DEFAULT 1 NOT NULL,
  ADD COLUMN IF NOT EXISTS "supersedes_proposal_id" uuid REFERENCES "change_proposals"("id") ON DELETE set null;

CREATE UNIQUE INDEX IF NOT EXISTS "change_proposals_supersedes_idx"
  ON "change_proposals" ("supersedes_proposal_id")
  WHERE "supersedes_proposal_id" IS NOT NULL;
