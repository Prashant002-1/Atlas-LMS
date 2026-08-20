#!/usr/bin/env bash
set -euo pipefail
umask 077

script_dir="$(cd "$(dirname "$0")" && pwd)"
aws_profile="${AWS_PROFILE:-atlas-sso-admin}"
aws_region="${AWS_REGION:-us-east-1}"
stack_name="${ATLAS_AWS_STACK:-atlas-prod}"
gcp_project="${ATLAS_GCP_PROJECT:-atlas-yc2026fall}"
gcp_zone="${ATLAS_GCP_ZONE:-us-central1-a}"
gcp_instance="${ATLAS_GCP_INSTANCE:-atlas-demo-1}"
gcp_database="${ATLAS_GCP_DATABASE:-atlas-demo-pg}"
release_image="${ATLAS_RELEASE_IMAGE:-}"
confirmation="${ATLAS_CONFIRM_FINAL_MIGRATION:-}"

if [[ "$confirmation" != "$gcp_project-to-$stack_name" ]]; then
  echo "Refusing to stop the source application without ATLAS_CONFIRM_FINAL_MIGRATION=$gcp_project-to-$stack_name" >&2
  exit 2
fi
if [[ "$release_image" != *.dkr.ecr.*.amazonaws.com/*:*release ]]; then
  echo "ATLAS_RELEASE_IMAGE must be the immutable ECR release tag produced by build-push.sh." >&2
  exit 2
fi

for command in aws docker gcloud git jq shasum; do
  command -v "$command" >/dev/null || { echo "Missing required command: $command" >&2; exit 1; }
done

repo_root="$(cd "$script_dir/../.." && pwd)"
cd "$repo_root"
[[ "$(git branch --show-current)" == "main" ]] || { echo "Final migration must run from main." >&2; exit 1; }
[[ "$(git rev-parse HEAD)" == "$(git rev-parse origin/main)" ]] || { echo "Local main must match origin/main." >&2; exit 1; }
git diff --quiet && git diff --cached --quiet || { echo "Tracked worktree changes must be clean." >&2; exit 1; }

migration_id="$(date -u +%Y%m%dT%H%M%SZ)"
prefix="migrations/$migration_id"
remote_dir="/var/tmp/atlas-migration-$migration_id"
work_dir="$(mktemp -d)"
source_stopped=false
migration_complete=false
temporary_role=""
temporary_policy="atlas-final-gcp-migration"

cleanup() {
  set +e
  if [[ -n "$temporary_role" ]]; then
    aws iam delete-role-policy \
      --profile "$aws_profile" \
      --role-name "$temporary_role" \
      --policy-name "$temporary_policy" >/dev/null 2>&1
  fi
  gcloud compute ssh "$gcp_instance" \
    --project="$gcp_project" \
    --zone="$gcp_zone" \
    --tunnel-through-iap \
    --command="sudo rm -rf '$remote_dir'" >/dev/null 2>&1
  if [[ "$source_stopped" == "true" && "$migration_complete" != "true" ]]; then
    gcloud compute ssh "$gcp_instance" \
      --project="$gcp_project" \
      --zone="$gcp_zone" \
      --tunnel-through-iap \
      --command='cd /opt/atlas && sudo docker compose up -d cloud-sql-proxy atlas caddy' >/dev/null 2>&1
    echo "Migration failed; the GCP application was restarted." >&2
  fi
  rm -rf "$work_dir"
}
trap cleanup EXIT INT TERM

caller_account="$(aws sts get-caller-identity --profile "$aws_profile" --query Account --output text)"
[[ "$caller_account" == "118645514521" ]] || { echo "Unexpected AWS account: $caller_account" >&2; exit 1; }
active_gcp_project="$(gcloud config get-value project 2>/dev/null)"
[[ "$active_gcp_project" == "$gcp_project" ]] || { echo "Active gcloud project is $active_gcp_project, expected $gcp_project." >&2; exit 1; }

stack_json="$(aws cloudformation describe-stacks --profile "$aws_profile" --region "$aws_region" --stack-name "$stack_name" --query 'Stacks[0]' --output json)"
[[ "$(jq -r '.StackStatus' <<<"$stack_json")" == *_COMPLETE ]] || { echo "AWS stack is not complete." >&2; exit 1; }
stack_output() {
  jq -r --arg key "$1" '.Outputs[] | select(.OutputKey == $key) | .OutputValue' <<<"$stack_json"
}

instance_id="$(stack_output AppInstanceId)"
database_endpoint="$(stack_output DatabaseEndpoint)"
master_secret_arn="$(stack_output DatabaseMasterSecretArn)"
database_users_secret_arn="$(stack_output DatabaseUserSecretArn)"
runtime_secret_arn="$(stack_output RuntimeSecretArn)"
demo_secret_arn="$(stack_output DemoSmokeSecretArn)"
bucket="$(stack_output MigrationBucket)"

echo "Creating a final on-demand Cloud SQL backup before write freeze."
backup_description="atlas-final-migration-$migration_id"
gcloud sql backups create \
  --project="$gcp_project" \
  --instance="$gcp_database" \
  --description="$backup_description" \
  --quiet
backup_id="$(
  gcloud sql backups list \
    --project="$gcp_project" \
    --instance="$gcp_database" \
    --filter="description=$backup_description AND status=SUCCESSFUL" \
    --sort-by='~endTime' \
    --limit=1 \
    --format='value(id)'
)"
[[ -n "$backup_id" ]] || { echo "Final Cloud SQL backup did not reach SUCCESSFUL." >&2; exit 1; }

echo "Stopping the GCP application to establish the final write boundary."
gcloud compute ssh "$gcp_instance" \
  --project="$gcp_project" \
  --zone="$gcp_zone" \
  --tunnel-through-iap \
  --command='cd /opt/atlas && sudo docker compose stop atlas'
source_stopped=true

dump_command="set -euo pipefail; sudo install -d -m 0700 '$remote_dir'; sudo docker run --rm --network atlas_private --env-file /etc/atlas/atlas.env --volume '$remote_dir:/backup' postgres:16-alpine sh -euc 'pg_dump --format=custom --compress=6 --no-owner --no-acl --file=/backup/atlas.dump \"\$DATABASE_URL\"; pg_dump --format=custom --compress=6 --no-owner --no-acl --file=/backup/atlas_workflow.dump \"\$WORKFLOW_POSTGRES_URL\"'; sudo chown -R \$(id -u):\$(id -g) '$remote_dir'"
gcloud compute ssh "$gcp_instance" \
  --project="$gcp_project" \
  --zone="$gcp_zone" \
  --tunnel-through-iap \
  --command="$dump_command"

gcloud compute scp \
  "$gcp_instance:$remote_dir/atlas.dump" \
  "$gcp_instance:$remote_dir/atlas_workflow.dump" \
  "$work_dir/" \
  --project="$gcp_project" \
  --zone="$gcp_zone" \
  --tunnel-through-iap

gcloud compute ssh "$gcp_instance" \
  --project="$gcp_project" \
  --zone="$gcp_zone" \
  --tunnel-through-iap \
  --command='sudo cat /etc/atlas/atlas.env' > "$work_dir/runtime.source.env"
gcloud secrets versions access latest --project="$gcp_project" --secret=atlas-db-password > "$work_dir/app-password"
gcloud secrets versions access latest --project="$gcp_project" --secret=atlas-workflow-db-password > "$work_dir/workflow-password"
gcloud secrets versions access latest --project="$gcp_project" --secret=atlas-yc-password > "$work_dir/yc-password"
gcloud secrets versions access latest --project="$gcp_project" --secret=atlas-spc-password > "$work_dir/spc-password"

app_password="$(tr -d '\r\n' < "$work_dir/app-password")"
workflow_password="$(tr -d '\r\n' < "$work_dir/workflow-password")"
[[ "$app_password" =~ ^[A-Za-z0-9._~-]{32,}$ ]] || { echo "Application database password has an unsafe format." >&2; exit 1; }
[[ "$workflow_password" =~ ^[A-Za-z0-9._~-]{32,}$ ]] || { echo "Workflow database password has an unsafe format." >&2; exit 1; }

awk '
  !/^(DATABASE_URL|WORKFLOW_POSTGRES_URL|AUTH_URL|ATLAS_PUBLIC_APP_URL|AWS_REGION|AWS_DEFAULT_REGION|ATLAS_CODE_EXECUTION_ENABLED)=/
' "$work_dir/runtime.source.env" > "$work_dir/runtime.aws.env"
cat >> "$work_dir/runtime.aws.env" <<EOF
DATABASE_URL=postgres://atlas_app:$app_password@$database_endpoint:5432/atlas?sslmode=verify-full&sslrootcert=/etc/ssl/certs/aws-rds-global-bundle.pem
WORKFLOW_POSTGRES_URL=postgres://atlas_workflow:$workflow_password@$database_endpoint:5432/atlas_workflow?sslmode=verify-full&sslrootcert=/etc/ssl/certs/aws-rds-global-bundle.pem
AUTH_URL=https://demo.atlas-lms.com
ATLAS_PUBLIC_APP_URL=https://demo.atlas-lms.com
AWS_REGION=$aws_region
ATLAS_CODE_EXECUTION_ENABLED=false
EOF

jq -n \
  --arg atlasAppPassword "$app_password" \
  --arg atlasWorkflowPassword "$workflow_password" \
  '{atlasAppPassword:$atlasAppPassword,atlasWorkflowPassword:$atlasWorkflowPassword}' > "$work_dir/database-users.json"
jq -n \
  --rawfile ycPassword "$work_dir/yc-password" \
  --rawfile spcPassword "$work_dir/spc-password" \
  '{ycPassword:($ycPassword|gsub("[\\r\\n]+$";"")),spcPassword:($spcPassword|gsub("[\\r\\n]+$";""))}' > "$work_dir/demo-smoke.json"

(
  cd "$work_dir"
  shasum -a 256 atlas.dump atlas_workflow.dump | sed 's/^\\([0-9a-f]*\\)  /\\1  /' > SHA256SUMS
)
jq -n \
  --arg migrationId "$migration_id" \
  --arg sourceProject "$gcp_project" \
  --arg sourceInstance "$gcp_database" \
  --arg sourceBackupId "$backup_id" \
  --arg destinationStack "$stack_name" \
  --arg releaseImage "$release_image" \
  --arg sourceCommit "$(git rev-parse HEAD)" \
  '{migrationId:$migrationId,source:{project:$sourceProject,instance:$sourceInstance,backupId:$sourceBackupId},destination:{stack:$destinationStack},releaseImage:$releaseImage,sourceCommit:$sourceCommit,createdAt:($migrationId)}' > "$work_dir/manifest.json"

aws secretsmanager put-secret-value --profile "$aws_profile" --region "$aws_region" --secret-id "$runtime_secret_arn" --secret-string "file://$work_dir/runtime.aws.env" >/dev/null
aws secretsmanager put-secret-value --profile "$aws_profile" --region "$aws_region" --secret-id "$database_users_secret_arn" --secret-string "file://$work_dir/database-users.json" >/dev/null
aws secretsmanager put-secret-value --profile "$aws_profile" --region "$aws_region" --secret-id "$demo_secret_arn" --secret-string "file://$work_dir/demo-smoke.json" >/dev/null

for file in atlas.dump atlas_workflow.dump SHA256SUMS manifest.json; do
  aws s3 cp \
    --profile "$aws_profile" \
    --region "$aws_region" \
    --sse AES256 \
    --only-show-errors \
    "$work_dir/$file" \
    "s3://$bucket/$prefix/$file"
done
aws s3 cp \
  --profile "$aws_profile" \
  --region "$aws_region" \
  --sse AES256 \
  --only-show-errors \
  "$script_dir/restore-rds-on-host.sh" \
  "s3://$bucket/$prefix/restore-rds-on-host.sh"

instance_profile_arn="$(aws ec2 describe-instances --profile "$aws_profile" --region "$aws_region" --instance-ids "$instance_id" --query 'Reservations[0].Instances[0].IamInstanceProfile.Arn' --output text)"
instance_profile_name="${instance_profile_arn##*/}"
temporary_role="$(aws iam get-instance-profile --profile "$aws_profile" --instance-profile-name "$instance_profile_name" --query 'InstanceProfile.Roles[0].RoleName' --output text)"

jq -n \
  --arg objectArn "arn:aws:s3:::$bucket/$prefix/*" \
  --arg masterSecret "$master_secret_arn" \
  --arg usersSecret "$database_users_secret_arn" \
  '{Version:"2012-10-17",Statement:[{Sid:"ReadFinalMigrationArchive",Effect:"Allow",Action:["s3:GetObject"],Resource:$objectArn},{Sid:"ReadRestoreCredentials",Effect:"Allow",Action:["secretsmanager:GetSecretValue"],Resource:[$masterSecret,$usersSecret]}]}' > "$work_dir/temporary-policy.json"
aws iam put-role-policy \
  --profile "$aws_profile" \
  --role-name "$temporary_role" \
  --policy-name "$temporary_policy" \
  --policy-document "file://$work_dir/temporary-policy.json"

restore_command="set -euo pipefail; restore=/var/tmp/atlas-restore-rds.sh; aws s3 cp --region '$aws_region' 's3://$bucket/$prefix/restore-rds-on-host.sh' \"\$restore\" --only-show-errors; chmod 0700 \"\$restore\"; sudo \"\$restore\" '$bucket' '$prefix' '$aws_region' '$database_endpoint' '$master_secret_arn' '$database_users_secret_arn'; rm -f \"\$restore\""
restore_parameters="$(jq -cn --arg command "$restore_command" '{commands:[$command]}')"
command_id="$(aws ssm send-command --profile "$aws_profile" --region "$aws_region" --instance-ids "$instance_id" --document-name AWS-RunShellScript --comment "Restore Atlas GCP backup $migration_id to RDS" --parameters "$restore_parameters" --query 'Command.CommandId' --output text)"
aws ssm wait command-executed --profile "$aws_profile" --region "$aws_region" --command-id "$command_id" --instance-id "$instance_id" || true
restore_invocation="$(aws ssm get-command-invocation --profile "$aws_profile" --region "$aws_region" --command-id "$command_id" --instance-id "$instance_id" --query '{Status:Status,Output:StandardOutputContent,Error:StandardErrorContent}' --output json)"
jq . <<<"$restore_invocation"
[[ "$(jq -r '.Status' <<<"$restore_invocation")" == "Success" ]] || { echo "RDS restore failed." >&2; exit 1; }

repository_host="${release_image%%/*}"
release_command="set -euo pipefail; runtime=\$(mktemp /etc/atlas/release.XXXXXX); trap 'rm -f \"\$runtime\"' EXIT; test -s /etc/atlas/rds-global-bundle.pem; aws secretsmanager get-secret-value --region '$aws_region' --secret-id '$runtime_secret_arn' --query SecretString --output text > \"\$runtime\"; chmod 0600 \"\$runtime\"; aws ecr get-login-password --region '$aws_region' | docker login --username AWS --password-stdin '$repository_host' >/dev/null; docker pull '$release_image' >/dev/null; docker run --rm --network host --env-file \"\$runtime\" --volume /etc/atlas/rds-global-bundle.pem:/etc/ssl/certs/aws-rds-global-bundle.pem:ro '$release_image' npm run db:upgrade -- --allow-remote; docker run --rm --network host --env-file \"\$runtime\" --volume /etc/atlas/rds-global-bundle.pem:/etc/ssl/certs/aws-rds-global-bundle.pem:ro '$release_image' npm run db:check"
release_parameters="$(jq -cn --arg command "$release_command" '{commands:[$command]}')"
release_command_id="$(aws ssm send-command --profile "$aws_profile" --region "$aws_region" --instance-ids "$instance_id" --document-name AWS-RunShellScript --comment "Apply Atlas release migrations $migration_id" --parameters "$release_parameters" --query 'Command.CommandId' --output text)"
aws ssm wait command-executed --profile "$aws_profile" --region "$aws_region" --command-id "$release_command_id" --instance-id "$instance_id" || true
release_invocation="$(aws ssm get-command-invocation --profile "$aws_profile" --region "$aws_region" --command-id "$release_command_id" --instance-id "$instance_id" --query '{Status:Status,Output:StandardOutputContent,Error:StandardErrorContent}' --output json)"
jq . <<<"$release_invocation"
[[ "$(jq -r '.Status' <<<"$release_invocation")" == "Success" ]] || { echo "Release migration failed." >&2; exit 1; }

aws iam delete-role-policy \
  --profile "$aws_profile" \
  --role-name "$temporary_role" \
  --policy-name "$temporary_policy"
temporary_role=""
migration_complete=true

cat <<EOF
Final database migration completed.
Migration archive: s3://$bucket/$prefix/
Source Cloud SQL backup: $backup_id
GCP application state: stopped
Next: deploy the immutable application digest, verify locally through SSM, then change DNS.
EOF
