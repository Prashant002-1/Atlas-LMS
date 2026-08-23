#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
repo_root="$(cd "$script_dir/../.." && pwd)"

aws_profile="${AWS_PROFILE:-your-profile}"
aws_region="${AWS_REGION:-us-east-1}"
stack_name="${ATLAS_AWS_STACK:-atlas-prod}"
alert_email="${ATLAS_ALERT_EMAIL:-ops@example.edu}"
budget_alert_email="${ATLAS_BUDGET_ALERT_EMAIL:-ops@example.edu}"
monthly_budget="${ATLAS_MONTHLY_BUDGET_USD:-70}"
app_instance_type="${ATLAS_APP_INSTANCE_TYPE:-t4g.small}"
database_instance_class="${ATLAS_DATABASE_INSTANCE_CLASS:-db.t4g.small}"

aws sts get-caller-identity \
  --profile "$aws_profile" \
  --query '{Account:Account,Arn:Arn}' \
  --output json

aws cloudformation validate-template \
  --profile "$aws_profile" \
  --region "$aws_region" \
  --template-body "file://$repo_root/infra/aws/hosting-stack.yaml" >/dev/null

aws cloudformation deploy \
  --profile "$aws_profile" \
  --region "$aws_region" \
  --stack-name "$stack_name" \
  --template-file "$repo_root/infra/aws/hosting-stack.yaml" \
  --capabilities CAPABILITY_IAM \
  --no-fail-on-empty-changeset \
  --parameter-overrides \
    "EnvironmentName=$stack_name" \
    "AlertEmail=$alert_email" \
    "BudgetAlertEmail=$budget_alert_email" \
    "MonthlyBudgetUsd=$monthly_budget" \
    "AppInstanceType=$app_instance_type" \
    "DatabaseInstanceClass=$database_instance_class"

aws cloudformation describe-stacks \
  --profile "$aws_profile" \
  --region "$aws_region" \
  --stack-name "$stack_name" \
  --query 'Stacks[0].{Status:StackStatus,Outputs:Outputs[].{Key:OutputKey,Value:OutputValue}}' \
  --output json
