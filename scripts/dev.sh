#!/usr/bin/env bash
# Start the whole dev stack.
#
#   ./scripts/dev.sh              api + web, SQLite (no Docker)   ← default
#   ./scripts/dev.sh --db docker  also start Postgres in Docker
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

USE_DOCKER=0
[[ "${1:-}" == "--db" && "${2:-}" == "docker" ]] && USE_DOCKER=1

# Propagate env to both apps (create from example on first run)
[ -f .env ] || { cp .env.example .env; echo "→ created .env from .env.example"; }
cp .env backend/.env
grep '^NEXT_PUBLIC_' .env > frontend/.env.local || true

# A leftover listener on 3000/8000 is what causes "port in use, using 3001 instead",
# which then breaks CORS in confusing ways. Clear them before starting, not just on exit.
free_ports() { ./scripts/kill-ports.sh >/dev/null 2>&1 || true; }
free_ports

if [ "$USE_DOCKER" = "1" ]; then
  echo "→ starting postgres…"
  docker compose -f infra/docker-compose.yml up -d db
  echo "→ waiting for db health…"
  until [ "$(docker inspect -f '{{.State.Health.Status}}' hackathon-db 2>/dev/null)" = "healthy" ]; do
    sleep 1
  done
fi

cleanup() {
  echo; echo "→ stopping…"
  # `kill 0` alone is unreliable: uvicorn --reload forks a watcher, and Next doesn't
  # always forward SIGTERM to its children. Killing by port ownership works regardless.
  free_ports
  kill 0 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "→ api  http://localhost:8000/docs"
(cd backend && uv sync --extra postgres --quiet && uv run uvicorn app.main:app --reload --port 8000) &

echo "→ web  http://localhost:3000"
(cd frontend && { [ -d node_modules ] || npm install; }; npm run dev) &

wait
