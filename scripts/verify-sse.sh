#!/usr/bin/env bash
# Prove the real-time stream works end to end, against a REAL server.
#
# Why a script instead of a pytest case: EventSourceResponse (sse-starlette 3.x)
# cannot be driven by starlette's TestClient or httpx's ASGITransport — both hang on
# an endpoint that never finishes. That's a harness limitation, not a broken endpoint.
# This script is the real check. Run it after touching anything in the events path.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/backend"

PORT="${PORT:-8931}"
DB="/tmp/verify_sse_$$.db"
COOKIES="/tmp/verify_sse_cookies_$$.txt"
OUT="/tmp/verify_sse_out_$$.txt"

export DATABASE_URL="sqlite:///$DB"
export SIMULATOR_ENABLED=true
export SIMULATOR_INTERVAL_SECONDS=2

cleanup() {
  [ -n "${SERVER_PID:-}" ] && kill "$SERVER_PID" 2>/dev/null || true
  rm -f "$DB" "$COOKIES" "$OUT"
}
trap cleanup EXIT

echo "→ seeding a throwaway database…"
uv run python -c "
from app.core.database import SessionLocal, engine
from app.models import Base
from app.seed.seed import seed_all
Base.metadata.create_all(bind=engine)
s = SessionLocal(); seed_all(s); s.close()
" >/dev/null

echo "→ starting server on :$PORT…"
uv run uvicorn app.main:app --port "$PORT" --log-level warning >/dev/null 2>&1 &
SERVER_PID=$!
sleep 6

echo "→ signing in…"
curl -s -c "$COOKIES" -X POST "http://127.0.0.1:$PORT/api/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"admin@demo.in\",\"password\":\"${SEED_PASSWORD:-Demo@1234}\"}" -o /dev/null

echo "→ reading the event stream for 6s…"
timeout 6 curl -sN -b "$COOKIES" "http://127.0.0.1:$PORT/api/v1/events" -o "$OUT" || true

echo
echo "──────── received ────────"
cat "$OUT"
echo "──────────────────────────"

if grep -q "event: connected" "$OUT"; then
  echo "✅ SSE stream works (connected frame received)"
  grep -q "kpi.refresh" "$OUT" && echo "✅ simulator is publishing live events"
  exit 0
else
  echo "❌ No 'connected' frame — the events endpoint is broken."
  exit 1
fi
