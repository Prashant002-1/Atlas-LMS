import { Pool } from "pg";

import { prepareSeedDocument, seedDocumentMetadata } from "../lib/db/seed-document-assets";

type SeedDocumentRow = {
  fileId: string;
  recordId: string;
  assetPath: string | null;
};

const databaseUrl = process.env.DATABASE_URL;
const allowRemote = process.argv.includes("--allow-remote");

function isLoopbackDatabase(value: string) {
  try {
    const hostname = new URL(value).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" || hostname === "::1";
  } catch {
    return false;
  }
}

async function main() {
  if (!databaseUrl) throw new Error("DATABASE_URL is required.");
  if (!isLoopbackDatabase(databaseUrl) && !allowRemote) {
    throw new Error("Refusing to re-ingest a non-local database. Re-run with --allow-remote only for a reviewed release operation.");
  }

  const pool = new Pool({ connectionString: databaseUrl, max: 2 });
  try {
    const rowsResult = await pool.query<SeedDocumentRow>(`
      SELECT
        files.id AS "fileId",
        course_material_records.id AS "recordId",
        COALESCE(
          course_material_records.metadata ->> 'seedAssetPath',
          files.url
        ) AS "assetPath"
      FROM files
      INNER JOIN course_material_records ON course_material_records.file_id = files.id
      WHERE course_material_records.ingestion_source = 'seed'
      ORDER BY files.id
    `);
    if (rowsResult.rows.length === 0) {
      console.log("No seeded documents need re-ingestion.");
      return;
    }
    const missingPath = rowsResult.rows.find((row) => !row.assetPath?.startsWith("/seed-assets/"));
    if (missingPath) throw new Error(`Seeded file ${missingPath.fileId} has no recoverable seed asset path.`);

    const preparedByPath = new Map<string, Awaited<ReturnType<typeof prepareSeedDocument>>>();
    for (const assetPath of new Set(rowsResult.rows.map((row) => row.assetPath!))) {
      preparedByPath.set(assetPath, await prepareSeedDocument(assetPath));
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext('atlas_seed_document_reingestion'))");
      for (const row of rowsResult.rows) {
        const prepared = preparedByPath.get(row.assetPath!);
        if (!prepared) throw new Error(`Seed asset was not prepared: ${row.assetPath}`);
        const metadata = seedDocumentMetadata(prepared);

        await client.query(
          `INSERT INTO document_originals (file_id, org_id, bytes, checksum_sha256)
           SELECT id, org_id, $2, $3 FROM files WHERE id = $1
           ON CONFLICT (file_id) DO UPDATE SET
             org_id = EXCLUDED.org_id,
             bytes = EXCLUDED.bytes,
             checksum_sha256 = EXCLUDED.checksum_sha256`,
          [row.fileId, prepared.bytes, prepared.checksumSha256]
        );
        await client.query(
          `UPDATE files
           SET filename = $2, size_bytes = $3, url = NULL, extracted_text = $4
           WHERE id = $1`,
          [row.fileId, prepared.sourceFilename, prepared.bytes.byteLength, prepared.parsed?.markdown ?? null]
        );
        await client.query(
          `UPDATE course_material_records
           SET processing_status = $2,
               processing_error = $3,
               checksum_sha256 = $4,
               metadata = $5::jsonb,
               extraction = $6::jsonb,
               extraction_provider = $7,
               extraction_model = $8,
               extraction_input_mode = $9,
               updated_at = now()
           WHERE id = $1`,
          [
            row.recordId,
            prepared.parsed ? "ready" : "failed",
            prepared.error,
            prepared.checksumSha256,
            JSON.stringify(metadata),
            prepared.parsed ? JSON.stringify(prepared.parsed.extraction) : null,
            prepared.parsed?.parser ?? null,
            prepared.parsed?.parserVersion ?? null,
            prepared.parsed?.inputMode ?? null,
          ]
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    const failures = [...preparedByPath.values()].filter((prepared) => !prepared.parsed);
    console.log(
      `Re-ingested ${rowsResult.rows.length} seeded document records from ${preparedByPath.size} durable asset files.`
    );
    if (failures.length > 0) {
      console.warn(`${failures.length} source asset(s) retained their originals but failed readable conversion.`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
