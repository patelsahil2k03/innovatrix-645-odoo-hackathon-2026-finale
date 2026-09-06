"""Environment-driven configuration — no hard-coded venue assumptions.

Defaults match `scripts/dev.sh` (frontend :3000, backend :8000/api/v1) and the
seeded demo Admin account from `backend/src/app/seed/seed.py`, so a teammate can
just run this against a freshly seeded local stack with zero flags.
"""

from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Config:
    base_url: str
    api_url: str
    email: str
    password: str
    headless: bool
    slow_mo_ms: int
    timeout_ms: int
    output_dir: str


def load_config(overrides: dict | None = None) -> Config:
    overrides = overrides or {}

    def env(key: str, default: str) -> str:
        return overrides.get(key) or os.environ.get(key, default)

    def env_bool(key: str, default: bool) -> bool:
        if key in overrides and overrides[key] is not None:
            return bool(overrides[key])
        raw = os.environ.get(key)
        if raw is None:
            return default
        return raw.strip().lower() not in {"0", "false", "no", ""}

    def env_int(key: str, default: int) -> int:
        if key in overrides and overrides[key] is not None:
            return int(overrides[key])
        raw = os.environ.get(key)
        return int(raw) if raw else default

    return Config(
        base_url=env("E2E_BASE_URL", "http://localhost:3000").rstrip("/"),
        api_url=env("E2E_API_URL", "http://localhost:8000/api/v1").rstrip("/"),
        # Seeded demo Admin — Admin and Accountant may both create master data
        # (docs/04_API_CONTRACT.md §3.1); Admin is used so the run also proves
        # the archive/modify-capable path is reachable, not just create.
        email=env("E2E_EMAIL", "admin@urbanfurniture.in"),
        password=env("E2E_PASSWORD", "Demo@1234"),
        headless=env_bool("E2E_HEADLESS", True),
        slow_mo_ms=env_int("E2E_SLOWMO_MS", 0),
        # Generous on purpose: Next.js dev mode (Turbopack) compiles each route
        # JIT on its first request in a given server process — a route nobody
        # has hit yet can take much longer than a normal interaction timeout
        # would suggest. `run_all()` also does a best-effort warm-up pass before
        # the timed/asserted run for exactly this reason (qa/e2e/runner.py).
        timeout_ms=env_int("E2E_TIMEOUT_MS", 45_000),
        output_dir=env("E2E_OUTPUT_DIR", "qa/reports"),
    )
