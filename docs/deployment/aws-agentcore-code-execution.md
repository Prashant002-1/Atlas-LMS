# AWS AgentCore code execution runbook

This runbook covers the current single-account setup. It uses management account `118645514521` through the `prashant.shah` Identity Center session. It does not use AWS root, create a member account, or create a custom Code Interpreter.

## What was run

Refresh and verify the non-root identity:

```bash
aws sso login --profile atlas-sso-admin
aws sts get-caller-identity --profile atlas-sso-admin --output json
```

Expected account and principal:

```text
Account: 118645514521
Principal: .../prashant.shah
```

Confirm that Atlas has no custom interpreters and no active managed sessions:

```bash
aws bedrock-agentcore-control list-code-interpreters \
  --profile atlas-sso-admin \
  --region us-east-1 \
  --output json

aws bedrock-agentcore list-code-interpreter-sessions \
  --profile atlas-sso-admin \
  --region us-east-1 \
  --code-interpreter-identifier aws.codeinterpreter.v1 \
  --output json
```

The 2026-08-17 checks returned no custom interpreters and `"items": []` for sessions.

Inspect the two relevant applied quotas:

```bash
aws service-quotas list-service-quotas \
  --profile atlas-sso-admin \
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

## Observed quota-request behavior

The account owner approved this exact request for a small initial allowance:

```bash
aws service-quotas request-service-quota-increase \
  --profile atlas-sso-admin \
  --region us-east-1 \
  --service-code bedrock-agentcore \
  --quota-code L-CAF6F552 \
  --desired-value 10
```

AWS rejected it before creating a quota request:

```text
IllegalArgumentException: You must provide a quota value greater than the default quota value of 1000.0
```

AWS publishes `1000` as the default while this account's applied value is `0`. AWS's general quota guidance explicitly says that a recently created or minimally used account can have an actual quota below the published default. AgentCore users have also reported effective zero or low launch limits despite having no resources. The Service Quotas increase path compares the requested value with the published default, so it cannot express the intended correction from `0` to a small value such as `10`.

- [AWS service quotas and lower actual values for new accounts](https://docs.aws.amazon.com/general/latest/gr/aws_service_limits.html)
- [AgentCore quota documentation](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/bedrock-agentcore-limits.html)
- [AgentCore user report with no resources and an effective launch limit](https://www.repost.aws/questions/QUBBSYTVMoSU6v_msdGOUOzg/unable-to-create-agentcore-runtimes-due-to-servicequotaexceededexception-even-though-none-exist)

No quota request or AWS resource was created by the rejected command.

## Required account action

This is an account-activation correction, not a request for capacity above the published default. The account owner submitted AWS Support case `178700017500825` on 2026-08-17 through the `prashant.shah` Identity Center session. It was routed as **Account and billing -> Service Quotas -> General**, with **General question** severity and **Web** correspondence. AWS displayed an expected response time of 24 hours or less.

The submitted case used the following subject and description.

Subject:

```text
AgentCore Code Interpreter applied quota is 0 despite 1,000 default
```

Description:

```text
Account 118645514521 in us-east-1 has an effective Amazon Bedrock AgentCore
Code Interpreter concurrent-session quota of 0 for quota L-CAF6F552, although
the AWS default is 1000. There are no active Code Interpreter sessions.
Starting one managed aws.codeinterpreter.v1 session returns
ServiceQuotaExceededException: maxCodeInterpreterSessions limit exceeded.
Requesting a quota of 10 is rejected because Service Quotas requires a value
above the documented default of 1000. Please restore or seed the account's
effective allowance to the published default, enable AgentCore Code Interpreter
for this account, or explain the account-level activation restriction. We are
not requesting capacity above the AWS default.

This is a new AWS account for Atlas LMS, an education software startup. Atlas is
building a managed, temporary code-execution workspace for AI-assisted student
assignments. Student code will run in the AWS-managed Code Interpreter sandbox,
not on the Atlas application host, and each workspace will have explicit time,
file, and output limits. We selected AgentCore specifically so that untrusted
assignment code is isolated from the LMS and does not require us to operate a
custom execution fleet.

AWS has approved this startup for promotional credits, which we intend to use
for development and early product testing. At this stage we only need a small
number of concurrent sessions to complete integration testing, but the effective
zero allowance prevents even one managed test session from starting. Please help
activate the published default allowance, or identify any account verification,
billing-history, region, or service-enablement step that still needs to be
completed. We can provide the request IDs and exact CLI output if needed.
```

Do not request `1001` merely to bypass the validator. A support engineer needs to reconcile the applied value with the service's published default or explain the account restriction.

If AWS creates a quota request while handling the case, track it with:

```bash
aws service-quotas list-requested-service-quota-change-history-by-quota \
  --profile atlas-sso-admin \
  --region us-east-1 \
  --service-code bedrock-agentcore \
  --quota-code L-CAF6F552 \
  --output table
```

## Application configuration

Local shell:

```bash
export AWS_PROFILE=atlas-sso-admin
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
AWS_PROFILE=atlas-sso-admin AWS_REGION=us-east-1 npm run smoke:code-execution
```

It starts one managed session, verifies Python/JavaScript/TypeScript, bounded input and output files, absence of Atlas secrets, blocked public network access, and explicit termination. The script always stops the session in `finally` after a successful start.

Then run the repository gate:

```bash
npm run db:check
npm run db:upgrade
npm run verify
```

Only run `db:upgrade` against the intended database. Atlas's release scripts reject accidental remote mutation without the explicit production confirmation path.
