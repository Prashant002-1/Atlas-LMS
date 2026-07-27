#!/usr/bin/env bash
set -euo pipefail

cd /opt/atlas
docker compose pull
docker compose up -d --remove-orphans
docker compose ps
