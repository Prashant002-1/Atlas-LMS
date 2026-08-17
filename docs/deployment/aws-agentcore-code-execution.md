# AWS AgentCore code execution runbook

This runbook covers the current single-account setup. It uses management account `000000000000` through the `sso-admin-user` Identity Center session. It does not use AWS root, create a member account, or create a custom Code Interpreter.

## What was run

Refresh and verify the non-root identity:

```bash
aws sso login --profile your-profile
aws sts get-caller-identity --profile your-profile --output json
```

Expected account and principal:

```text
Account: 000000000000
Principal: .../sso-admin-user
```

Confirm that Atlas has no custom interpreters and no active managed sessions:

```bash
aws bedrock-agentcore-control list-code-interpreters \
  --profile your-profile \
  --region us-east-1 \
  --output json

aws bedrock-agentcore list-code-interpreter-sessions \
  --profile your-profile \
  --region us-east-1 \
  --code-interpreter-identifier aws.codeinterpreter.v1 \
  --output json
```

The 2026-08-17 checks returned no custom interpreters and `"items": []` for sessions.

Inspect the two relevant applied quotas:

```bash
aws service-quotas list-service-quotas \
  --profile your-profile \
  --region us-east-1 \
  --service-code bedrock-agentcore \
  --output json \
| jq -r '.Quotas[] | select(.QuotaCode == "L-CAF6F552" or .QuotaCode == "L-D8BDCBA9") | [.QuotaName,.QuotaCode,.Value,.Adjustable] | @tsv'
```

Observed:

```text
Total number of concurrent active code interpreter sessions per account  L-CAF6F552  0  true
Total number of Code Interpreter tool configurations per account         L-D8BDCBA9  0  true
```

`L-CAF6F552` blocks the managed session and must be raised. `L-D8BDCBA9` can remain zero because Atlas uses AWS's system interpreter instead of creating a custom configuration.

## Required account action

Request a small initial applied value such as 10 for `L-CAF6F552` in `us-east-1`. This is an external billing/capacity decision and must be approved by the AWS account owner. Do not run this command without that approval:

```bash
aws service-quotas request-service-quota-increase \
  --profile your-profile \
  --region us-east-1 \
  --service-code bedrock-agentcore \
  --quota-code L-CAF6F552 \
  --desired-value 10
```

The equivalent console path is **Service Quotas -> AWS services -> Amazon Bedrock AgentCore -> Total number of concurrent active code interpreter sessions per account -> Request increase**.

Track a submitted request with:

```bash
aws service-quotas list-requested-service-quota-change-history-by-quota \
  --profile your-profile \
  --region us-east-1 \
  --service-code bedrock-agentcore \
  --quota-code L-CAF6F552 \
  --output table
```

## Application configuration

Local shell:

```bash
export AWS_PROFILE=your-profile
export AWS_REGION=us-east-1
export ATLAS_CODE_INTERPRETER_ID=aws.codeinterpreter.v1
```

Atlas defaults assessed-session execution on. Set `ATLAS_CODE_EXECUTION_ENABLED=false` only as a school/platform incident switch. Production should use workload credentials rather than `AWS_PROFILE`.

The production workload role needs these actions for the managed interpreter:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock-agentcore:StartCodeInterpreterSession",
        "bedrock-agentcore:InvokeCodeInterpreter",
        "bedrock-agentcore:GetCodeInterpreterSession",
        "bedrock-agentcore:StopCodeInterpreterSession"
      ],
      "Resource": "*"
    }
  ]
}
```

Narrow `Resource` when AWS publishes/supports a managed-system-interpreter ARN for these data-plane actions in the deployment account. Atlas does not need `CreateCodeInterpreter`, `DeleteCodeInterpreter`, `iam:PassRole`, S3 mounts, EFS mounts, or arbitrary Bedrock control-plane access.

## Verification after quota approval

Run the disposable smoke test:

```bash
AWS_PROFILE=your-profile AWS_REGION=us-east-1 npm run smoke:code-execution
```

It starts one managed session, verifies Python/JavaScript/TypeScript, bounded input and output files, absence of Atlas secrets, blocked public network access, and explicit termination. The script always stops the session in `finally` after a successful start.

Then run the repository gate:

```bash
npm run db:check
npm run db:upgrade
npm run verify
```

Only run `db:upgrade` against the intended database. Atlas's release scripts reject accidental remote mutation without the explicit production confirmation path.
