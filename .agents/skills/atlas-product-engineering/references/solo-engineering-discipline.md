# Atlas Solo Engineering Discipline

## Externalize State Instead Of Remembering It

Atlas is too large for one developer to keep its operational state in memory. The solution is not more ceremony. Make every important state either executable, queryable, or recorded at its source.

Treat these as separate state planes:

1. Code: local commit, upstream commit, dirty files, and dependency lockfile.
2. Application database: schema release ledger, current contract, seed identities, and durable records.
3. Runtime: environment variables, Workflow storage, provider credentials, and running services.
4. Files: database references, private originals, object storage, and checked-in seed assets.
5. Deployment: exact source commit, immutable image digest, database release, health, and actor smokes.

Never infer that one plane is current because another is current. A healthy deployed image does not prove local `main` is healthy. A current Git checkout does not migrate a database. A file row does not prove its bytes exist.

## Use One Repeatable Local Entry Gate

Before product testing or normal development:

1. Inspect `git status --short --branch` and the local versus upstream commit.
2. Start the local Compose database.
3. Run the reviewed database upgrade path for an existing database.
4. Bootstrap Workflow when its storage is new or its runtime changes.
5. Run the read-only local readiness check.
6. Start Next.js only after readiness passes.

The `predev` hook should enforce this readiness boundary. A missing table, invalid database credential, absent Workflow schema, disabled demo identity, or missing seeded asset should fail before Next.js reports that it is ready.

Do not make readiness depend on a production provider key. Core local records and navigation must be testable without a model call. Report unavailable model-backed features separately and precisely.

## Treat Schema As A Release Contract

- Use `db:push` only to create a brand-new empty database. Never use it to update an existing database when it proposes unrelated drops, data loss, or constraint churn.
- Every change to an existing database needs reviewed SQL checked into `drizzle/` and an entry in the managed forward-migration list.
- Apply the same managed migrations locally, in staging, and in production. Do not invent environment-specific schema steps.
- Prefer additive, backward-compatible migrations before deploying code that reads the new shape.
- Mark destructive migrations explicitly. Require a reviewed backup and an explicit destructive flag before applying them.
- Record each applied migration and its checksum in the database. Never edit an applied migration; add a new forward migration.
- Make schema verification read-only. It should identify the exact missing or stale contract and the command that repairs it.
- Keep migration application separate from seeding. A schema upgrade must not silently replace user or demo records.

When the historical migration journal is incomplete, do not pretend it is authoritative. Establish a bounded managed baseline from reviewed idempotent migrations, ledger it, and make all future changes use that path.

## Audit Drift Across Boundaries

For a startup, login, document, or route failure, classify the failure before editing application behavior:

1. Credentials: can the process authenticate to the intended database and provider?
2. Schema: do the tables, columns, constraints, and Workflow relations expected by current code exist?
3. Identity and seed state: do the intended stable user IDs and password hashes still exist?
4. Durable bytes: does a file reference resolve to private originals, object storage, or a real seed asset?
5. Code: does the current request path still fail after the first four boundaries are current?

Repair the failing boundary. Do not weaken queries, hide server exceptions with generic UI errors, recreate users with new IDs, or migrate clouds to escape local drift.

After repairing one drift incident, inspect adjacent contracts that could have failed for the same reason. Use schema comparison and targeted data queries, not random route clicking.

## Keep Checkpoints Explicit

Use distinct names for distinct levels of confidence:

| Checkpoint | Evidence |
| --- | --- |
| Working copy | The change runs on the developer's current database. No broader claim. |
| Locally ready | Readiness passes, both demo actors can enter their main surfaces, and the affected record path works. |
| Repository verified | Typecheck, lint, tests, and production build pass through `npm run verify`. |
| Release candidate | The exact commit is intentional, dependencies are locked, schema changes are reviewed, and the worktree and upstream relationship are understood. |
| Deployed | The exact commit and immutable image are recorded, migrations are applied, health passes, and both actor smokes pass. |

Never collapse these into “latest” or “up to date.” State exactly which checkpoint has been reached.

## Use A Sustainable Solo Cadence

At the start of a work session:

- Read the current branch, upstream divergence, and dirty files.
- Run the local readiness gate before diagnosing product behavior.
- Choose one coherent outcome and keep unrelated work intact.

At a useful checkpoint:

- Run the smallest focused test while iterating.
- Run `npm run verify` when the coherent slice is complete.
- Review the diff and record the remaining next action in the active issue or task when stopping.
- Commit coherent changes separately from deployment. A commit is not a push, and a push is not a deployment.

Before deployment:

- Identify the exact source commit and compare it with the intended upstream branch.
- Back up before any destructive migration.
- Apply and verify the database release contract.
- Build an immutable image from that commit.
- Verify health, instructor login, student login, the changed record path, and Workflow when involved.
- Record commit, image tag, digest, migration state, and smoke result in the deployment source of truth.

This cadence is meant to reduce cognitive load. The commands and ledgers remember state so the developer can focus on the product.
