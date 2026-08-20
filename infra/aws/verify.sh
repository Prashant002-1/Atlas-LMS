#!/usr/bin/env bash
set -euo pipefail

aws_profile="${AWS_PROFILE:-atlas-sso-admin}"
aws_region="${AWS_REGION:-us-east-1}"
stack_name="${ATLAS_AWS_STACK:-atlas-prod}"
require_confirmed_alerts="${ATLAS_REQUIRE_CONFIRMED_ALERTS:-true}"

fail() {
  echo "AWS hosting verification failed: $*" >&2
  exit 1
}

stack_json="$(
  aws cloudformation describe-stacks \
    --profile "$aws_profile" \
    --region "$aws_region" \
    --stack-name "$stack_name" \
    --query 'Stacks[0]' \
    --output json
)"

[[ "$(jq -r '.StackStatus' <<<"$stack_json")" == *_COMPLETE ]] || fail "CloudFormation is not complete."

output() {
  jq -r --arg key "$1" '.Outputs[] | select(.OutputKey == $key) | .OutputValue' <<<"$stack_json"
}

instance_id="$(output AppInstanceId)"
database_id="$(output DatabaseIdentifier)"
vpc_id="$(output VpcId)"
topic_arn="$(output AlertTopicArn)"
bucket="$(output MigrationBucket)"
repository_uri="$(output ImageRepositoryUri)"
repository_name="${repository_uri#*/}"

instance_json="$(
  aws ec2 describe-instances \
    --profile "$aws_profile" \
    --region "$aws_region" \
    --instance-ids "$instance_id" \
    --query 'Reservations[0].Instances[0]' \
    --output json
)"
[[ "$(jq -r '.State.Name' <<<"$instance_json")" == "running" ]] || fail "application instance is not running."
[[ "$(jq -r '.MetadataOptions.HttpTokens' <<<"$instance_json")" == "required" ]] || fail "IMDSv2 is not required."

volume_id="$(jq -r '.BlockDeviceMappings[0].Ebs.VolumeId' <<<"$instance_json")"
volume_json="$(aws ec2 describe-volumes --profile "$aws_profile" --region "$aws_region" --volume-ids "$volume_id" --query 'Volumes[0]' --output json)"
[[ "$(jq -r '.Encrypted' <<<"$volume_json")" == "true" ]] || fail "application volume is not encrypted."
[[ "$(jq -r '.VolumeType' <<<"$volume_json")" == "gp3" ]] || fail "application volume is not gp3."

ssm_ping="$(
  aws ssm describe-instance-information \
    --profile "$aws_profile" \
    --region "$aws_region" \
    --filters "Key=InstanceIds,Values=$instance_id" \
    --query 'InstanceInformationList[0].PingStatus' \
    --output text
)"
[[ "$ssm_ping" == "Online" ]] || fail "application instance is not online in Systems Manager."

database_json="$(
  aws rds describe-db-instances \
    --profile "$aws_profile" \
    --region "$aws_region" \
    --db-instance-identifier "$database_id" \
    --query 'DBInstances[0]' \
    --output json
)"
[[ "$(jq -r '.DBInstanceStatus' <<<"$database_json")" == "available" ]] || fail "RDS is not available."
[[ "$(jq -r '.PubliclyAccessible' <<<"$database_json")" == "false" ]] || fail "RDS is publicly accessible."
[[ "$(jq -r '.StorageEncrypted' <<<"$database_json")" == "true" ]] || fail "RDS is not encrypted."
[[ "$(jq -r '.DeletionProtection' <<<"$database_json")" == "true" ]] || fail "RDS deletion protection is disabled."
(( $(jq -r '.BackupRetentionPeriod' <<<"$database_json") >= 7 )) || fail "RDS backup retention is under seven days."

