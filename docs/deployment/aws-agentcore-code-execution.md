# AWS AgentCore code execution runbook

Assessed sessions run code in the AWS-managed AgentCore Code Interpreter
(`aws.codeinterpreter.v1`). This runbook covers a single-account setup. It
uses a named AWS Identity Center (SSO) session, never root credentials, and
does not create a custom Code Interpreter.

## Identity

Sign in and confirm the account you expect:

```bash
aws sso login --profile "$AWS_PROFILE"
aws sts get-caller-identity --profile "$AWS_PROFILE" --output json
```

Stop if the account or principal is not the one you intended.

## Confirm there are no custom interpreters or active sessions

```bash
aws bedrock-agentcore-control list-code-interpreters \
  --profile "$AWS_PROFILE" --region "$AWS_REGION" --output json

aws bedrock-agentcore list-code-interpreter-sessions \
  --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --code-interpreter-identifier aws.codeinterpreter.v1 --output json
```

Both should be empty for a fresh account.

## Quotas

Two applied quotas matter:

```bash
aws service-quotas list-service-quotas \
  --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --service-code bedrock-agentcore --output json \
| jq -r '.Quotas[] | select(.QuotaCode == "L-CAF6F552" or .QuotaCode == "L-D8BDCBA9") | [.QuotaName,.QuotaCode,.Value,.Adjustable] | @tsv'
```

| Quota | Meaning | Needed |
| --- | --- | --- |
| `L-CAF6F552` | Concurrent active Code Interpreter sessions per account | Greater than zero |
| `L-D8BDCBA9` | Code Interpreter tool configurations per account | Can stay zero; Atlas uses the system interpreter |

A new or lightly used account can show an applied value of `0` for
`L-CAF6F552` even though AWS publishes `1000` as the default. In that state,
`StartCodeInterpreterSession` fails with `ServiceQuotaExceededException`
before any session is created, and the Service Quotas increase request is
rejected because it only accepts values above the published default.

This is an account-activation correction, not a capacity increase. Open an
AWS Support case under **Account and billing -> Service Quotas** asking AWS to
restore the account's effective allowance for `L-CAF6F552` to the published
default, or to explain the account-level restriction. Do not request `1001`
merely to satisfy the validator.

References:

- [AWS service quotas and lower actual values for new accounts](https://docs.aws.amazon.com/general/latest/gr/aws_service_limits.html)
- [AgentCore quota documentation](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/bedrock-agentcore-limits.html)

Track any resulting quota request with:

```bash
aws service-quotas list-requested-service-quota-change-history-by-quota \
  --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --service-code bedrock-agentcore --quota-code L-CAF6F552 --output table
```

## Application configuration

Local shell:

```bash
export AWS_PROFILE=your-profile
export AWS_REGION=us-east-1
export ATLAS_CODE_INTERPRETER_ID=aws.codeinterpreter.v1
```

Atlas defaults assessed-session execution on. Set
`ATLAS_CODE_EXECUTION_ENABLED=false` only as a platform incident switch.
Production should use workload credentials (an instance or task role) rather
than `AWS_PROFILE`.

The workload role needs only these data-plane actions:

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

Narrow `Resource` when AWS supports a managed-system-interpreter ARN for these
actions in your account. Atlas does not need `CreateCodeInterpreter`,
`DeleteCodeInterpreter`, `iam:PassRole`, S3 or EFS mounts, or Bedrock
control-plane access.

## Verification

Run the disposable smoke test:

```bash
AWS_PROFILE=your-profile AWS_REGION=us-east-1 npm run smoke:code-execution
```

It starts one managed session, verifies Python, JavaScript, and TypeScript,
exercises bounded input and output files, confirms that no Atlas secrets are
visible inside the sandbox, confirms that public network access is blocked,
and stops the session in `finally` after a successful start.

Then run the repository gate:

```bash
npm run db:check
npm run db:upgrade
npm run verify
```

Run `db:upgrade` only against the intended database. The release scripts
refuse remote mutation without the explicit production confirmation path.
