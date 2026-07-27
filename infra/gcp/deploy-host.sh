#!/usr/bin/env bash
set -euo pipefail

cd /opt/atlas

atlas_image="$(sed -n 's/^ATLAS_IMAGE=//p' .env)"
registry_host="${atlas_image%%/*}"

case "$registry_host" in
  *.pkg.dev) ;;
  *)
    echo "ATLAS_IMAGE must use an Artifact Registry host." >&2
    exit 1
    ;;
esac

token_response="$(
  curl -fsS \
    -H 'Metadata-Flavor: Google' \
    'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token'
)"
access_token="$(
  printf '%s' "$token_response" |
    sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p'
)"

if [[ -z "$access_token" ]]; then
  echo "Could not obtain an Artifact Registry access token." >&2
  exit 1
fi

docker_config="$(mktemp -d)"
trap 'rm -rf "$docker_config"' EXIT

printf '%s' "$access_token" |
  DOCKER_CONFIG="$docker_config" docker login \
    --username oauth2accesstoken \
    --password-stdin \
    "https://${registry_host}" >/dev/null
unset access_token token_response

DOCKER_CONFIG="$docker_config" docker compose pull
docker compose up -d --remove-orphans
docker compose ps
