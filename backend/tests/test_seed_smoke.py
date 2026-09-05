"""Regression guards for the seed script.

WHY THIS FILE EXISTS
  In the previous hackathon a merge silently deleted the `def main():` header from
  seed.py. Python happily attached the orphaned body to the function above it, so the
  module still imported and nothing failed loudly — but `python -m app.seed` and the
  console-script entry point were both broken, and the documented setup path stayed
  broken for weeks because the only seed-adjacent test never imported seed.py itself.

  These tests import and execute the real entry point.
"""

import subprocess
import sys

from sqlalchemy import select

from app.models.auth import Role, User
from app.seed import seed as seed_module
from app.seed.seed import seed_all


def test_main_exists_and_is_callable():
    """The exact regression that bit us: the entry point must be a real top-level
    function, not code absorbed into the function above it."""
    assert hasattr(seed_module, "main"), "seed.py lost its `def main():` header"
    assert callable(seed_module.main)


def test_console_script_entry_point_resolves():
    """pyproject declares `app-seed = "app.seed.seed:main"`. If that target stops
    existing, the installed command breaks with an ImportError at runtime."""
    from importlib import import_module

    module = import_module("app.seed.seed")
    assert callable(getattr(module, "main", None))


def test_module_is_runnable_via_dash_m():
    """`python -m app.seed --help` must not traceback — this is the documented
    first-run command in both READMEs."""
    result = subprocess.run(
        [sys.executable, "-m", "app.seed", "--help"],
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert result.returncode == 0, f"stdout={result.stdout}\nstderr={result.stderr}"
    assert "--reset" in result.stdout


def test_seed_creates_roles_and_users(db):
    assert db.execute(select(Role)).scalars().first() is not None
    assert db.execute(select(User)).scalars().first() is not None


def test_seed_is_idempotent(db):
    """Re-running the seed must not duplicate users — the demo-reset script runs it
    repeatedly and duplicate emails would violate the unique constraint."""
    before = len(db.execute(select(User)).scalars().all())
    seed_all(db)
    after = len(db.execute(select(User)).scalars().all())
    assert before == after


def test_seeded_password_actually_verifies(db):
    """Guards the passlib→bcrypt migration: if hashing ever silently changes, every
    demo login breaks at the worst possible moment."""
    from app.core.security import verify_password
    from app.core.settings import get_settings

    user = db.execute(select(User).where(User.email == "admin@urbanfurniture.in")).scalar_one()
    assert verify_password(get_settings().seed_password, user.password_hash)
