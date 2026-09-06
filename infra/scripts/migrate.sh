#!/bin/sh
set -eu
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
cd "$ROOT"
docker compose -f infra/compose/docker-compose.yml -f infra/compose/docker-compose.prod.yml --env-file "${ENV_FILE:-.env.prod}" --profile migrate run --rm migrate
