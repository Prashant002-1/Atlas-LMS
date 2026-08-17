import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { Pool } from "pg";

export type ManagedMigration = {
  id: string;
  file: string;
  destructive: boolean;
  reason: string;
};

/**
 * Atlas's original Drizzle journal contains only the base migration. Existing
 * databases therefore cannot rely on `drizzle-kit migrate` to discover later
 * reviewed SQL files. This explicit forward list is the release contract for
 * databases that already exist. Brand-new empty databases still begin with
 * `db:push`, then run this list to establish the release ledger.
 */
export const managedMigrations: ManagedMigration[] = [
  {
    id: "0007_platform_model_credentials",
    file: "drizzle/0007_platform_model_credentials.sql",
    destructive: true,
    reason: "removes the retired tenant model-settings table and enum",
  },
  {
    id: "0016_login_aliases",
    file: "drizzle/0016_login_aliases.sql",
    destructive: false,
    reason: "adds stable login aliases",
  },
  {
    id: "0017_login_alias_passwords",
    file: "drizzle/0017_login_alias_passwords.sql",
    destructive: false,
    reason: "gives aliases independent password hashes",
  },
  {
    id: "0018_document_originals",
    file: "drizzle/0018_document_originals.sql",
    destructive: false,
    reason: "adds private durable document originals",
  },
  {
    id: "0019_remove_material_ingestion_job",
    file: "drizzle/0019_remove_material_ingestion_job.sql",
    destructive: true,
    reason: "removes the retired asynchronous material-ingestion job column",
  },
  {
    id: "0020_submission_attachments",
    file: "drizzle/0020_submission_attachments.sql",
    destructive: false,
    reason: "attaches private student files to durable assignment submissions",
  },
  {
    id: "0021_course_guidance_and_proposal_revisions",
    file: "drizzle/0021_course_guidance_and_proposal_revisions.sql",
    destructive: false,
    reason: "adds addressable course guidance and versioned proposal chains",
  },
  {
    id: "0022_code_execution",
    file: "drizzle/0022_code_execution.sql",
    destructive: false,
    reason: "adds durable AgentCore workspaces, executions, and output artifacts",
  },
  {
    id: "0023_code_execution_workflow_provenance",
    file: "drizzle/0023_code_execution_workflow_provenance.sql",
    destructive: false,
    reason: "records the durable Workflow run that initiated code execution",
  },
  {
    id: "0024_code_execution_workspace_lease",
    file: "drizzle/0024_code_execution_workspace_lease.sql",
    destructive: false,
    reason: "serializes code execution within each chat workspace",
  },
];

export type MigrationSource = ManagedMigration & {
  sql: string;
  checksum: string;
};

export type ReleaseInspection = {
  ready: boolean;
  issues: string[];
};

type ContractRow = {
  organizations: boolean;
  users: boolean;
  files: boolean;
  courseMaterialRecords: boolean;
  documentAttachments: boolean;
  agentSessions: boolean;
  sessionSubmissions: boolean;
  journeyReports: boolean;
  loginAliases: boolean;
  loginAliasPasswordHash: boolean;
  documentOriginals: boolean;
  courseAgentDirectives: boolean;
  proposalRevisions: boolean;
  proposalSupersededStatus: boolean;
  codeExecutionWorkspaces: boolean;
  codeExecutions: boolean;
  codeExecutionArtifacts: boolean;
  codeExecutionWorkflowRunId: boolean;
  ingestionJobRemoved: boolean;
  retiredProviderTableRemoved: boolean;
  retiredProviderTypeRemoved: boolean;
};

