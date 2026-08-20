# Atlas AWS production hosting

This directory owns the reproducible AWS hosting boundary for Atlas. The stack
uses one Graviton EC2 host behind a static address, private Single-AZ RDS
PostgreSQL 16, immutable ECR images, Secrets Manager, retained encrypted
migration backups, CloudWatch logs and alarms, an external HTTPS health check,
SNS email alerts, and a monthly gross-cost budget.

It deliberately does not create a NAT gateway, load balancer, public database,
SSH ingress, long-lived AWS key, custom code interpreter, or paid support plan.
The host is administered through Systems Manager. Model-authored code never
runs on the host or through its Docker socket.

## Order

1. Run `infra/aws/provision.sh` through the `atlas-sso-admin` profile.
2. Confirm the SNS subscription sent to `aws-admin@atlas-lms.com`, then run
   `infra/aws/verify.sh`.
3. Merge the infrastructure commit into `main` and run `npm run verify`.
4. Run `infra/aws/build-push.sh` from clean, synchronized `main`.
5. Lower the existing DNS TTL and wait out its old four-hour value.
6. Run `infra/aws/migrate-from-gcp.sh` with the exact release image. This
   creates the final Cloud SQL backup, stops source writes, archives and
   restores both databases, transfers runtime secrets, and applies the release
   ledger.
7. Deploy the immutable digest with `infra/aws/deploy-host.sh`.
8. Change the one demo A record, then complete the public, actor, Workflow,
   database, backup, log, alarm, and budget checks.
9. After the AWS soak, run `infra/aws/destroy-gcp.sh` with its exact archive and
   deletion confirmation.

The exact commands, rollback boundaries, live resource references, and cost
estimate are in `docs/deployment/aws-hosting.md` and
`docs/deployment/aws-cost-estimate.md`.

CloudFormation retains the migration bucket, runtime secrets, and log groups on
stack deletion. RDS has deletion protection and snapshots on replacement or
deletion. These are recovery controls, not ordinary teardown targets.
