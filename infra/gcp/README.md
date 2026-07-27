# Atlas YC demo deployment

Atlas runs as one long-lived Next.js process on Compute Engine. Caddy owns TLS,
and Cloud SQL Auth Proxy connects the app to a private PostgreSQL instance.
The app and Workflow runtime use separate databases on that instance.

## Runtime boundaries

- `demo.atlas-lms.com` is the only public app origin.
- Caddy exposes Atlas and blocks `/.well-known/workflow/*` from the internet.
- The embedded Workflow worker reaches those routes over loopback and stores
  queue and run state in `atlas_workflow`.
- Cloud SQL has no public IP. The VM authenticates with its attached service
  account, so no Google service-account key is stored on disk.
- `/etc/atlas/atlas.env` is root-readable and is populated from Secret Manager.
- Only the two YC demo users retain password hashes after provisioning.

## Deployment order

1. Build and push a pinned Atlas image to Artifact Registry.
2. Run Drizzle migrations against the `atlas` database.
3. Bootstrap the Workflow schema in `atlas_workflow`.
4. Seed the demo tenant once, then run `npm run demo:provision-yc` once.
5. Install the host, place the compose file, Caddyfile, and root-owned env file,
   then run `deploy-host.sh`.
6. Point the `demo` DNS A record at the VM's static address.
7. Verify health, both actor journeys, persistence, workflow execution, and that
   non-YC accounts cannot sign in.

## Future code execution

Do not mount the Docker socket into Atlas. Code execution should be a separate
service with its own service account, network policy, quotas, and disposable
sandbox runtime. Atlas should submit bounded jobs to that service and store only
job metadata and results in its application database.
