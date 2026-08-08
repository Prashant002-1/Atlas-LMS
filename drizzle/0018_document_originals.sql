-- Keep one private original beside every document Atlas parses locally.
-- The application authenticates through the owning file record before these
-- bytes are read. Files remain the lifecycle owner through ON DELETE CASCADE.

CREATE TABLE IF NOT EXISTS "document_originals" (
  "file_id" uuid PRIMARY KEY NOT NULL REFERENCES "files"("id") ON DELETE CASCADE,
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "bytes" bytea NOT NULL,
  "checksum_sha256" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "document_originals_nonempty_check" CHECK (octet_length("bytes") > 0),
  CONSTRAINT "document_originals_size_check" CHECK (octet_length("bytes") <= 26214400),
  CONSTRAINT "document_originals_checksum_check" CHECK ("checksum_sha256" ~ '^[0-9a-f]{64}$')
);

CREATE INDEX IF NOT EXISTS "document_originals_org_idx"
  ON "document_originals" ("org_id", "file_id");
