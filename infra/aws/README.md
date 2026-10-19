# AWS hosting template

This directory holds a reproducible, small-footprint AWS deployment for Atlas:
one Graviton EC2 host behind a static address, a private Single-AZ RDS
PostgreSQL 16 instance, immutable ECR images, Secrets Manager, CloudWatch logs
and alarms, SNS email alerts, and a monthly gross-cost budget.

It deliberately does not create a NAT gateway, load balancer, public database,
SSH ingress, long-lived AWS access key, custom code interpreter, or paid
support plan. The host is administered through Systems Manager. Model-authored
code never runs on the host or through its Docker socket; see
[ADR-0020](../../docs/adr/0020-agentcore-code-execution.md).

## Files

| File | Purpose |
| --- | --- |
| `hosting-stack.yaml` | CloudFormation template: VPC, host, RDS, ECR, secrets, alarms, budget |
| `provision.sh` | Validates and deploys the stack with your parameters |
| `verify.sh` | Read-only checks that the stack, alarms, and alert subscriptions are healthy |
| `build-push.sh` | Builds the production image from a clean `main` and pushes it to ECR by digest |
| `deploy-host.sh` | Deploys one immutable image digest to the host through Systems Manager |

## Parameters

Every account-specific value is a parameter or environment variable. Nothing
here is tied to a particular account, domain, or recipient.

| Variable | Meaning |
| --- | --- |
| `AWS_PROFILE`, `AWS_REGION` | The credentials and region to use |
| `ATLAS_AWS_STACK` | Stack name, default `atlas-prod` |
| `ATLAS_ALERT_EMAIL` | Required. Recipient for infrastructure alarms |
| `ATLAS_BUDGET_ALERT_EMAIL` | Recipient for budget alerts, defaults to the alert email |
| `ATLAS_MONTHLY_BUDGET_USD` | Budget ceiling, default 70 |
| `ATLAS_APP_INSTANCE_TYPE`, `ATLAS_DATABASE_INSTANCE_CLASS` | Instance sizing |

The template's `DomainName` parameter is a placeholder. Point your own DNS
record at the stack's static address after provisioning.

## Order of operations

1. `provision.sh`, then confirm the SNS subscription email.
2. `verify.sh`.
3. `build-push.sh` from a clean, synchronized `main`.
4. Initialize the database once with `npm run db:push -- --force` against an
   empty RDS database, bootstrap the Workflow schema, and seed if you want the
   demo tenant.
5. `deploy-host.sh <image@sha256:digest>`.
6. Point DNS at the static address and check `/api/health`.

Later releases repeat steps 3 and 5, running `npm run db:upgrade` against the
production database for any schema change.

## Costs and safety

At the default sizes the stack runs in the range of fifty US dollars a month
before credits. The budget alerts; it does not cap spending.

CloudFormation retains the migration bucket, runtime secrets, and log groups on
stack deletion, and RDS has deletion protection with snapshots on replacement
or deletion. Those are recovery controls. Remove them deliberately when you
intend to retire a deployment.

Secrets, environment payloads, database dumps, and smoke-test passwords must
never enter Git or terminal output.
