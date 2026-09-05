#!/usr/bin/env python3
"""Account module "Add" smoke suite — entrypoint.

Drives a real Chromium browser through all 7 Account-module screens
(Chart of Accounts, Journals, Contacts, Products, Analytic Accounts, Budgets,
Journal Entries) with realistic business data, verifies each result twice
(once on screen, once against the live API), and writes a pass/fail report.

Requires the app actually running — this does not start it for you:

    ./scripts/dev.sh                     # in one terminal, leave it running

Then, one-time setup:

    pip install -r qa/requirements.txt
    playwright install chromium

Then run:

    python qa/run_account_module_tests.py
    python qa/run_account_module_tests.py --headed --slowmo 250   # watch it run
    python qa/run_account_module_tests.py --base-url http://localhost:3001

⚠️  This creates real rows via the real UI — a Chart-of-Accounts entry, a
    journal, a vendor contact, a product (+ a product category), an analytic
    account, and a budget. It is purely additive: nothing here deletes,
    archives, or resets data, and it never touches `seed.py --reset`. Point it
    at a disposable/local dev database, not a database you need to keep
    pristine for tomorrow's live demo.

Exit code is 0 only if all 7 screens passed — safe to use as a CI/pre-demo gate.
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from qa.e2e.config import load_config  # noqa: E402
from qa.e2e.data import build_dataset  # noqa: E402
from qa.e2e.report import Report  # noqa: E402
from qa.e2e.runner import run_all  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--base-url", help="Frontend URL (default: http://localhost:3000 or $E2E_BASE_URL)")
    parser.add_argument("--api-url", help="Backend API URL (default: http://localhost:8000/api/v1 or $E2E_API_URL)")
    parser.add_argument("--email", help="Login email (default: seeded demo Admin)")
    parser.add_argument("--password", help="Login password (default: seeded demo password)")
    parser.add_argument("--headed", action="store_true", help="Show the browser window instead of running headless")
    parser.add_argument("--slowmo", type=int, default=None, help="Slow down each Playwright action by N ms (debugging)")
    parser.add_argument("--output-dir", help="Where to write the report (default: qa/reports)")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    config = load_config(
        {
            "E2E_BASE_URL": args.base_url,
            "E2E_API_URL": args.api_url,
            "E2E_EMAIL": args.email,
            "E2E_PASSWORD": args.password,
            "E2E_HEADLESS": False if args.headed else None,
            "E2E_SLOWMO_MS": args.slowmo,
            "E2E_OUTPUT_DIR": args.output_dir,
        }
    )

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print(
            "Playwright isn't installed in this Python environment.\n"
            "  pip install -r qa/requirements.txt\n"
            "  playwright install chromium",
            file=sys.stderr,
        )
        return 2

    dataset = build_dataset()
    started_at = datetime.now(timezone.utc)
    report = Report(started_at=started_at, config=config.__dict__)

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=config.headless, slow_mo=config.slow_mo_ms)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()
        try:
            results = run_all(page, config, dataset)
            for result in results:
                report.add(result)
        finally:
            context.close()
            browser.close()

    report.finished_at = datetime.now(timezone.utc)
    report.print_summary()

    stamp = started_at.strftime("%Y%m%d-%H%M%S")
    json_path = report.to_json(Path(config.output_dir) / f"account-module-{stamp}.json")
    html_path = report.to_html(Path(config.output_dir) / f"account-module-{stamp}.html")
    report.to_html(Path(config.output_dir) / "latest.html")  # stable link for "open the last run"
    print(f"Report written:\n  {json_path}\n  {html_path}\n  {Path(config.output_dir) / 'latest.html'}")

    return 0 if report.all_passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
