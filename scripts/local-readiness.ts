import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { Pool } from "pg";

import { describeDatabaseUrl, inspectReleaseDatabase, isLoopbackDatabaseUrl } from "./db-release-lib";

const databaseUrl = process.env.DATABASE_URL;
const workflowUrl = process.env.WORKFLOW_POSTGRES_URL;
const errors: string[] = [];
const warnings: string[] = [];

function requireEnvironment(name: string, value: string | undefined) {
  if (!value) errors.push(`${name} is missing from .env.local.`);
}

function sameDatabase(left: string, right: string): boolean {
  try {
    const a = new URL(left);
    const b = new URL(right);
    return a.hostname === b.hostname && a.port === b.port && a.pathname === b.pathname && a.username === b.username;
  } catch {
    return false;
  }
}

async function main() {
  requireEnvironment("DATABASE_URL", databaseUrl);
  requireEnvironment("WORKFLOW_POSTGRES_URL", workflowUrl);
  requireEnvironment("WORKFLOW_TARGET_WORLD", process.env.WORKFLOW_TARGET_WORLD);
  requireEnvironment("AUTH_SECRET", process.env.AUTH_SECRET);
  if (errors.length > 0 || !databaseUrl || !workflowUrl) return;

  if (!isLoopbackDatabaseUrl(databaseUrl)) {
    errors.push(`Local development must not use a remote application database (${describeDatabaseUrl(databaseUrl)}).`);
  }
  if (!isLoopbackDatabaseUrl(workflowUrl)) {
    errors.push(`Local development must not use a remote Workflow database (${describeDatabaseUrl(workflowUrl)}).`);
  }
  if (!sameDatabase(databaseUrl, workflowUrl)) {
    errors.push("Local DATABASE_URL and WORKFLOW_POSTGRES_URL must point to the same Compose database.");
  }

  const appPool = new Pool({ connectionString: databaseUrl, max: 2 });
  const workflowPool = new Pool({ connectionString: workflowUrl, max: 2 });
  try {
    const inspection = await inspectReleaseDatabase(appPool);
    errors.push(...inspection.issues);

    const workflowResult = await workflowPool.query<{ ready: boolean }>(`
      SELECT
        to_regclass('workflow.workflow_runs') IS NOT NULL
        AND to_regclass('workflow.workflow_steps') IS NOT NULL
        AND to_regclass('workflow.workflow_events') IS NOT NULL AS ready
    `);
    if (!workflowResult.rows[0]?.ready) {
      errors.push("Workflow tables are missing. Run npm run workflow:bootstrap.");
    }

    const demoUsersResult = await appPool.query<{ email: string; hasPassword: boolean }>(`
      SELECT email, password_hash IS NOT NULL AS "hasPassword"
      FROM users
      WHERE email IN ('instructor@demo.edu', 'student@demo.edu')
    `);
    const demoUsers = new Map(demoUsersResult.rows.map((row) => [row.email, row.hasPassword]));
    for (const email of ["instructor@demo.edu", "student@demo.edu"]) {
      if (!demoUsers.get(email)) errors.push(`Seeded login is missing or disabled: ${email}. Run npm run db:seed.`);
    }

    const assetsResult = await appPool.query<{ url: string }>(`
      SELECT DISTINCT url
      FROM files
      WHERE url LIKE '/seed-assets/%'
      ORDER BY url
    `);
    if (assetsResult.rows.length === 0) {
      warnings.push("No seeded file URLs were found. Run npm run db:seed if you expect the demo world.");
    }
    for (const row of assetsResult.rows) {
      const assetPath = resolve(process.cwd(), "public", row.url.replace(/^\//, ""));
      if (!existsSync(assetPath)) errors.push(`Seeded file is missing from disk: ${row.url}`);
    }
  } finally {
    await Promise.all([appPool.end(), workflowPool.end()]);
  }
}

main()
  .catch((error) => {
    errors.push(error instanceof Error ? error.message : String(error));
  })
  .finally(() => {
    if (warnings.length > 0) {
      console.warn("Local readiness warnings:");
      for (const warning of warnings) console.warn(`- ${warning}`);
    }
    if (errors.length > 0) {
      console.error("Local Atlas is not ready:");
      for (const error of errors) console.error(`- ${error}`);
      console.error("Run npm run db:upgrade, npm run workflow:bootstrap, and npm run local:check before starting Atlas.");
      process.exitCode = 1;
      return;
    }
    console.log("Local Atlas is ready: environment, schema, Workflow, demo identities, and seeded files are aligned.");
  });
