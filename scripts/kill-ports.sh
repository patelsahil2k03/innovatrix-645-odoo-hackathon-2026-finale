#!/usr/bin/env bash
# Free up the dev ports this repo uses.
#
#   ./scripts/kill-ports.sh          frontend (3000) + backend (8000)   ← default
#   ./scripts/kill-ports.sh --all    also postgres + adminer (infra/docker-compose.yml)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PORTS=(3000 8000)

if [[ "${1:-}" == "--all" ]]; then
  [ -f .env ] && source .env
  PORTS+=("${POSTGRES_PORT:-5432}" "${ADMINER_PORT:-8081}")
fi

for port in "${PORTS[@]}"; do
  if fuser -k "${port}/tcp" >/dev/null 2>&1; then
    echo "→ killed process on :${port}"
  else
    echo "→ :${port} already free"
  fi
done
