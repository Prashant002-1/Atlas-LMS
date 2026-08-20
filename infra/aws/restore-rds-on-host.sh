#!/usr/bin/env bash
set -euo pipefail

if (( $# != 6 )); then
  echo "Usage: $0 <bucket> <prefix> <region> <rds-endpoint> <master-secret-arn> <database-users-secret-arn>" >&2
  exit 2
fi

bucket="$1"
prefix="$2"
region="$3"
database_endpoint="$4"
master_secret_arn="$5"
database_users_secret_arn="$6"

work_dir="$(mktemp -d /var/tmp/atlas-rds-restore.XXXXXX)"
trap 'rm -rf "$work_dir"' EXIT
chmod 0700 "$work_dir"

for file in atlas.dump atlas_workflow.dump SHA256SUMS; do
  aws s3 cp \
    --region "$region" \
    "s3://$bucket/$prefix/$file" \
    "$work_dir/$file" \
    --only-show-errors
done

(
  cd "$work_dir"
  sha256sum --check SHA256SUMS
)

aws secretsmanager get-secret-value \
  --region "$region" \
  --secret-id "$master_secret_arn" \
  --query SecretString \
  --output text > "$work_dir/master.json"
aws secretsmanager get-secret-value \
  --region "$region" \
  --secret-id "$database_users_secret_arn" \
  --query SecretString \
  --output text > "$work_dir/users.json"
chmod 0600 "$work_dir/master.json" "$work_dir/users.json"

master_user="$(jq -er '.username' "$work_dir/master.json")"
master_password="$(jq -er '.password' "$work_dir/master.json")"
app_password="$(jq -er '.atlasAppPassword' "$work_dir/users.json")"
workflow_password="$(jq -er '.atlasWorkflowPassword' "$work_dir/users.json")"

[[ "$app_password" =~ ^[A-Za-z0-9._~-]{32,}$ ]] || { echo "Application database password has an unsafe format." >&2; exit 1; }
[[ "$workflow_password" =~ ^[A-Za-z0-9._~-]{32,}$ ]] || { echo "Workflow database password has an unsafe format." >&2; exit 1; }

pgpass_line() {
  local user="$1"
  local password="$2"
  password="${password//\\/\\\\}"
  password="${password//:/\\:}"
  printf '%s:5432:*:%s:%s\n' "$database_endpoint" "$user" "$password"
}

pgpass_line "$master_user" "$master_password" > "$work_dir/master.pgpass"
pgpass_line atlas_app "$app_password" > "$work_dir/app.pgpass"
pgpass_line atlas_workflow "$workflow_password" > "$work_dir/workflow.pgpass"
chmod 0600 "$work_dir"/*.pgpass

cat > "$work_dir/bootstrap.sql" <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'atlas_app') THEN
    CREATE ROLE atlas_app LOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'atlas_workflow') THEN
    CREATE ROLE atlas_workflow LOGIN;
  END IF;
END
\$\$;
ALTER ROLE atlas_app LOGIN PASSWORD '$app_password';
ALTER ROLE atlas_workflow LOGIN PASSWORD '$workflow_password';
ALTER DATABASE atlas OWNER TO atlas_app;
SELECT 'CREATE DATABASE atlas_workflow OWNER atlas_workflow'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'atlas_workflow')\gexec
ALTER DATABASE atlas_workflow OWNER TO atlas_workflow;
SQL
chmod 0600 "$work_dir/bootstrap.sql"

docker run --rm --network host \
  --volume "$work_dir:/work:ro" \
  --env PGPASSFILE=/work/master.pgpass \
  postgres:16-alpine \
  psql --host "$database_endpoint" --username "$master_user" --dbname postgres \
    --set ON_ERROR_STOP=1 --file /work/bootstrap.sql

docker run --rm --network host \
  --volume "$work_dir:/work:ro" \
  --env PGPASSFILE=/work/master.pgpass \
  postgres:16-alpine \
  psql --host "$database_endpoint" --username "$master_user" --dbname atlas \
    --set ON_ERROR_STOP=1 --command 'CREATE EXTENSION IF NOT EXISTS vector'

docker run --rm --network host \
  --volume "$work_dir:/work" \
  postgres:16-alpine \
  sh -euc "pg_restore --list /work/atlas.dump | grep -v ' EXTENSION - vector ' | grep -v ' COMMENT - EXTENSION vector ' > /work/atlas.list"

docker run --rm --network host \
  --volume "$work_dir:/work:ro" \
  --env PGPASSFILE=/work/app.pgpass \
  postgres:16-alpine \
  pg_restore --host "$database_endpoint" --username atlas_app --dbname atlas \
    --clean --if-exists --no-owner --no-acl --exit-on-error --use-list /work/atlas.list /work/atlas.dump

docker run --rm --network host \
  --volume "$work_dir:/work:ro" \
  --env PGPASSFILE=/work/workflow.pgpass \
  postgres:16-alpine \
  pg_restore --host "$database_endpoint" --username atlas_workflow --dbname atlas_workflow \
    --clean --if-exists --no-owner --no-acl --exit-on-error /work/atlas_workflow.dump

docker run --rm --network host \
  --volume "$work_dir:/work:ro" \
  --env PGPASSFILE=/work/app.pgpass \
  postgres:16-alpine \
  psql --host "$database_endpoint" --username atlas_app --dbname atlas \
    --set ON_ERROR_STOP=1 --command 'ANALYZE' \
    --command "SELECT current_database() AS database, count(*) AS public_tables FROM pg_tables WHERE schemaname = 'public'"

docker run --rm --network host \
  --volume "$work_dir:/work:ro" \
  --env PGPASSFILE=/work/workflow.pgpass \
  postgres:16-alpine \
  psql --host "$database_endpoint" --username atlas_workflow --dbname atlas_workflow \
    --set ON_ERROR_STOP=1 --command 'ANALYZE' \
    --command "SELECT current_database() AS database, count(*) AS non_system_tables FROM pg_tables WHERE schemaname NOT IN ('pg_catalog', 'information_schema')"

echo "RDS restore completed and local restore material was removed."
