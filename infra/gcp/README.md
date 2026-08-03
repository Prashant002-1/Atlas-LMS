# Atlas YC demo deployment

Atlas runs as one long-lived Next.js process on Compute Engine. Caddy owns TLS,
and Cloud SQL Auth Proxy connects the app to a private PostgreSQL instance.
The app and Workflow runtime use separate databases on that instance.

The complete live resource inventory, rebuild procedure, secret rotation,
database bootstrap, monitoring, verification, rollback, recovery, and teardown
runbook is in [`docs/deployment/gcp-yc-demo.md`](../../docs/deployment/gcp-yc-demo.md).
The hosting decision and future compute boundary are in
[`ADR 0018`](../../docs/adr/0018-gcp-demo-hosting-and-compute-boundary.md).

## Runtime boundaries

- `demo.atlas-lms.com` is the only public app origin.
- Caddy exposes Atlas and blocks `/.well-known/workflow/*` from the internet.
- The embedded Workflow worker reaches those routes over loopback and stores
  queue and run state in `atlas_workflow`.
- Cloud SQL has no public IP. The VM authenticates with its attached service
  account, so no Google service-account key is stored on disk.
- `/etc/atlas/atlas.env` is root-readable and is populated from Secret Manager.
- YC identities and SPC login aliases retain independent password hashes; the
  aliases resolve to the same seeded identities and live records.

## Deployment order

1. Build and push a pinned Atlas image to Artifact Registry.
2. For a new empty database, enable the Cloud SQL `vector` extension and run
   `npm run db:push -- --force` once to create the complete current schema. The
   checked-in SQL migrations are incremental deltas and are only for an
   already-initialized database.
3. Bootstrap the Workflow schema in `atlas_workflow`.
4. Seed the demo tenant once, run `npm run demo:provision-yc`, then run
   `npm run demo:provision-spc` with its independent password to add the two
   shared-state SPC login aliases.
5. Install the host, place the compose file, Caddyfile, and root-owned env file,
   then run `deploy-host.sh`.
6. Point the `demo` DNS A record at the VM's static address.
7. Verify health, both YC and SPC actor journeys, persistence, workflow
   execution, and that non-allowlisted accounts cannot sign in.

## Future code execution

Do not mount the Docker socket into Atlas. Code execution should be a separate
service with its own service account, network policy, quotas, and disposable
sandbox runtime. Atlas should submit bounded jobs to that service and store only
job metadata and results in its application database.