export function loadMigrationSources(): MigrationSource[] {
  return managedMigrations.map((migration) => {
    const absolutePath = resolve(process.cwd(), migration.file);
    if (!existsSync(absolutePath)) {
      throw new Error(`Managed migration is missing: ${migration.file}`);
    }
    const sql = readFileSync(absolutePath, "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    return { ...migration, sql, checksum };
  });
}

export function isLoopbackDatabaseUrl(value: string): boolean {
  try {
    const hostname = new URL(value).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" || hostname === "::1";
  } catch {
    return false;
  }
}

export function describeDatabaseUrl(value: string): string {
  try {
    const url = new URL(value);
    const port = url.port ? `:${url.port}` : "";
    const database = url.pathname.replace(/^\//, "") || "(default)";
    return `${url.username || "(default user)"}@${url.hostname}${port}/${database}`;
  } catch {
    return "invalid DATABASE_URL";
  }
}

export async function inspectReleaseDatabase(pool: Pool): Promise<ReleaseInspection> {
  const issues: string[] = [];
  const sources = loadMigrationSources();

  const contractResult = await pool.query<ContractRow>(`
    SELECT
      to_regclass('public.organizations') IS NOT NULL AS "organizations",
      to_regclass('public.users') IS NOT NULL AS "users",
      to_regclass('public.files') IS NOT NULL AS "files",
      to_regclass('public.course_material_records') IS NOT NULL AS "courseMaterialRecords",
      to_regclass('public.document_attachments') IS NOT NULL AS "documentAttachments",
      to_regclass('public.agent_sessions') IS NOT NULL AS "agentSessions",
      to_regclass('public.session_submissions') IS NOT NULL AS "sessionSubmissions",
      to_regclass('public.journey_reports') IS NOT NULL AS "journeyReports",
      to_regclass('public.login_aliases') IS NOT NULL AS "loginAliases",
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'login_aliases'
          AND column_name = 'password_hash'
          AND is_nullable = 'NO'
      ) AS "loginAliasPasswordHash",
      to_regclass('public.document_originals') IS NOT NULL AS "documentOriginals",
      to_regclass('public.course_agent_directives') IS NOT NULL AS "courseAgentDirectives",
      to_regclass('public.code_execution_workspaces') IS NOT NULL AS "codeExecutionWorkspaces",
      to_regclass('public.code_executions') IS NOT NULL AS "codeExecutions",
      to_regclass('public.code_execution_artifacts') IS NOT NULL AS "codeExecutionArtifacts",
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'code_executions'
          AND column_name = 'workflow_run_id'
      ) AS "codeExecutionWorkflowRunId",
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'change_proposals'
          AND column_name = 'revision'
          AND is_nullable = 'NO'
      ) AND EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'change_proposals'
          AND column_name = 'supersedes_proposal_id'
      ) AS "proposalRevisions",
      EXISTS (
        SELECT 1
        FROM pg_type
        INNER JOIN pg_enum ON pg_enum.enumtypid = pg_type.oid
        INNER JOIN pg_namespace ON pg_namespace.oid = pg_type.typnamespace
        WHERE pg_namespace.nspname = 'public'
          AND pg_type.typname = 'proposal_status'
          AND pg_enum.enumlabel = 'superseded'
      ) AS "proposalSupersededStatus",
      NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'course_material_records'
          AND column_name = 'ingestion_job_id'
      ) AS "ingestionJobRemoved",
      to_regclass('public.' || 'org' || '_provider' || '_keys') IS NULL AS "retiredProviderTableRemoved",
      NOT EXISTS (
        SELECT 1
        FROM pg_type
        INNER JOIN pg_namespace ON pg_namespace.oid = pg_type.typnamespace
        WHERE pg_namespace.nspname = 'public'
          AND pg_type.typname = 'provider' || '_kind'
      ) AS "retiredProviderTypeRemoved"
  `);
  const contract = contractResult.rows[0];

  const requiredTables: Array<[keyof ContractRow, string]> = [
    ["organizations", "organizations"],
    ["users", "users"],
    ["files", "files"],
    ["courseMaterialRecords", "course_material_records"],
    ["documentAttachments", "document_attachments"],
    ["agentSessions", "agent_sessions"],
    ["sessionSubmissions", "session_submissions"],
    ["journeyReports", "journey_reports"],
  ];
  for (const [key, table] of requiredTables) {
    if (!contract[key]) issues.push(`Required application table is missing: public.${table}`);
  }
  if (!contract.loginAliases) issues.push("Login alias table is missing (migration 0016).");
  if (!contract.loginAliasPasswordHash) {
    issues.push("Login aliases do not have a required non-null password hash (migration 0017).");
  }
  if (!contract.documentOriginals) issues.push("Document originals table is missing (migration 0018).");
  if (!contract.courseAgentDirectives) {
    issues.push("Course agent directives are missing (migration 0021).");
  }
  if (!contract.codeExecutionWorkspaces || !contract.codeExecutions || !contract.codeExecutionArtifacts) {
    issues.push("Code execution tables are missing (migration 0022).");
  }
  if (!contract.codeExecutionWorkflowRunId) {
    issues.push("Code execution Workflow provenance is missing (migration 0023).");
  }
  if (!contract.proposalRevisions || !contract.proposalSupersededStatus) {
    issues.push("Proposal revision fields or status are missing (migration 0021).");
  }
  if (!contract.ingestionJobRemoved) {
    issues.push("Retired course_material_records.ingestion_job_id is still present (migration 0019).");
  }
  if (!contract.retiredProviderTableRemoved || !contract.retiredProviderTypeRemoved) {
    issues.push("Retired tenant model-settings schema is still present (migration 0007).");
  }

  const ledgerExistsResult = await pool.query<{ exists: boolean }>(
    "SELECT to_regclass('atlas_ops.schema_migrations') IS NOT NULL AS \"exists\""
  );
  if (!ledgerExistsResult.rows[0]?.exists) {
    issues.push("Atlas migration ledger is missing.");
  } else {
    const ledgerResult = await pool.query<{ id: string; checksum: string }>(
      "SELECT id, checksum FROM atlas_ops.schema_migrations"
    );
    const applied = new Map(ledgerResult.rows.map((row) => [row.id, row.checksum]));
    for (const source of sources) {
      const recordedChecksum = applied.get(source.id);
      if (!recordedChecksum) {
        issues.push(`Managed migration is not recorded: ${source.id}`);
      } else if (recordedChecksum !== source.checksum) {
        issues.push(`Managed migration checksum changed after application: ${source.id}`);
      }
    }
  }

  return { ready: issues.length === 0, issues };
}
