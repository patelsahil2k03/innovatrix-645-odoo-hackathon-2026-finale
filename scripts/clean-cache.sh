#!/usr/bin/env bash
# Clear cache files from both Backend (Python/__pycache__/.pytest_cache) and Frontend (.next/tsconfig.tsbuildinfo).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "→ Cleaning Frontend cache (.next, tsconfig.tsbuildinfo)…"
rm -rf frontend/.next
rm -f frontend/tsconfig.tsbuildinfo

echo "→ Cleaning Backend cache (__pycache__, .pytest_cache, .ruff_cache)…"
find backend -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
find backend -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
find backend -type d -name ".ruff_cache" -exec rm -rf {} + 2>/dev/null || true

echo "✓ Cache cleaned successfully!"