security_json="$(
  aws ec2 describe-security-groups \
    --profile "$aws_profile" \
    --region "$aws_region" \
    --filters "Name=vpc-id,Values=$vpc_id" \
    --query 'SecurityGroups' \
    --output json
)"
jq -e 'all(.[]; all(.IpPermissions[]?; .FromPort != 22 and .ToPort != 22))' <<<"$security_json" >/dev/null || fail "SSH ingress exists."
database_sg="$(jq -r '.VpcSecurityGroups[0].VpcSecurityGroupId' <<<"$database_json")"
jq -e --arg id "$database_sg" '
  .[] | select(.GroupId == $id) |
  (.IpPermissions | length == 1) and
  (.IpPermissions[0].IpProtocol == "tcp") and
  (.IpPermissions[0].FromPort == 5432) and
  (.IpPermissions[0].ToPort == 5432) and
  (.IpPermissions[0].IpRanges | length == 0) and
  (.IpPermissions[0].UserIdGroupPairs | length == 1)
' <<<"$security_json" >/dev/null || fail "database ingress is broader than the application security group."

repository_json="$(aws ecr describe-repositories --profile "$aws_profile" --region "$aws_region" --repository-names "$repository_name" --query 'repositories[0]' --output json)"
[[ "$(jq -r '.imageTagMutability' <<<"$repository_json")" == "IMMUTABLE" ]] || fail "ECR tags are mutable."
[[ "$(jq -r '.imageScanningConfiguration.scanOnPush' <<<"$repository_json")" == "true" ]] || fail "ECR scan-on-push is disabled."

bucket_encryption="$(aws s3api get-bucket-encryption --profile "$aws_profile" --region "$aws_region" --bucket "$bucket" --query 'ServerSideEncryptionConfiguration.Rules[0].ApplyServerSideEncryptionByDefault.SSEAlgorithm' --output text)"
[[ "$bucket_encryption" == "AES256" || "$bucket_encryption" == "aws:kms" ]] || fail "migration bucket encryption is absent."
bucket_versioning="$(aws s3api get-bucket-versioning --profile "$aws_profile" --region "$aws_region" --bucket "$bucket" --query 'Status' --output text)"
[[ "$bucket_versioning" == "Enabled" ]] || fail "migration bucket versioning is disabled."

alarm_count="$(aws cloudwatch describe-alarms --profile "$aws_profile" --region "$aws_region" --alarm-name-prefix "$stack_name-" --query 'length(MetricAlarms)' --output text)"
(( alarm_count >= 6 )) || fail "fewer than six CloudWatch alarms exist."

subscription_json="$(aws sns list-subscriptions-by-topic --profile "$aws_profile" --region "$aws_region" --topic-arn "$topic_arn" --query 'Subscriptions[?Protocol==`email`] | [0]' --output json)"
[[ "$subscription_json" != "null" ]] || fail "SNS email subscription is absent."
subscription_arn="$(jq -er '.SubscriptionArn' <<<"$subscription_json")"
if [[ "$require_confirmed_alerts" == "true" && "$subscription_arn" == "PendingConfirmation" ]]; then
  fail "SNS email subscription is still pending confirmation."
fi

aws budgets describe-budget \
  --profile "$aws_profile" \
  --account-id "$(aws sts get-caller-identity --profile "$aws_profile" --query Account --output text)" \
  --budget-name "$stack_name-monthly-gross-cost" \
  --query 'Budget.BudgetName' \
  --output text >/dev/null

command_id="$(
  aws ssm send-command \
    --profile "$aws_profile" \
    --region "$aws_region" \
    --instance-ids "$instance_id" \
    --document-name AWS-RunShellScript \
    --comment "Verify Atlas host readiness" \
    --parameters 'commands=["test -f /opt/atlas/host-ready","systemctl is-active docker","test -x /usr/local/bin/atlas-deploy","test -f /opt/atlas/Caddyfile"]' \
    --query 'Command.CommandId' \
    --output text
)"
aws ssm wait command-executed --profile "$aws_profile" --region "$aws_region" --command-id "$command_id" --instance-id "$instance_id"
command_status="$(aws ssm get-command-invocation --profile "$aws_profile" --region "$aws_region" --command-id "$command_id" --instance-id "$instance_id" --query Status --output text)"
[[ "$command_status" == "Success" ]] || fail "application host readiness command failed."

cat <<EOF
AWS hosting verification passed.
Stack: $stack_name
Instance: $instance_id
Database: $database_id
Migration bucket: $bucket
ECR: $repository_uri
Alerts confirmed: $([[ "$subscription_arn" == "PendingConfirmation" ]] && echo no || echo yes)
EOF
