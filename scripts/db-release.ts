import { Pool, type PoolClient } from "pg";

import {
  describeDatabaseUrl,
  inspectReleaseDatabase,
  isLoopbackDatabaseUrl,
  loadMigrationSources,
} from "./db-release-lib";

const command = process.argv[2] ?? "check";
const allowDestructive = process.argv.includes("--allow-destructive");
const allowRemote = process.argv.includes("--allow-remote");
const databaseUrl = process.env.DATABASE_URL;

function usage(): never {
  console.error("Usage: npm run db:check | npm run db:upgrade -- [--allow-destructive] [--allow-remote]");
  process.exit(2);
}

async function inspect(pool: Pool): Promise<boolean> {
  const inspection = await inspectReleaseDatabase(pool);
  if (inspection.ready) {
    console.log("Database release contract is current.");
    return true;
  }
  console.error("Database release contract is not current:");
  for (const issue of inspection.issues) console.error(`- ${issue}`);
  return false;
}

async function ensureLedger(client: PoolClient) {
  await client.query("CREATE SCHEMA IF NOT EXISTS atlas_ops");
  await client.query(`
    CREATE TABLE IF NOT EXISTS atlas_ops.schema_migrations (
      id text PRIMARY KEY,
      checksum text NOT NULL,
      applied_at timestamp with time zone DEFAULT now() NOT NULL
    )
  `);
}

async function upgrade(pool: Pool) {
  if (!databaseUrl) throw new Error("DATABASE_URL is required.");
  if (!isLoopbackDatabaseUrl(databaseUrl) && !allowRemote) {
    throw new Error(
      `Refusing to mutate non-local database ${describeDatabaseUrl(databaseUrl)}. Re-run with --allow-remote only after backup and release review.`
    );
  }

  const sources = loadMigrationSources();
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock(hashtext('atlas_database_release'))");
    await ensureLedger(client);
    const appliedResult = await client.query<{ id: string; checksum: string }>(
      "SELECT id, checksum FROM atlas_ops.schema_migrations"
    );
    const applied = new Map(appliedResult.rows.map((row) => [row.id, row.checksum]));
    const pending = sources.filter((source) => !applied.has(source.id));
    const pendingDestructive = pending.filter((source) => source.destructive);

    for (const source of sources) {
      const recordedChecksum = applied.get(source.id);
      if (recordedChecksum && recordedChecksum !== source.checksum) {
        throw new Error(`Migration ${source.id} changed after it was applied. Add a new migration instead.`);
      }
    }

    if (pendingDestructive.length > 0 && !allowDestructive) {
      const details = pendingDestructive.map((source) => `${source.id}: ${source.reason}`).join("\n- ");
      throw new Error(
        `Destructive migrations require a reviewed backup and --allow-destructive:\n- ${details}`
      );
    }

    if (pending.length === 0) {
      console.log("No database migrations are pending.");
      return;
    }

    console.log(`Upgrading ${describeDatabaseUrl(databaseUrl)} with ${pending.length} managed migration(s).`);
    for (const source of pending) {
      await client.query("BEGIN");
      try {
        await client.query(source.sql);
        await client.query(
          "INSERT INTO atlas_ops.schema_migrations (id, checksum) VALUES ($1, $2)",
          [source.id, source.checksum]
        );
        await client.query("COMMIT");
        console.log(`Applied ${source.id}.`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock(hashtext('atlas_database_release'))").catch(() => undefined);
    client.release();
  }
}

async function main() {
  if (!databaseUrl) throw new Error("DATABASE_URL is required. Copy .env.example to .env.local first.");
  if (command !== "check" && command !== "upgrade") usage();

  const pool = new Pool({ connectionString: databaseUrl, max: 2 });
  try {
    if (command === "upgrade") await upgrade(pool);
    const current = await inspect(pool);
    if (!current) process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
