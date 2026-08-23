# Atlas AWS monthly cost estimate

This estimate covers the `atlas-prod` hosting stack in `us-east-1`. It is a
gross on-demand estimate before AWS Activate credits, taxes, unusual data
transfer, or incident-driven usage. AWS Budgets is configured to measure gross
cost with credits and refunds excluded.

## Expected steady-state cost

The calculation uses 730 hours per month and the live AWS Price List API rates
checked on 2026-08-20.

| Resource | Assumption | Estimated monthly cost |
| --- | --- | ---: |
| EC2 | Linux `t4g.small`, $0.0168/hour | $12.26 |
| RDS compute | Single-AZ PostgreSQL `db.t4g.small`, $0.032/hour | $23.36 |
| RDS storage | 20 GB gp3, $0.115/GB-month | $2.30 |
| EC2 storage | 20 GB gp3, $0.08/GB-month | $1.60 |
| Public IPv4 | one Elastic IP in use, about $0.005/hour | $3.65 |
| Secrets Manager | three stack secrets plus the RDS-managed master secret at $0.40 each | $1.60 |
| Route 53 health check | removed while Atlas expects no traffic | $0.00 |
| CloudWatch alarms | five standard metric alarms | about $0.50 |
| Logs, ECR, S3, requests, light transfer | low-volume demo allowance | $1.00-$5.00 |
| **Estimated total** | before credits | **$46.27-$50.27/month** |

Cost Explorer recorded the removed HTTPS check under both
`Health-Check-Non-AWS` and `Health-Check-Option-Non-AWS`, a combined run rate of
about $2.75/month. DNS later moved to the AWS Elastic IP, but Atlas does not
need continuous external probing without traffic. Removing the check avoids
both the endpoint-classification ambiguity and the paid HTTPS option. Public
health remains part of deployment verification, and EC2 and RDS retain their
five infrastructure alarms.

RDS automated backup storage up to the provisioned database size is generally
included while the instance exists. Retained migration dumps, manual snapshots,
log growth, image growth, internet egress, model providers, and AgentCore usage
can add cost. The estimate intentionally does not include a NAT gateway, load
balancer, Multi-AZ RDS, paid AWS Support, CodeBuild, or always-on sandbox fleet
because the stack creates none of those.

## Price verification commands

These read-only queries produced the principal rates. Price List uses
`us-east-1` as its API endpoint even when filtering the product location.

```bash
aws pricing get-products \
  --profile atlas-sso-admin \
  --region us-east-1 \
  --service-code AmazonEC2 \
  --filters \
    Type=TERM_MATCH,Field=location,Value='US East (N. Virginia)' \
    Type=TERM_MATCH,Field=instanceType,Value=t4g.small \
    Type=TERM_MATCH,Field=operatingSystem,Value=Linux \
    Type=TERM_MATCH,Field=tenancy,Value=Shared \
    Type=TERM_MATCH,Field=preInstalledSw,Value=NA \
    Type=TERM_MATCH,Field=capacitystatus,Value=Used

aws pricing get-products \
  --profile atlas-sso-admin \
  --region us-east-1 \
  --service-code AmazonRDS \
  --filters \
    Type=TERM_MATCH,Field=location,Value='US East (N. Virginia)' \
    Type=TERM_MATCH,Field=databaseEngine,Value=PostgreSQL \
    Type=TERM_MATCH,Field=instanceType,Value=db.t4g.small \
    Type=TERM_MATCH,Field=deploymentOption,Value='Single-AZ'
```

The checked-in CloudFormation stack is the authoritative quantity inventory;
this report must be updated if instance classes, storage, availability model,
alarm count, or network architecture changes.

## Budget and alerts

CloudFormation creates `atlas-prod-monthly-gross-cost` at $70/month. Its
notifications go directly to `aws-admin@atlas-lms.com`, separately from the
SNS infrastructure-alarm topic, at:

- 50% actual ($35)
- 80% actual ($56)
- 100% actual ($70)
- 100% forecasted

The ceiling is intentionally above the expected $46-$50 steady state so normal
variation does not page immediately but architectural drift does. It is not a
hard spending cap. The pre-existing account-level zero-spend budget remains a
separate early signal.

AWS Activate credits currently cover eligible charges, but operators should
review the gross budget, Cost Explorer by service, and credit expiration rather
than treating the bill after credits as the cost of the architecture.
