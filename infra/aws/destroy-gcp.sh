#!/usr/bin/env bash
set -euo pipefail
umask 077

aws_profile="${AWS_PROFILE:-atlas-sso-admin}"
aws_region="${AWS_REGION:-us-east-1}"
stack_name="${ATLAS_AWS_STACK:-atlas-prod}"
gcp_project="${ATLAS_GCP_PROJECT:-atlas-yc2026fall}"
migration_prefix="${ATLAS_MIGRATION_PREFIX:-}"
confirmation="${ATLAS_CONFIRM_DELETE_GCP_PROJECT:-}"

expected_confirmation="delete-$gcp_project-after-aws-cutover"
if [[ "$confirmation" != "$expected_confirmation" ]]; then
  echo "Refusing to delete the GCP project without ATLAS_CONFIRM_DELETE_GCP_PROJECT=$expected_confirmation" >&2
  exit 2
fi
if [[ "$migration_prefix" != migrations/* ]]; then
  echo "ATLAS_MIGRATION_PREFIX must identify the verified S3 migration archive." >&2
  exit 2
fi

stack_json="$(aws cloudformation describe-stacks --profile "$aws_profile" --region "$aws_region" --stack-name "$stack_name" --query 'Stacks[0]' --output json)"
stack_output() {
  jq -r --arg key "$1" '.Outputs[] | select(.OutputKey == $key) | .OutputValue' <<<"$stack_json"
}

aws_ip="$(stack_output AppElasticIp)"
database_id="$(stack_output DatabaseIdentifier)"
bucket="$(stack_output MigrationBucket)"
instance_id="$(stack_output AppInstanceId)"

dns_ips="$(dig +short demo.atlas-lms.com A | sort -u)"
[[ "$dns_ips" == "$aws_ip" ]] || { echo "DNS does not resolve exclusively to the AWS address $aws_ip." >&2; exit 1; }
curl -fsS --max-time 20 https://demo.atlas-lms.com/api/health >/dev/null || { echo "Public AWS health check failed." >&2; exit 1; }

for file in atlas.dump atlas_workflow.dump SHA256SUMS manifest.json; do
  aws s3api head-object \
    --profile "$aws_profile" \
    --region "$aws_region" \
    --bucket "$bucket" \
    --key "$migration_prefix/$file" >/dev/null
done

rds_status="$(aws rds describe-db-instances --profile "$aws_profile" --region "$aws_region" --db-instance-identifier "$database_id" --query 'DBInstances[0].DBInstanceStatus' --output text)"
[[ "$rds_status" == "available" ]] || { echo "RDS is not available." >&2; exit 1; }
ssm_status="$(aws ssm describe-instance-information --profile "$aws_profile" --region "$aws_region" --filters "Key=InstanceIds,Values=$instance_id" --query 'InstanceInformationList[0].PingStatus' --output text)"
[[ "$ssm_status" == "Online" ]] || { echo "AWS application host is not online in Systems Manager." >&2; exit 1; }

instance_profile_arn="$(aws ec2 describe-instances --profile "$aws_profile" --region "$aws_region" --instance-ids "$instance_id" --query 'Reservations[0].Instances[0].IamInstanceProfile.Arn' --output text)"
instance_profile_name="${instance_profile_arn##*/}"
instance_role="$(aws iam get-instance-profile --profile "$aws_profile" --instance-profile-name "$instance_profile_name" --query 'InstanceProfile.Roles[0].RoleName' --output text)"
if aws iam get-role-policy \
  --profile "$aws_profile" \
  --role-name "$instance_role" \
  --policy-name atlas-final-gcp-migration >/dev/null 2>&1; then
  echo "Temporary migration IAM policy still exists." >&2
  exit 1
fi

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
snapshot_id="$stack_name-pre-gcp-delete-${timestamp,,}"
aws rds create-db-snapshot \
  --profile "$aws_profile" \
  --region "$aws_region" \
  --db-instance-identifier "$database_id" \
  --db-snapshot-identifier "$snapshot_id" \
  --tags Key=atlas:reason,Value=pre-gcp-deletion Key=atlas:source-project,Value="$gcp_project" >/dev/null
aws rds wait db-snapshot-completed \
  --profile "$aws_profile" \
  --region "$aws_region" \
  --db-snapshot-identifier "$snapshot_id"

work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT
gcloud compute instances list --project="$gcp_project" --format=json > "$work_dir/compute-instances.json"
gcloud sql instances list --project="$gcp_project" --format=json > "$work_dir/sql-instances.json"
gcloud artifacts repositories list --project="$gcp_project" --location=all --format=json > "$work_dir/artifact-repositories.json"
gcloud secrets list --project="$gcp_project" --format=json > "$work_dir/secret-containers.json"
gcloud projects describe "$gcp_project" --format=json > "$work_dir/project.json"
(
  cd "$work_dir"
  tar -czf gcp-final-inventory.tar.gz \
    compute-instances.json \
    sql-instances.json \
    artifact-repositories.json \
    secret-containers.json \
    project.json
)
aws s3 cp \
  --profile "$aws_profile" \
  --region "$aws_region" \
  --sse AES256 \
  --only-show-errors \
  "$work_dir/gcp-final-inventory.tar.gz" \
  "s3://$bucket/$migration_prefix/gcp-final-inventory.tar.gz"

echo "All deletion gates passed. Deleting dedicated GCP project $gcp_project."
gcloud projects delete "$gcp_project" --quiet

cat <<EOF
GCP project deletion requested: $gcp_project
AWS pre-deletion snapshot: $snapshot_id
Final migration archive: s3://$bucket/$migration_prefix/
Google Cloud project deletion is recoverable during Google's restoration window; Atlas traffic remains on AWS.
EOF
