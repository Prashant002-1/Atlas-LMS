# Atlas YC demo on Google Cloud

This is the operational source of truth for the temporary Atlas YC demo at
`https://demo.atlas-lms.com`. It records the live resource inventory, security
boundaries, rebuild sequence, deployment procedure, verification gates,
rollback path, and retirement steps.

Do not put passwords, API keys, exported environment files, database dumps, or
service-account keys in this document or anywhere else in Git.

## Current status and history

| Item | Current reference |
| --- | --- |
| Public origin | `https://demo.atlas-lms.com` |
| Root site | `atlas-lms.com` and `www.atlas-lms.com` remain on Vercel |
| Google Cloud project | `atlas-yc2026fall` |
| Named gcloud configuration | `atlas-yc2026fall` |
| Region and zone | `us-central1`, `us-central1-a` |
| Deployment PR | [#50](https://github.com/Prashant002-1/Atlas-LMS/pull/50) |
| Merge commit | [`bd5b052`](https://github.com/Prashant002-1/Atlas-LMS/commit/bd5b0527ba7ecef03d2755794d180d5a16df38e8) |
| Live source commit | [`67e981e`](https://github.com/Prashant002-1/Atlas-LMS/commit/67e981efc26ea8eaaa6773fffd72e3a5a6869362) |
| Cloud Build | `9d7bb320-8526-4792-80e0-c0d2a4ded5ee` |
| Live image tag | `us-central1-docker.pkg.dev/atlas-yc2026fall/atlas/atlas:67e981e` |
| Live image digest | `sha256:17c36658b0d9fd9afb9400b7d2e3c1d2be5759eeaad9818785bb40a689ce1be2` |

The GitHub PR is history and review evidence. It does not serve production.
The VM serves the pinned Artifact Registry image named in `/opt/atlas/.env`.
Merging or deleting a branch does not redeploy or stop that image.

## Architecture

The deployment intentionally uses one long-lived Compute Engine VM instead of
a request-scoped serverless runtime. The VM runs three Docker Compose services:

1. Caddy terminates TLS, adds security headers, and blocks public Workflow
   internals.
2. Atlas runs the Next.js standalone production server and the embedded
   Workflow worker.
3. Cloud SQL Auth Proxy connects the private Docker network to Cloud SQL by
   using the VM's attached Google service account.

Atlas application data and Workflow queue/run data use separate databases on
one private PostgreSQL 16 instance. The application has no public database
address and stores no durable state on the web container filesystem.

The exact hosting decision and future code-execution boundary are recorded in
[ADR 0018](../adr/0018-gcp-demo-hosting-and-compute-boundary.md).

## Live resource inventory

| Layer | Resource |
| --- | --- |
| VPC | `atlas-demo-vpc` |
| Subnet | `atlas-demo-us-central1`, `10.20.0.0/24`, Private Google Access enabled |
| Managed service range | `atlas-google-managed`, `10.102.0.0/16` |
| Private service peering | `servicenetworking-googleapis-com` |
| Web firewall | `atlas-demo-web`, TCP 80/443 and UDP 443 to tag `atlas-demo-web` |
| SSH firewall | `atlas-demo-iap-ssh`, TCP 22 from `35.235.240.0/20` to tag `atlas-demo-ssh` |
| Static address | `atlas-demo-ip`, `35.202.247.237` |
| VM | `atlas-demo-1`, `e2-standard-4`, Debian 12, 40 GB balanced disk |
| VM service account | `atlas-demo-vm@atlas-yc2026fall.iam.gserviceaccount.com` |
| Artifact Registry | `us-central1-docker.pkg.dev/atlas-yc2026fall/atlas` |
| Cloud SQL | `atlas-demo-pg`, PostgreSQL 16, `db-custom-2-7680`, private IP `10.102.0.3` |
| Application database/user | `atlas` / `atlas_app` |
| Workflow database/user | `atlas_workflow` / `atlas_workflow` |
| Uptime check | `atlas-yc-demo-health-t-Qsxddff68`, every 60 seconds |
| Alert policy | `16433051378267280275`, `Atlas YC demo unavailable` |

Cloud SQL is zonal and has a 20 GB SSD with automatic growth, seven retained
backups, seven days of transaction logs, and point-in-time recovery. This is a
temporary demo configuration, not a high-availability production topology.

The VM uses Shielded VM secure boot, vTPM, integrity monitoring, OS Login,
project SSH-key blocking, and IAP-only SSH. Its service account has these
project roles:

- `roles/artifactregistry.reader`
- `roles/cloudsql.client`
- `roles/logging.logWriter`
- `roles/monitoring.metricWriter`
- `roles/secretmanager.secretAccessor`

The Secret Manager accessor role is currently project-wide. Restrict it to the
named secrets before turning this temporary project into a long-lived
environment.

## Repository-owned deployment assets

- [`Dockerfile`](../../Dockerfile) builds the Next.js standalone image.
- [`infra/gcp/docker-compose.yml`](../../infra/gcp/docker-compose.yml) owns the
  three runtime services.
- [`infra/gcp/Caddyfile`](../../infra/gcp/Caddyfile) owns public ingress.
- [`infra/gcp/install-host.sh`](../../infra/gcp/install-host.sh) installs Docker
  and the Google Cloud Ops Agent.
- [`infra/gcp/deploy-host.sh`](../../infra/gcp/deploy-host.sh) pulls and starts
  the pinned image.
- [`scripts/provision-yc-access.ts`](../../scripts/provision-yc-access.ts)
  disables seeded passwords and enables exactly the two YC accounts.
- [`scripts/smoke.ts`](../../scripts/smoke.ts) verifies public routes and both
  actors.
- [`scripts/smoke-workflow.ts`](../../scripts/smoke-workflow.ts) performs a real
  durable model run.

## Secret and credential handling

Secret Manager contains these names. Their values must never be printed or
committed.

| Secret | Purpose | Present in running Atlas environment |
| --- | --- | --- |
| `atlas-auth-secret` | Auth.js signing secret | Yes |
| `atlas-db-password` | `atlas_app` database password | Inside `DATABASE_URL` |
| `atlas-workflow-db-password` | Workflow database password | Inside `WORKFLOW_POSTGRES_URL` |
| `atlas-postgres-password` | Cloud SQL administrator password | No |
| `atlas-yc-password` | One-time YC account provisioning and operator handoff | No |
| `atlas-anthropic-api-key` | Chat and structured model access | Yes |
| `atlas-gemini-api-key` | Embeddings and voice transcription | Yes |
| `atlas-exa-api-key` | Bounded public web search | Yes |

Secret Manager is the source of truth, but the application does not fetch a
secret on every request. Deployment materializes the required values into
`/etc/atlas/atlas.env` on the VM. The directory is root-owned `0700`; the file
is root-owned `0600`. Docker Compose passes the file to Atlas at container
start. `.gitignore` and `.dockerignore` exclude local environment files, and
the production image contains no `.env` file.

The YC password is used only by `npm run demo:provision-yc`. Atlas stores a
salted `scrypt` hash in PostgreSQL. The plaintext password is not part of the
running container environment. Only these accounts retain password hashes:

- `yc-instructor@atlas-lms.com`
- `yc-student@atlas-lms.com`

The runtime file contains these non-secret settings in addition to the secret
values and database URLs:

```dotenv
NODE_ENV=production
PORT=3000
PG_POOL_MAX=10
AUTH_URL=https://demo.atlas-lms.com
AUTH_TRUST_HOST=true
ATLAS_PUBLIC_APP_URL=https://demo.atlas-lms.com
ATLAS_ALLOWED_LOGIN_EMAILS=yc-instructor@atlas-lms.com,yc-student@atlas-lms.com
ATLAS_CHAT_PROVIDER=anthropic
ATLAS_CHAT_MODEL=claude-opus-5
ATLAS_STRUCTURED_MODEL=claude-opus-5
ATLAS_EMBEDDING_PROVIDER=google
ATLAS_EMBEDDING_MODEL=gemini-embedding-002
ATLAS_EMBEDDING_DIMS=1536
WORKFLOW_TARGET_WORLD=@workflow/world-postgres
WORKFLOW_POSTGRES_JOB_PREFIX=atlas_
WORKFLOW_POSTGRES_WORKER_CONCURRENCY=8
WORKFLOW_POSTGRES_MAX_POOL_SIZE=10
WORKFLOW_LOCAL_BASE_URL=http://127.0.0.1:3000
```

### Rotate a secret

1. Add a new enabled version without disabling the old version:

   ```bash
   printf '%s' "$ATLAS_NEW_SECRET_VALUE" | gcloud secrets versions add SECRET_NAME \
     --project=atlas-yc2026fall \
     --data-file=-
   ```

2. Rebuild a root-readable runtime environment file in a private temporary
   directory. Fetch each needed value with `gcloud secrets versions access
   latest`. Do not enable shell tracing and do not put the values in command
   arguments, terminal output, or Git.
3. Copy the file through IAP to the VM, then install it explicitly:

   ```bash
   gcloud compute scp "$ATLAS_RUNTIME_ENV_FILE" \
     atlas-demo-1:/tmp/atlas.env \
     --project=atlas-yc2026fall \
     --zone=us-central1-a \
     --tunnel-through-iap

   gcloud compute ssh atlas-demo-1 \
     --project=atlas-yc2026fall \
     --zone=us-central1-a \
     --tunnel-through-iap \
     --command='sudo install -o root -g root -m 0600 /tmp/atlas.env /etc/atlas/atlas.env && rm /tmp/atlas.env && cd /opt/atlas && sudo docker compose up -d --force-recreate atlas'
   ```

4. Run the public smoke tests. Disable the old Secret Manager version only
   after the application passes.

Changing a Secret Manager version alone does not refresh a running container.

The coordinated action depends on the secret:

- For `atlas-anthropic-api-key`, `atlas-gemini-api-key`, `atlas-exa-api-key`,
  or `atlas-auth-secret`, rebuild `/etc/atlas/atlas.env` and recreate the Atlas
  container. Rotating `atlas-auth-secret` invalidates existing sessions.
- For `atlas-db-password` or `atlas-workflow-db-password`, change the matching
  Cloud SQL user's password and rebuild `/etc/atlas/atlas.env` as one
  maintenance action, then recreate Atlas. Expect a brief interruption while
  the database password and application configuration are synchronized.
- For `atlas-postgres-password`, change the Cloud SQL `postgres` user's
  password. It is an operator-only bootstrap secret and is not part of the
  running Atlas environment.
- For `atlas-yc-password`, add the new Secret Manager version and rerun
  `npm run demo:provision-yc` from the disposable setup container. It is not
  part of the running Atlas environment.

## Rebuild an empty project

These commands recreate the current topology. They assume the Google Cloud
project already exists, has billing attached, and the operator has sufficient
project and billing authority.

### 1. Select the project

```bash
export ATLAS_GCP_CONFIG=atlas-yc2026fall
export ATLAS_GCP_PROJECT=atlas-yc2026fall
export ATLAS_GCP_REGION=us-central1
export ATLAS_GCP_ZONE=us-central1-a

gcloud config configurations describe "$ATLAS_GCP_CONFIG" >/dev/null 2>&1 || \
  gcloud config configurations create "$ATLAS_GCP_CONFIG"
gcloud config configurations activate "$ATLAS_GCP_CONFIG"
gcloud config set project "$ATLAS_GCP_PROJECT"
gcloud config set compute/region "$ATLAS_GCP_REGION"
gcloud config set compute/zone "$ATLAS_GCP_ZONE"
```

### 2. Enable APIs

```bash
gcloud services enable \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  compute.googleapis.com \
  iam.googleapis.com \
  iap.googleapis.com \
  logging.googleapis.com \
  monitoring.googleapis.com \
  secretmanager.googleapis.com \
  servicenetworking.googleapis.com \
  sqladmin.googleapis.com \
  --project="$ATLAS_GCP_PROJECT"
```

### 3. Create private networking

```bash
gcloud compute networks create atlas-demo-vpc \
  --project="$ATLAS_GCP_PROJECT" \
  --subnet-mode=custom

gcloud compute networks subnets create atlas-demo-us-central1 \
  --project="$ATLAS_GCP_PROJECT" \
  --network=atlas-demo-vpc \
  --region="$ATLAS_GCP_REGION" \
  --range=10.20.0.0/24 \
  --enable-private-ip-google-access

gcloud compute addresses create atlas-google-managed \
  --project="$ATLAS_GCP_PROJECT" \
  --global \
  --purpose=VPC_PEERING \
  --prefix-length=16 \
  --network=atlas-demo-vpc

gcloud services vpc-peerings connect \
  --project="$ATLAS_GCP_PROJECT" \
  --service=servicenetworking.googleapis.com \
  --ranges=atlas-google-managed \
  --network=atlas-demo-vpc
```

Create only the ingress used by the demo VM:

```bash
gcloud compute firewall-rules create atlas-demo-web \
  --project="$ATLAS_GCP_PROJECT" \
  --network=atlas-demo-vpc \
  --direction=INGRESS \
  --allow=tcp:80,tcp:443,udp:443 \
  --source-ranges=0.0.0.0/0 \
  --target-tags=atlas-demo-web

gcloud compute firewall-rules create atlas-demo-iap-ssh \
  --project="$ATLAS_GCP_PROJECT" \
  --network=atlas-demo-vpc \
  --direction=INGRESS \
  --allow=tcp:22 \
  --source-ranges=35.235.240.0/20 \
  --target-tags=atlas-demo-ssh

gcloud compute addresses create atlas-demo-ip \
  --project="$ATLAS_GCP_PROJECT" \
  --region="$ATLAS_GCP_REGION"
```

Do not attach the VM to the default VPC. The current project still has a
default VPC, but Atlas does not use it.

### 4. Create identities and the image repository

```bash
gcloud iam service-accounts create atlas-demo-vm \
  --project="$ATLAS_GCP_PROJECT" \
  --display-name='Atlas demo VM'

for ATLAS_GCP_ROLE in \
  roles/artifactregistry.reader \
  roles/cloudsql.client \
  roles/logging.logWriter \
  roles/monitoring.metricWriter \
  roles/secretmanager.secretAccessor
do
  gcloud projects add-iam-policy-binding "$ATLAS_GCP_PROJECT" \
    --member="serviceAccount:atlas-demo-vm@${ATLAS_GCP_PROJECT}.iam.gserviceaccount.com" \
    --role="$ATLAS_GCP_ROLE"
done

gcloud artifacts repositories create atlas \
  --project="$ATLAS_GCP_PROJECT" \
  --location="$ATLAS_GCP_REGION" \
  --repository-format=docker \
  --description='Atlas application images'
```

Cloud Build currently runs as the project's default Compute Engine service
account. It requires Artifact Registry Writer. The live project also grants
that default account Editor from project bootstrap. Do not reproduce the broad
Editor grant for a long-lived environment.

```bash
export ATLAS_GCP_PROJECT_NUMBER="$(gcloud projects describe "$ATLAS_GCP_PROJECT" --format='value(projectNumber)')"

gcloud projects add-iam-policy-binding "$ATLAS_GCP_PROJECT" \
  --member="serviceAccount:${ATLAS_GCP_PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role=roles/artifactregistry.writer
```

### 5. Create Secret Manager entries

Create the eight secret containers first:

```bash
for ATLAS_SECRET_NAME in \
  atlas-anthropic-api-key \
  atlas-auth-secret \
  atlas-db-password \
  atlas-exa-api-key \
  atlas-gemini-api-key \
  atlas-postgres-password \
  atlas-workflow-db-password \
  atlas-yc-password
do
  gcloud secrets create "$ATLAS_SECRET_NAME" \
    --project="$ATLAS_GCP_PROJECT" \
    --replication-policy=automatic
done
```

Add generated URL-safe database/auth values and operator-supplied provider
keys as version 1. Supply the YC password securely. Never paste values into a
checked-in shell script.

Generate the platform and database secrets directly into Secret Manager:

```bash
for ATLAS_GENERATED_SECRET in \
  atlas-auth-secret \
  atlas-db-password \
  atlas-postgres-password \
  atlas-workflow-db-password
do
  openssl rand -hex 32 | gcloud secrets versions add "$ATLAS_GENERATED_SECRET" \
    --project="$ATLAS_GCP_PROJECT" \
    --data-file=-
done
```

Add the Anthropic, Gemini, Exa, and YC values through a private prompt or other
non-logging input. Use `printf '%s'`, not `echo`, when piping a supplied value
to `gcloud secrets versions add`, then unset the shell variable.

### 6. Create Cloud SQL

```bash
gcloud sql instances create atlas-demo-pg \
  --project="$ATLAS_GCP_PROJECT" \
  --database-version=POSTGRES_16 \
  --region="$ATLAS_GCP_REGION" \
  --tier=db-custom-2-7680 \
  --availability-type=zonal \
  --storage-type=SSD \
  --storage-size=20 \
  --storage-auto-increase \
  --network=atlas-demo-vpc \
  --no-assign-ip \
  --backup-start-time=08:00 \
  --enable-point-in-time-recovery \
  --retained-backups-count=7 \
  --retained-transaction-log-days=7

gcloud sql databases create atlas \
  --project="$ATLAS_GCP_PROJECT" \
  --instance=atlas-demo-pg

gcloud sql databases create atlas_workflow \
  --project="$ATLAS_GCP_PROJECT" \
  --instance=atlas-demo-pg
```

Create `atlas_app` and `atlas_workflow`, and set the `postgres` administrator
password, using the corresponding Secret Manager values. Keep shell tracing
off and unset local password variables immediately after each `gcloud sql
users` call.

```bash
ATLAS_POSTGRES_PASSWORD="$(gcloud secrets versions access latest --project="$ATLAS_GCP_PROJECT" --secret=atlas-postgres-password)"
gcloud sql users set-password postgres \
  --project="$ATLAS_GCP_PROJECT" \
  --instance=atlas-demo-pg \
  --password="$ATLAS_POSTGRES_PASSWORD"
unset ATLAS_POSTGRES_PASSWORD

ATLAS_APP_DB_PASSWORD="$(gcloud secrets versions access latest --project="$ATLAS_GCP_PROJECT" --secret=atlas-db-password)"
gcloud sql users create atlas_app \
  --project="$ATLAS_GCP_PROJECT" \
  --instance=atlas-demo-pg \
  --password="$ATLAS_APP_DB_PASSWORD"
unset ATLAS_APP_DB_PASSWORD

ATLAS_WORKFLOW_DB_PASSWORD="$(gcloud secrets versions access latest --project="$ATLAS_GCP_PROJECT" --secret=atlas-workflow-db-password)"
gcloud sql users create atlas_workflow \
  --project="$ATLAS_GCP_PROJECT" \
  --instance=atlas-demo-pg \
  --password="$ATLAS_WORKFLOW_DB_PASSWORD"
unset ATLAS_WORKFLOW_DB_PASSWORD
```

### 7. Create and prepare the VM

```bash
gcloud compute instances create atlas-demo-1 \
  --project="$ATLAS_GCP_PROJECT" \
  --zone="$ATLAS_GCP_ZONE" \
  --machine-type=e2-standard-4 \
  --subnet=atlas-demo-us-central1 \
  --address=atlas-demo-ip \
  --network-tier=PREMIUM \
  --service-account="atlas-demo-vm@${ATLAS_GCP_PROJECT}.iam.gserviceaccount.com" \
  --scopes=cloud-platform \
  --tags=atlas-demo-web,atlas-demo-ssh \
  --boot-disk-size=40GB \
  --boot-disk-type=pd-balanced \
  --image-family=debian-12 \
  --image-project=debian-cloud \
  --shielded-secure-boot \
  --shielded-vtpm \
  --shielded-integrity-monitoring \
  --metadata=enable-oslogin=TRUE,block-project-ssh-keys=TRUE
```

Copy and run the host installer through IAP:

```bash
gcloud compute scp infra/gcp/install-host.sh \
  atlas-demo-1:/tmp/install-host.sh \
  --project="$ATLAS_GCP_PROJECT" \
  --zone="$ATLAS_GCP_ZONE" \
  --tunnel-through-iap

gcloud compute ssh atlas-demo-1 \
  --project="$ATLAS_GCP_PROJECT" \
  --zone="$ATLAS_GCP_ZONE" \
  --tunnel-through-iap \
  --command='sudo bash /tmp/install-host.sh && rm /tmp/install-host.sh'
```

Copy the runtime assets through IAP and install them as root:

```bash
gcloud compute scp \
  infra/gcp/docker-compose.yml \
  infra/gcp/Caddyfile \
  infra/gcp/deploy-host.sh \
  atlas-demo-1:/tmp/ \
  --project="$ATLAS_GCP_PROJECT" \
  --zone="$ATLAS_GCP_ZONE" \
  --tunnel-through-iap

gcloud compute ssh atlas-demo-1 \
  --project="$ATLAS_GCP_PROJECT" \
  --zone="$ATLAS_GCP_ZONE" \
  --tunnel-through-iap \
  --command='sudo install -o root -g root -m 0644 /tmp/docker-compose.yml /opt/atlas/docker-compose.yml && sudo install -o root -g root -m 0644 /tmp/Caddyfile /opt/atlas/Caddyfile && sudo install -o root -g root -m 0755 /tmp/deploy-host.sh /opt/atlas/deploy-host.sh && rm /tmp/docker-compose.yml /tmp/Caddyfile /tmp/deploy-host.sh'
```

Keep `/opt/atlas/.env` root-owned `0600` with only these non-secret values:

```dotenv
ATLAS_IMAGE=us-central1-docker.pkg.dev/atlas-yc2026fall/atlas/atlas:IMAGE_TAG
CLOUD_SQL_CONNECTION_NAME=atlas-yc2026fall:us-central1:atlas-demo-pg
ATLAS_DOMAIN=demo.atlas-lms.com
```

Build `/etc/atlas/atlas.env` from Secret Manager as described above. Database
URLs use `cloud-sql-proxy:5432`, the Docker Compose service name, not the Cloud
SQL private address.

The secret-bearing entries have this shape:

```dotenv
AUTH_SECRET=<atlas-auth-secret>
DATABASE_URL=postgres://atlas_app:<atlas-db-password>@cloud-sql-proxy:5432/atlas
WORKFLOW_POSTGRES_URL=postgres://atlas_workflow:<atlas-workflow-db-password>@cloud-sql-proxy:5432/atlas_workflow
ANTHROPIC_API_KEY=<atlas-anthropic-api-key>
GEMINI_API_KEY=<atlas-gemini-api-key>
GOOGLE_GENERATIVE_AI_API_KEY=<atlas-gemini-api-key>
EXA_API_KEY=<atlas-exa-api-key>
```

The generated database passwords are hexadecimal so they are safe in URL user
information without additional encoding.

### 8. Build a pinned image

Run the repository gate first, then use the full Git commit as provenance and
the short commit as the readable image tag:

```bash
npm run verify
export ATLAS_IMAGE_TAG="$(git rev-parse --short=7 HEAD)"

gcloud builds submit . \
  --project="$ATLAS_GCP_PROJECT" \
  --region="$ATLAS_GCP_REGION" \
  --tag="${ATLAS_GCP_REGION}-docker.pkg.dev/${ATLAS_GCP_PROJECT}/atlas/atlas:${ATLAS_IMAGE_TAG}"
```

Record the build id, image tag, and immutable digest in the current-status
table whenever the live image changes.

### 9. Bootstrap databases and seed the demo

The production image is intentionally small and does not include Drizzle or
the TypeScript setup scripts. Create a one-off setup workspace from the exact
commit being deployed:

```bash
export ATLAS_SOURCE_ARCHIVE="$(mktemp -t atlas-source.XXXXXX.tar.gz)"
git archive --format=tar.gz --output="$ATLAS_SOURCE_ARCHIVE" HEAD

gcloud compute scp "$ATLAS_SOURCE_ARCHIVE" \
  atlas-demo-1:/tmp/atlas-source.tar.gz \
  --project="$ATLAS_GCP_PROJECT" \
  --zone="$ATLAS_GCP_ZONE" \
  --tunnel-through-iap

rm "$ATLAS_SOURCE_ARCHIVE"
```

On the VM, start only Cloud SQL Proxy, extract the source into
`/opt/atlas/setup`, and run setup commands from a disposable Node container on
the Compose private network. The setup container receives the root-owned
runtime environment file but is removed after the commands finish.

```bash
gcloud compute ssh atlas-demo-1 \
  --project="$ATLAS_GCP_PROJECT" \
  --zone="$ATLAS_GCP_ZONE" \
  --tunnel-through-iap \
  --command='sudo install -d -o root -g root -m 0755 /opt/atlas/setup && sudo tar -xzf /tmp/atlas-source.tar.gz -C /opt/atlas/setup && rm /tmp/atlas-source.tar.gz && cd /opt/atlas && sudo docker compose up -d cloud-sql-proxy'
```

1. Enable the `vector` extension in `atlas` using the `postgres` administrator
   through a temporary root-owned password file and a disposable
   `postgres:16-alpine` container on `atlas_private`.
2. Run `npm run db:push -- --force` once for a brand-new empty database. The
   checked-in migrations are incremental deltas, not a complete base schema.
3. Run `npx --package=@workflow/world-postgres bootstrap` with
   `WORKFLOW_POSTGRES_URL` set.
4. Run `npm run db:seed` once.
5. Run `npm run demo:provision-yc` once with `ATLAS_YC_PASSWORD` supplied from a
   temporary root-owned file. Do not add it to `/etc/atlas/atlas.env`.
6. Remove the temporary administrator and YC password files.

For the extension step, create a temporary root-owned environment file on the
VM containing only `PGPASSWORD` from `atlas-postgres-password`, then run:

```bash
sudo docker run --rm \
  --network atlas_private \
  --env-file /run/atlas-postgres.env \
  postgres:16-alpine \
  psql -h cloud-sql-proxy -U postgres -d atlas \
  -c 'CREATE EXTENSION IF NOT EXISTS vector;'
```

Remove `/run/atlas-postgres.env` immediately after the command succeeds.

The main setup invocation is:

```bash
sudo docker run --rm \
  --network atlas_private \
  --env-file /etc/atlas/atlas.env \
  --volume /opt/atlas/setup:/work \
  --workdir /work \
  node:24-alpine \
  sh -lc 'apk add --no-cache libc6-compat && npm ci && npm run db:push -- --force && npx --package=@workflow/world-postgres bootstrap && npm run db:seed'
```

Then run `demo:provision-yc` in the same disposable setup container with a
second temporary `--env-file` that contains only `ATLAS_YC_PASSWORD`.

After setup succeeds, start the full application:

```bash
gcloud compute ssh atlas-demo-1 \
  --project="$ATLAS_GCP_PROJECT" \
  --zone="$ATLAS_GCP_ZONE" \
  --tunnel-through-iap \
  --command='cd /opt/atlas && sudo ./deploy-host.sh'
```

### 10. DNS and TLS

Squarespace is authoritative for `atlas-lms.com`. Add exactly one custom DNS
record:

| Type | Name | Data |
| --- | --- | --- |
| A | `demo` | `35.202.247.237` |

Do not change the root A records, the `www` CNAME, or Google Workspace records.
Caddy obtains and renews the certificate automatically after public DNS
resolves. Confirm both public resolvers and TLS:

```bash
dig +short @8.8.8.8 demo.atlas-lms.com A
dig +short @1.1.1.1 demo.atlas-lms.com A
curl --fail https://demo.atlas-lms.com/api/health
```

### 11. Monitoring

Create the one-minute HTTPS health check:

```bash
gcloud monitoring uptime create 'Atlas YC demo health' \
  --project="$ATLAS_GCP_PROJECT" \
  --resource-type=uptime-url \
  --resource-labels=host=demo.atlas-lms.com,project_id=atlas-yc2026fall \
  --protocol=https \
  --port=443 \
  --path=/api/health \
  --request-method=get \
  --validate-ssl=true \
  --status-codes=200 \
  --matcher-type=matches-json-path \
  --json-path='$.ok' \
  --json-path-matcher-type=exact-match \
  --matcher-content=true \
  --period=1 \
  --timeout=10 \
  --user-labels=environment=demo,app=atlas
```

Use the returned uptime-check id in the alert policy filter:

```bash
gcloud monitoring policies create \
  --project="$ATLAS_GCP_PROJECT" \
  --display-name='Atlas YC demo unavailable' \
  --condition-display-name='Public health check failed' \
  --condition-filter='metric.type="monitoring.googleapis.com/uptime_check/check_passed" AND resource.type="uptime_url" AND metric.label.check_id="UPTIME_CHECK_ID"' \
  --duration=120s \
  --if='< 1' \
  --trigger-count=1 \
  --combiner=OR \
  --user-labels=environment=demo,app=atlas \
  --documentation='Atlas YC demo health checks are failing. Check the public health route, atlas-demo-1, Caddy, Atlas, Cloud SQL Auth Proxy, and Cloud SQL.'
```

The current policy has no external notification channel. It creates incidents
in Cloud Monitoring but does not send email or Slack notifications. Billing
alerts are managed separately at the billing-account level.

## Deploy an application update

1. Merge the desired code into `main` and run `npm run verify`.
2. Build a new commit-tagged image with Cloud Build.
3. Update only `ATLAS_IMAGE` in `/opt/atlas/.env`.
4. Run `/opt/atlas/deploy-host.sh` through IAP.
5. Run the public route and Workflow smokes.
6. Record the new tag, digest, build id, and Git commit in this runbook.

The deployment is manual. A GitHub merge does not trigger Cloud Build or change
the VM.

## Roll back the application

For a code-only rollback, set `ATLAS_IMAGE` in `/opt/atlas/.env` to a previously
verified tag or immutable digest, then run `deploy-host.sh`. Confirm health and
both YC sign-ins.

Do not roll application code behind an incompatible database change. Cloud SQL
schema rollback requires a deliberate forward fix or a restore into a separate
instance. Never overwrite the live database merely to match an older image.

## Production verification

Run these checks after initial deployment, a secret rotation, an image update,
or a rollback.

### Public health and boundary

```bash
curl --fail https://demo.atlas-lms.com/api/health
curl --silent --output /dev/null --write-out '%{http_code}\n' \
  https://demo.atlas-lms.com/.well-known/workflow/v1/flow
```

Expected results are a healthy JSON response and `404` for the Workflow route.

### Both YC actors

```bash
ATLAS_BASE_URL=https://demo.atlas-lms.com \
ATLAS_SMOKE_INSTRUCTOR_EMAIL=yc-instructor@atlas-lms.com \
ATLAS_SMOKE_STUDENT_EMAIL=yc-student@atlas-lms.com \
ATLAS_SMOKE_PASSWORD="$(gcloud secrets versions access latest --project=atlas-yc2026fall --secret=atlas-yc-password)" \
npm run smoke
```

### Durable Workflow and provider path

This check makes a real model request and creates a durable instructor thread:

```bash
ATLAS_BASE_URL=https://demo.atlas-lms.com \
ATLAS_SMOKE_INSTRUCTOR_EMAIL=yc-instructor@atlas-lms.com \
ATLAS_SMOKE_PASSWORD="$(gcloud secrets versions access latest --project=atlas-yc2026fall --secret=atlas-yc-password)" \
npm run smoke:workflow
```

### Host state

```bash
gcloud compute ssh atlas-demo-1 \
  --project=atlas-yc2026fall \
  --zone=us-central1-a \
  --tunnel-through-iap \
  --command='sudo docker compose -f /opt/atlas/docker-compose.yml ps && free -h && df -h /'
```

Do not print the container environment or the contents of
`/etc/atlas/atlas.env` while diagnosing.

## Backups and recovery

List automated backups before a risky database operation:

```bash
gcloud sql backups list \
  --project=atlas-yc2026fall \
  --instance=atlas-demo-pg
```

Create an on-demand backup when a planned operation warrants one:

```bash
gcloud sql backups create \
  --project=atlas-yc2026fall \
  --instance=atlas-demo-pg \
  --description='Before planned Atlas database operation'
```

Prefer point-in-time recovery into a separate instance for investigation.
Validate the restored schema and both actor paths before treating a recovery as
complete. Caddy certificates and containers are replaceable; Cloud SQL is the
durable application and Workflow state.

## Known limitations and follow-up

- Document ingestion is not configured. The bounded worker is tracked in
  [issue #49](https://github.com/Prashant002-1/Atlas-LMS/issues/49).
- General code execution is not implemented. The isolated platform capability
  is tracked in [issue #48](https://github.com/Prashant002-1/Atlas-LMS/issues/48).
- Code execution must be a separate disposable sandbox service. Never mount
  the Docker socket into Atlas and never pass Atlas/provider/database secrets
  into user code.
- The VM and Cloud SQL instance are zonal. There is no multi-zone failover.
- The uptime alert has no external notification channel.
- The default Compute Engine service account retains a broad Editor grant from
  project bootstrap. Remove it before treating the project as long-lived.

## Retire the demo

Do not retire the project until the YC demo window is over and any desired data
has been exported.

1. Decide whether the Cloud SQL data needs an encrypted export or retained
   backup.
2. In Squarespace, remove only the `demo` A record. Preserve root, `www`, Google
   Workspace, and every unrelated record.
3. Revoke or rotate Anthropic, Gemini, and Exa keys if they will no longer be
   used. Deleting the Google Cloud project does not revoke provider keys.
4. Confirm the exact target, then schedule deletion of only this project:

   ```bash
   gcloud projects delete atlas-yc2026fall
   ```

5. Verify that `atlas-lms.com` and `www.atlas-lms.com` still resolve to the
   Vercel site.
