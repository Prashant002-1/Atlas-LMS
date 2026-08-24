# Atlas production hosting on AWS

This is the operational source of truth for the Atlas application host,
PostgreSQL database, observability, cost controls, GCP migration, cutover,
rollback, and eventual GCP retirement. Secrets, environment payloads, database
dumps, and smoke-test passwords must never enter Git or terminal output.

## Current migration state

As of 2026-08-24, production data, application hosting, DNS, and TLS are live on
the `atlas-prod` CloudFormation stack in AWS account `118645514521`, region
`us-east-1`. The dedicated GCP project `atlas-yc2026fall` has lifecycle state
`DELETE_REQUESTED`; do not undelete it. The final inventory and database dumps
are retained in the encrypted AWS migration archive.

| Item | Current reference |
| --- | --- |
| CloudFormation stack | `atlas-prod`, `CREATE_COMPLETE` then verified `UPDATE_COMPLETE` |
| VPC | `vpc-09a77bcb73b015cd9`, `10.40.0.0/16` |
| Application host | `i-05f98d8543f98a03f`, `t4g.small`, Amazon Linux 2023 arm64 |
| AWS static address | `32.198.196.196` |
| RDS | `atlas-prod-postgres`, PostgreSQL 16.14, `db.t4g.small` |
| ECR | `118645514521.dkr.ecr.us-east-1.amazonaws.com/atlas-prod/atlas` |
| Migration archive | `atlas-prod-migrationbucket-btgroucmwjj6` |
| Public hostname | `demo.atlas-lms.com` |
| Current DNS | `32.198.196.196` (AWS), TTL 300 seconds |
| Production source commit | `cbfedf8739ad1298929562b9724af350f9f387fc` |
| Production application image | `atlas-prod/atlas@sha256:5f1ded7891824b92eecf0d3d5af12e481cbffa475edb2ce0ed0b1f06ae87e625` |
| Release image | `atlas-prod/atlas:cbfedf8739ad-release` |
| Final Cloud SQL backup | `1787510387141` |
| Final migration prefix | `migrations/20260823T183944Z/` |
| Retired GCP source | Project `atlas-yc2026fall`, `DELETE_REQUESTED` on 2026-08-23 |
| Deletion safeguard snapshot | `atlas-prod-pre-gcp-delete-20260823t192725z`, created for the gate then deleted the same day |
| SNS infrastructure-alert recipient | `shahp002@outlook.com` |
| Budget-alert recipient | `aws-admin@atlas-lms.com` |
| AgentCore state | disabled by incident switch until [#54](https://github.com/Prashant002-1/Atlas-LMS/issues/54) is verified live |
| Dedicated member-account follow-up | [#53](https://github.com/Prashant002-1/Atlas-LMS/issues/53) |

The alert subscription must be confirmed from its AWS email before cutover.
The current AWS management account is acceptable for this migration, but the
workload should move to its own member account after AWS permits another
account. That scope is tracked in issue #53 and should not be described as a
property of every resource.

### Completed cutover evidence

The final migration archive is
`s3://atlas-prod-migrationbucket-btgroucmwjj6/migrations/20260823T183944Z/`.
Its checksums passed and it contains both PostgreSQL dumps, the manifest, the
restore script, and `SHA256SUMS`. The restore applied database migrations 0021
through 0025 and `npm run db:check` passed from the matching release image.

The production application was deployed from the immutable digest recorded
above. On 2026-08-23, authoritative DNS and the public resolvers at 1.1.1.1 and
8.8.8.8 resolved `demo.atlas-lms.com` to `32.198.196.196`. Let's Encrypt issued
the production certificate, public `/api/health` returned `ok=true` and
`db=up`, and every Route 53 checker returned HTTP 200 from the AWS address. The
continuous Route 53 check was removed after cutover because Atlas expects no
traffic; public health remains a deployment gate.

The post-cutover product smoke passed every signed-out, instructor, student,
document, and authentication check. The durable workflow smoke completed as
run `wrun_01M0R0P58C6ERYK5SJQ91CH5TN` with a non-empty response stream. The
one-time YC passwords and SPC aliases were revoked by the cleanup trap after
the smoke run. The RDS instance has seven-day retention, deletion protection,
and point-in-time recovery current through 2026-08-23 19:10 UTC. Before GCP
deletion, the retirement gate also created encrypted manual RDS snapshot
`atlas-prod-pre-gcp-delete-20260823t192725z` and uploaded
`gcp-final-inventory.tar.gz` to the migration prefix. The manual snapshot was
deleted after the project deletion request because the dataset is disposable;
normal RDS automated backups remain enabled.

The dependency security release on 2026-08-24 was built from commit
`cbfedf8739ad1298929562b9724af350f9f387fc` after GitHub Actions run
[#32692725909](https://github.com/Prashant002-1/Atlas-LMS/actions/runs/32692725909)
passed the required `Verify` gate. The host reports the immutable application
digest shown above. Its ARM64 image scan completed with no findings. The
matching release image reported no pending database migrations and a current
database contract, passed every public signed-out, instructor, student,
document, and authentication smoke check, and completed durable Workflow run
`wrun_01M0S4258841H9940W67KDQSBE` with a non-empty response. The cleanup step
then revoked the temporary YC passwords and SPC aliases.

## Architecture and security boundary

CloudFormation owns one dedicated VPC with a public application subnet and two
private database subnets in separate availability zones. A static Elastic IP
is associated with one Graviton EC2 host. Caddy terminates HTTPS and proxies to
the Atlas standalone Next.js container on the host network. RDS PostgreSQL has
no public address and accepts port 5432 only from the application security
group.

RDS connections use `sslmode=verify-full` with AWS's global RDS CA bundle.
Host bootstrap downloads the public bundle from the AWS trust store, and both
the application and one-off release containers receive it through a read-only
mount at `/etc/ssl/certs/aws-rds-global-bundle.pem`. Do not replace this with a
no-verify connection string.

The host has no SSH ingress or key pair. Operators use short-lived IAM Identity
Center credentials and Systems Manager. IMDSv2 is required. EC2 and RDS storage
are encrypted. RDS has deletion protection, seven days of automated backups,
and snapshot retention on replacement or stack deletion. Application images
use immutable ECR tags and scan on push.

The host role can pull the ECR image, read only the runtime secret, write its
two CloudWatch log streams, use Systems Manager, and call the bounded AgentCore
data plane. It cannot read the RDS administrator secret or the migration
archive during normal operation. `migrate-from-gcp.sh` adds an exact-object,
exact-secret inline policy only for the restore command and removes it on
success or failure.

This hosting boundary does not run model-authored code on EC2 or through the
host Docker socket. AgentCore remains the external sandbox boundary.

## Reproduce and verify the AWS foundation

Authenticate the named Identity Center profile, then apply the stack:

```bash
aws sso login --profile atlas-sso-admin

AWS_PROFILE=atlas-sso-admin \
AWS_REGION=us-east-1 \
ATLAS_AWS_STACK=atlas-prod \
ATLAS_ALERT_EMAIL=shahp002@outlook.com \
ATLAS_BUDGET_ALERT_EMAIL=aws-admin@atlas-lms.com \
ATLAS_MONTHLY_BUDGET_USD=110 \
infra/aws/provision.sh
```

The first EC2 bootstrap exposed an Amazon Linux package conflict between
`curl-minimal` and an explicit `curl` install. The template now installs only
Docker and jq; Amazon Linux's existing curl implementation is retained. The
host was re-bootstrapped from the corrected EC2 user data and passed the host
readiness command.

Before the alert email is confirmed, the infrastructure-only gate can be run
with the pending subscription explicitly tolerated:

```bash
ATLAS_REQUIRE_CONFIRMED_ALERTS=false infra/aws/verify.sh
```

Before cutover, run the strict gate with no override:

```bash
infra/aws/verify.sh
```

The strict gate checks CloudFormation, EC2 state and encryption, IMDSv2, SSM,
private encrypted RDS and backup retention, absence of SSH ingress, the exact
database security-group source, immutable scanned ECR, S3 encryption and
versioning, five CloudWatch alarms, the SNS email confirmation, the gross-cost
budget, and host bootstrap files.

CloudFormation drift detection reports one known EC2 difference:
`/NetworkInterfaces/0/AssociatePublicIpAddress` is expected `false` at launch
and observed `true` after the separately managed Elastic IP is associated.
Removing the launch property was previewed in change set
`atlas-drift-fix-preview`; AWS marked the EC2 instance and EIP association for
replacement, so the preview was deleted without execution. Keep this known
scanner artifact until the host is intentionally replaced. It does not mean a
second address or unmanaged network interface exists.

## Build immutable images

The application and release images must come from clean, synchronized `main`.
The build script uses `git archive HEAD`, so untracked operator notes and local
environment files cannot enter the build context.

```bash
git switch main
git pull --ff-only origin main
npm run verify
AWS_PROFILE=atlas-sso-admin AWS_REGION=us-east-1 infra/aws/build-push.sh
```

Record all three emitted values:

- `SOURCE_COMMIT`
- `APP_IMAGE`, which uses an immutable digest
- `RELEASE_IMAGE`, whose `-release` tag is immutable in ECR

Do not migrate a database for an image that did not pass `npm run verify` from
the same commit.

## DNS preparation

The Squarespace A record was lowered from a 14,400-second TTL to 300 seconds
before the 2026-08-23 cutover. For any later address change, lower only its TTL
to 300 seconds and wait at least the old TTL, four hours, before the final
migration. Do not change the address during that preparation step. Confirm from
more than one resolver:

```bash
dig demo.atlas-lms.com A +noall +answer
```

The final write freeze must not begin while resolvers can keep the old address
for four hours. During propagation after the address change, the GCP Atlas
container stays stopped so there cannot be a second writable database.

## Final GCP database migration

Run this only after the release image exists and DNS TTL preparation has
settled:

```bash
export AWS_PROFILE=atlas-sso-admin
export AWS_REGION=us-east-1
export ATLAS_RELEASE_IMAGE='118645514521.dkr.ecr.us-east-1.amazonaws.com/atlas-prod/atlas:COMMIT-release'
export ATLAS_CONFIRM_FINAL_MIGRATION='atlas-yc2026fall-to-atlas-prod'

infra/aws/migrate-from-gcp.sh
```

The script performs these operations in order:

1. verifies clean synchronized `main`, the AWS account and stack, and the GCP
   project;
2. creates and verifies a new on-demand Cloud SQL backup;
3. stops only the GCP Atlas application to create the final write boundary;
4. creates PostgreSQL 16 custom-format dumps for `atlas` and
   `atlas_workflow` through the existing private Cloud SQL proxy;
5. copies the dumps through IAP, creates SHA-256 checksums and a provenance
   manifest, and uploads them to the retained encrypted, versioned S3 bucket;
6. transfers only the runtime and database-user values into AWS Secrets
   Manager without printing them; GCP YC/SPC demo passwords are not copied;
7. writes AWS RDS URLs and explicitly sets
   `ATLAS_CODE_EXECUTION_ENABLED=false` while AgentCore is unavailable;
8. grants the EC2 role temporary read access to only that migration prefix and
   the two restore secrets;
9. restores both databases over the private VPC path, applies the checked-in
   database release ledger, and runs `db:check` from the exact release image;
10. removes the temporary IAM policy and all local/host plaintext restore
    material.

If any step fails, the trap removes temporary IAM access and restarts the GCP
application. On success, the GCP application intentionally remains stopped.
The S3 migration prefix and final Cloud SQL backup ID are printed and must be
recorded here before GCP deletion.

## Deploy and verify before DNS

Deploy the `APP_IMAGE` digest printed by the build step:

```bash
AWS_PROFILE=atlas-sso-admin \
AWS_REGION=us-east-1 \
infra/aws/deploy-host.sh \
  '118645514521.dkr.ecr.us-east-1.amazonaws.com/atlas-prod/atlas@sha256:DIGEST'
```

The host deployer fetches the runtime secret to a root-only file, pulls the
digest, starts a candidate, checks `http://127.0.0.1:3000/api/health`, and
restores the previous container if the candidate fails. Before changing DNS,
independently verify through SSM:

```bash
aws ssm send-command \
  --profile atlas-sso-admin \
  --region us-east-1 \
  --instance-ids i-05f98d8543f98a03f \
  --document-name AWS-RunShellScript \
  --parameters 'commands=["curl -fsS http://127.0.0.1:3000/api/health","docker ps --format {{.Names}}"]'
```

Also inspect ECR scan findings and confirm no critical finding blocks the
release. Caddy cannot obtain the production certificate until DNS points to
the AWS address, so the application-local SSM check is the pre-DNS proof.

## Cut over DNS and prove the product

Change only the Squarespace A record for `demo.atlas-lms.com` from
`35.202.247.237` to `32.198.196.196`. Leave the apex and `www` Vercel records
unchanged. Verify the authoritative answer and public TLS:

```bash
dig demo.atlas-lms.com A +noall +answer
curl -fsS https://demo.atlas-lms.com/api/health
```

Then perform the full release proof from the merged source:

1. generate an AWS-only one-time password, run `npm run demo:provision-yc`, and
   run `npm run smoke` with the YC instructor and student emails;
2. run `npm run smoke:workflow` and verify a real durable Workflow run, then
   immediately run `npm run demo:revoke-disposable-access`;
3. verify the old GCP YC passwords and SPC aliases no longer authenticate;
4. verify document originals, submission attachments, course guidance, and
   agent session history survived the restore;
5. verify `npm run db:check` reports the release contract current;
6. verify `/atlas/atlas-prod/app` and `/atlas/atlas-prod/caddy` receive logs;
7. verify all five infrastructure alarms reach `OK`, then verify public HTTPS
   health directly;
8. verify an RDS automated backup appears after the configured backup window;
9. send a controlled SNS test message and confirm receipt at
   `shahp002@outlook.com`;
10. inspect the AWS gross-cost budget and its four notification thresholds.

Code-execution UI and database records may exist, but live execution must show
the platform incident state while `ATLAS_CODE_EXECUTION_ENABLED=false`. Do not
claim AgentCore proof until issue #54 is closed with a real session.

## Rollback rules

The migration-time GCP rollback path ended when the dedicated project entered
`DELETE_REQUESTED`. Production rollback now stays inside AWS: restore the last
known-good immutable application image for code regressions, or restore RDS
from an automated backup or the pre-deletion manual snapshot for database
recovery. Keep RDS authoritative and do not undelete the retired GCP project.

## Retired GCP source

The final deletion command completed on 2026-08-23 after creating the encrypted
manual RDS snapshot and uploading the final GCP inventory. Google reports the
project as `DELETE_REQUESTED` with billing disabled. The remaining stopped
Cloud SQL instance was explicitly deleted and its deletion operation completed;
the SQL instance list is now empty. Compute, Artifact Registry, and Secret
Manager no longer accept normal project access. Do not undelete the project.
The executed command was:

```bash
export ATLAS_MIGRATION_PREFIX='migrations/YYYYMMDDTHHMMSSZ'
export ATLAS_CONFIRM_DELETE_GCP_PROJECT='delete-atlas-yc2026fall-after-aws-cutover'
infra/aws/destroy-gcp.sh
```

The script refused deletion unless DNS resolved exclusively to AWS, public
health passes, the four core archive objects exist, RDS and SSM are healthy,
and the temporary migration policy is absent. It creates a final manual RDS
snapshot, archives a non-secret GCP inventory beside the dumps, then requests
deletion of the dedicated `atlas-yc2026fall` project. Google retains a recovery
window internally, but Atlas should treat this project as permanently retired.
The temporary manual snapshot was deleted after this gate completed, so it does
not add ongoing snapshot storage cost.
