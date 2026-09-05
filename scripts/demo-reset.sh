#!/usr/bin/env bash
# Reset to a clean, fully-seeded demo state.
#
# ⚠️ DESTRUCTIVE: deletes every row in the seeded tables, then re-seeds.
#    The seed script prompts for confirmation unless you pass --yes.
#    Do NOT wire this into anything automatic.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/backend"

uv sync --quiet
uv run alembic upgrade head 2>/dev/null || echo "→ no migrations yet, using create_all"
uv run python -m app.seed --reset "$@"
