#!/usr/bin/env bash
set -euo pipefail

aws_profile="${AWS_PROFILE:-atlas-sso-admin}"
aws_region="${AWS_REGION:-us-east-1}"
stack_name="${ATLAS_AWS_STACK:-atlas-prod}"
image_ref="${1:-}"

if [[ "$image_ref" != *@sha256:* ]]; then
  echo "Usage: $0 <immutable-ecr-image@sha256:digest>" >&2
  exit 1
fi

instance_id="$(
  aws cloudformation describe-stacks \
    --profile "$aws_profile" \
    --region "$aws_region" \
    --stack-name "$stack_name" \
    --query 'Stacks[0].Outputs[?OutputKey==`AppInstanceId`].OutputValue | [0]' \
    --output text
)"

command_id="$(
  aws ssm send-command \
    --profile "$aws_profile" \
    --region "$aws_region" \
    --instance-ids "$instance_id" \
    --document-name AWS-RunShellScript \
    --comment "Deploy immutable Atlas image" \
    --parameters "commands=[\"printf '%s\\n' '$image_ref' | sudo tee /etc/atlas/image >/dev/null\",\"sudo /usr/local/bin/atlas-deploy\"]" \
    --query 'Command.CommandId' \
    --output text
)"

aws ssm wait command-executed \
  --profile "$aws_profile" \
  --region "$aws_region" \
  --command-id "$command_id" \
  --instance-id "$instance_id"

aws ssm get-command-invocation \
  --profile "$aws_profile" \
  --region "$aws_region" \
  --command-id "$command_id" \
  --instance-id "$instance_id" \
  --query '{Status:Status,Output:StandardOutputContent,Error:StandardErrorContent}' \
  --output json
