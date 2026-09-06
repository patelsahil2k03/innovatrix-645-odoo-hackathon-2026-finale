#!/usr/bin/env bash
# Start everything for development.
#
#   ./scripts/dev.sh        ← the only command. Everyone runs this.
#
# There is no database flag to get wrong. `DATABASE_URL` in .env already says
# whether this machine hosts the database or connects to someone else's, so this
# script reads it and does the right thing:
#
#   DATABASE_URL points at localhost  → you host it; the container is started here
#   DATABASE_URL points at an IP      → someone else hosts it; nothing is started,
#                                       the connection is checked before booting
set -euo pipefail

# A user added to the `docker` group after their session started won't see it
# reflected in `id`/`groups` until they log out and back in — `docker` then
# fails with "permission denied ... docker.sock" no matter how this script is
# invoked. If that's exactly the situation (group exists, we're a member, but
# the current session doesn't have it active), transparently re-exec under
# `sg docker` instead of making every teammate do this by hand. No-op on any
# machine where that isn't the case (no docker group, already active, etc).
if command -v sg >/dev/null 2>&1 \
  && getent group docker >/dev/null 2>&1 \
  && id -nG "$USER" 2>/dev/null | grep -qw docker \
  && ! id -nG 2>/dev/null | grep -qw docker; then
  exec sg docker -c "$(printf '%q ' "$0" "$@")"
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# One .env at the repo root — backend reads it by path (app/core/settings.py),
# no per-app copy needed. Only the frontend needs a generated file, since Next
# only inlines NEXT_PUBLIC_* vars from its own .env.local.
[ -f .env ] || { cp .env.example .env; echo "→ created .env from .env.example"; }
grep '^NEXT_PUBLIC_' .env > frontend/.env.local || true

DB_URL="$(grep -E '^DATABASE_URL=' .env | tail -1 | cut -d= -f2-)"
# Host between "@" and the following ":" or "/". Empty for a sqlite URL.
DB_HOST="$(printf '%s' "$DB_URL" | sed -n 's|.*@\([^:/]*\).*|\1|p')"

# A leftover listener on 3000/8000 is what causes "port in use, using 3001 instead".
free_ports() { ./scripts/kill-ports.sh >/dev/null 2>&1 || true; }
free_ports

case "$DB_URL" in
  sqlite:*)
    echo "→ using SQLite database ($DB_URL)"
    ;;
  *)
    case "$DB_HOST" in
      localhost|127.0.0.1|"")
        if ! command -v docker >/dev/null 2>&1; then
          echo "→ Docker not installed — falling back to SQLite database (sqlite:///./app.db)"
          DB_URL="sqlite:///./app.db"
          export DATABASE_URL="$DB_URL"
        else
          echo "→ this machine hosts the database — starting postgres…"
          # --env-file is required: compose otherwise looks for .env next to
          # infra/docker-compose.yml, not here, and silently falls back to the
          # "app"/"app" default credentials instead of the real ones below.
          docker compose --env-file .env -f infra/docker-compose.yml up -d db
          until [ "$(docker inspect -f '{{.State.Health.Status}}' hackathon-db 2>/dev/null)" = "healthy" ]; do
            sleep 1
          done
          DB_PORT="$(grep -E '^POSTGRES_PORT=' .env | tail -1 | cut -d= -f2-)"
          echo "→ postgres healthy. Teammates connect with:"
          echo "     DATABASE_URL=…@$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost"):${DB_PORT:-5432}/app"
        fi
        ;;
      *)
        echo "→ using the shared database on $DB_HOST (not starting one here)"
        # Fail loudly now rather than as a wall of tracebacks after both servers boot.
        if ! (exec 3<>"/dev/tcp/$DB_HOST/5432") 2>/dev/null; then
          echo "✗ cannot reach $DB_HOST:5432 — is that machine up, and are you both on"
          echo "  the same network? See docs/01_STACK.md §3.2." >&2
          exit 1
        fi
        ;;
    esac
    ;;
esac

# Declared before the handler that reads them: cleanup can run at any point after
# the trap is armed, and `set -u` would otherwise turn the cleanup handler itself
# into the error being reported.
API_PID=""
WEB_PID=""

cleanup() {
  # Disarm FIRST. This handler used to end with `kill 0`, which signals the whole
  # process group — the script included — so the TERM it sent re-entered this very
  # function and printed "stopping…" forever on a single Ctrl+C.
  trap - EXIT INT TERM

  echo; echo "→ stopping…"
  # Kill the two children we started, then sweep by port: uvicorn --reload forks a
  # watcher and Next doesn't always forward SIGTERM, so the PIDs alone miss
  # grandchildren. Killing by port ownership catches whatever is left.
  for pid in "$API_PID" "$WEB_PID"; do
    [ -n "$pid" ] && kill "$pid" 2>/dev/null || true
  done
  free_ports
}
trap cleanup EXIT INT TERM

echo "→ running database migrations & seed setup…"
(cd backend && uv run alembic upgrade head >/dev/null 2>&1 && uv run python -m app.seed >/dev/null 2>&1) || true

echo "→ api  http://localhost:8000/docs"
(cd backend && uv sync --extra postgres --quiet && uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000) &
API_PID=$!

echo "→ web  http://localhost:3000"
(cd frontend && { [ -d node_modules ] || npm install; }; npm run dev) &
WEB_PID=$!

wait
