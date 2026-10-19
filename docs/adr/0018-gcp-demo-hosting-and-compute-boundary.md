# ADR-0018: Google Cloud demo hosting and compute boundary

Status: Accepted

## Context

Atlas needed a stable public demo environment that preserved its existing full-stack behavior:

- one long-lived Next.js process;
- durable Workflow execution and resumption;
- PostgreSQL application and queue state;
- seeded instructor and student records;
- server-owned model, embedding, and search credentials;
- predictable latency without request-lifetime or scale-to-zero behavior.

The static launch page is hosted separately on Vercel. Moving or rewriting that
site was not part of the demo. Atlas also expects future general code execution,
but running untrusted code inside the application process or by mounting the
host Docker socket would collapse the product and infrastructure security
boundaries.

The demo environment was temporary, credit-funded, and optimized for predictable
demo behavior rather than the lowest possible idle cost or permanent
high-availability operations.

## Decision

### 1. Use a dedicated Google Cloud project

The demo runs in a dedicated Google Cloud project, separate from the launch
site and unrelated infrastructure. Project-level billing, IAM, Secret Manager,
Artifact Registry, Compute Engine, Cloud SQL, logging, and monitoring stay in
one disposable boundary.

### 2. Use one long-lived Compute Engine VM

Atlas runs as a pinned container on an `e2-standard-4` VM. This keeps the web
process and embedded Workflow worker alive, avoids scale-to-zero latency, and
provides a direct path for future supporting compute services without turning
the demo into a Kubernetes project.

Caddy is the only public ingress. It owns TLS and security headers, proxies
Atlas, and returns `404` for public `/.well-known/workflow/*` requests. The
embedded worker reaches those routes only over loopback.

### 3. Keep durable state in private Cloud SQL

PostgreSQL 16 has no public IP. Atlas reaches it through Cloud SQL Auth Proxy
using the VM's attached service account. The `atlas` database holds LMS and
agent state. The `atlas_workflow` database separately holds Workflow queue,
event, step, hook, and stream state.

Cloud SQL backups and point-in-time recovery protect the durable state. The
application container, proxy container, and Caddy container remain replaceable.

### 4. Keep platform credentials server-owned

Anthropic, Gemini, Exa, authentication, database, and demo provisioning values
live in Secret Manager. Deployment materializes only the values required by
the running app into a root-owned `0600` environment file on the VM. Secrets
are injected at container start, not built into the image or stored in Git.

The two demo identities are the only database users with password hashes.
The provisioning password is not retained in the running container
environment. Instructors and students cannot configure or retrieve provider
credentials.

### 5. Preserve the public-domain split

The apex and `www` records stay on Vercel. DNS adds only one `demo` A record
pointing at the VM's static address. The demo deployment must not replace root,
`www`, or mail records.

### 6. Keep code execution outside Atlas

General code execution is now a separate AWS AgentCore service with:

- disposable sandbox instances;
- AWS-managed isolation and sandbox network policy;
- strict CPU, memory, time, filesystem, and output limits;
- no provider, database, authentication, or host credentials;
- an explicit job protocol between Atlas and the sandbox;
- stored job metadata and bounded results in Atlas;
- audit logs and per-actor quotas.

Atlas must never mount the Docker socket or execute user code inside the web or
Workflow process. The implementation and operational boundary are recorded in
[ADR-0020](0020-agentcore-code-execution.md).

## Alternatives considered

### Vercel Functions

Vercel remains appropriate for the static launch page, but the Atlas demo needs
a long-lived process, durable Workflow worker behavior, and predictable warm
latency. Request-scoped functions were not chosen as the primary runtime.

### Cloud Run

Cloud Run can keep minimum instances and works well for stateless services, but
the embedded worker and future compute plan still need deliberate lifecycle and
durability handling. A VM is the simpler demo boundary. A later stateless Atlas
web tier could move to Cloud Run while Workflow and sandboxes remain separate.

### Google Kubernetes Engine

GKE could express every service boundary, but its operational surface is not
justified for one temporary demo VM and one database. It remains an option only
if the sandbox fleet or service count grows enough to require orchestration.

### Running code inside the Atlas container

This was rejected. It would expose the application process, filesystem,
network, and secrets to untrusted workloads and would make resource isolation
unreliable.

## Consequences

### Positive

- Reviewers receive a stable, warm, full-stack demo.
- Existing Next.js, Workflow, PostgreSQL, seed, and authentication behavior is
  preserved.
- Cloud SQL is private and durable.
- Provider keys and passwords remain server-owned.
- The root Vercel site remains independent.
- The system has a clear future sandbox boundary.
- The whole GCP project can be retired after the demo window.

### Costs and limitations

- One VM and a zonal Cloud SQL instance are single-zone dependencies.
- Deployment and secret refresh are manual.
- A GitHub merge does not automatically build or deploy an image.
- The current uptime policy has no external notification channel.
- VM Secret Manager access is project-wide and should become per-secret in a
  long-lived environment.
- The default Compute Engine service account retains a broad project bootstrap
  role and should be reduced before permanent use.
- Document ingestion remains external and is tracked in
  [issue #49](https://github.com/Prashant002-1/Atlas-LMS/issues/49).

## Status note

This environment was later migrated to AWS and then retired. The Google Cloud
runbook and host scripts were removed with it. The reproducible AWS hosting
template remains in [`infra/aws`](../../infra/aws/README.md), and the code
execution boundary lives on in [ADR-0020](0020-agentcore-code-execution.md).
