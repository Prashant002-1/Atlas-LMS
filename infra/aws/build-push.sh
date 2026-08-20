#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
repo_root="$(cd "$script_dir/../.." && pwd)"
aws_profile="${AWS_PROFILE:-your-profile}"
aws_region="${AWS_REGION:-us-east-1}"
stack_name="${ATLAS_AWS_STACK:-atlas-prod}"

cd "$repo_root"

if [[ "$(git branch --show-current)" != "main" ]]; then
  echo "Builds must run from main." >&2
  exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Tracked working-tree changes must be committed before building." >&2
  exit 1
fi

if [[ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]]; then
  echo "Local main must exactly match origin/main before building." >&2
  exit 1
fi

source_commit="$(git rev-parse HEAD)"
image_tag="${source_commit:0:12}"
repository_uri="$(
  aws cloudformation describe-stacks \
    --profile "$aws_profile" \
    --region "$aws_region" \
    --stack-name "$stack_name" \
    --query 'Stacks[0].Outputs[?OutputKey==`ImageRepositoryUri`].OutputValue | [0]' \
    --output text
)"
repository_name="${repository_uri#*/}"
registry_host="${repository_uri%%/*}"

build_context="$(mktemp -d)"
trap 'rm -rf "$build_context"' EXIT
git archive HEAD | tar -x -C "$build_context"

aws ecr get-login-password --profile "$aws_profile" --region "$aws_region" |
  docker login --username AWS --password-stdin "$registry_host" >/dev/null

docker buildx build \
  --platform linux/arm64 \
  --target runner \
  --tag "$repository_uri:$image_tag" \
  --push \
  "$build_context"

docker buildx build \
  --platform linux/arm64 \
  --target builder \
  --tag "$repository_uri:$image_tag-release" \
  --push \
  "$build_context"

image_digest="$(
  aws ecr describe-images \
    --profile "$aws_profile" \
    --region "$aws_region" \
    --repository-name "$repository_name" \
    --image-ids "imageTag=$image_tag" \
    --query 'imageDetails[0].imageDigest' \
    --output text
)"

printf 'SOURCE_COMMIT=%s\n' "$source_commit"
printf 'APP_IMAGE=%s@%s\n' "$repository_uri" "$image_digest"
printf 'RELEASE_IMAGE=%s:%s-release\n' "$repository_uri" "$image_tag"
