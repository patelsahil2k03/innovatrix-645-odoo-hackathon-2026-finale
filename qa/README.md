# Account module — Add-flow smoke suite

A Playwright script that clicks through the real UI, exactly the way a person
would, and proves the "Add" action on all 7 Account-module screens actually
works end to end — not just that the form renders.

| # | Screen | What's proved |
|---|---|---|
| 1 | Chart of Accounts | A new account can be created and is retrievable via the API |
| 2 | Journals | A journal posts with its default debit/credit accounts wired |
| 3 | Contacts | A vendor contact is created with a full address |
| 4 | Products | Sales/cost price + tax %, **and** the inline "create a category on the fly" modal |
| 5 | Analytic Accounts | The budget-tagging dimension can be created |
| 6 | Budgets | A budget line chains onto the Contact and Analytic Account created above, and `achieved` computes to 0 (nothing posted yet) |
| 7 | Journal Entries | **Negative test** — proves there is deliberately no create form here |

Every screen is checked twice: once **on screen** (the value the UI shows back
after redirecting to the detail page) and once against the **live API** for the
id the UI redirected to. A screen only counts as a pass if both agree.

## Setup (one-time)

```bash
pip install -r qa/requirements.txt
playwright install chromium
```

(Or, without touching your global Python: `uv run --with-requirements
qa/requirements.txt python qa/run_account_module_tests.py` from the repo root —
`uv` will resolve a throwaway environment for the one run.)

## Run it

The app has to actually be running first — this script doesn't start it:

```bash
./scripts/dev.sh          # in its own terminal, leave it running
```

Then, in another terminal:

```bash
python qa/run_account_module_tests.py
```

Useful flags:

```bash
python qa/run_account_module_tests.py --headed --slowmo 250   # watch it click through
python qa/run_account_module_tests.py --base-url http://localhost:3001
python qa/run_account_module_tests.py --email accountant@urbanfurniture.in --password Demo@1234
```

Everything is also overridable by environment variable
(`E2E_BASE_URL`, `E2E_API_URL`, `E2E_EMAIL`, `E2E_PASSWORD`, `E2E_HEADLESS`,
`E2E_SLOWMO_MS`, `E2E_OUTPUT_DIR`) — see `qa/e2e/config.py`.

Exit code is `0` only if all 7 screens passed, so this is safe to wire into a
pre-demo checklist or CI step: `python qa/run_account_module_tests.py || echo
"add-flow regression — do not demo yet"`.

## The data

`qa/e2e/data.py` builds realistic Indian furniture-business data for every
screen — not `Test User 1` — largely lifted straight from
[`docs/PROBLEM_STATEMENT.md`](../docs/PROBLEM_STATEMENT.md)'s own worked
examples (the vendor **Azure Furniture**, GST-shaped tax rates, real Gujarat
addresses). The handful of fields that are actually unique in the schema
(account `code`, contact `email`) get a run-scoped suffix appended so the
suite can be re-run against the same database without a `409 CONFLICT` on the
second run.

## Safety

This is **additive only** — it creates one new row per screen (six real
records: an account, a journal, a contact, a product + product category, an
analytic account, a budget) via the real UI and real API. It never deletes,
archives, or resets anything, and it never touches `seed.py --reset`
(`brain/RULES.md` §2 — that script is a documented "live landmine" and this
suite doesn't go near it).

Still: point this at a disposable local dev database, not one you're keeping
pristine for tomorrow's demo. Re-running it repeatedly will leave several
"Azure Furniture" vendor contacts and "Recliner Sofa" products in the
database over time — that's expected of a smoke-test script, not a bug in it.

## The report

Three files land in `qa/reports/` (generated output, not source — worth adding
`qa/reports/` to `.gitignore` if you don't want run artifacts committed;
not done automatically here since editing `.gitignore` is a config change):

- `account-module-<timestamp>.json` — machine-readable, for CI
- `account-module-<timestamp>.html` — a standalone, offline-safe report (no
  external fonts/CDN — see `docs/00_PLAYBOOK.md` §3's "plan for offline"
  guidance) with the exact data submitted, both verification layers, and an
  embedded screenshot for any screen that failed
- `latest.html` — always overwritten with the most recent run, so "open the
  last report" never requires knowing the timestamp

## Why a separate script, not `backend/tests/`

`backend/tests/` (pytest + httpx, see `docs/07_TESTING_AND_REVIEW.md`) tests
business rules against the API directly — that's the right place for the
ledger-invariant suite, the rule matrix, and the concurrency test. This suite
drives the actual browser through the actual rendered form, which is the only
way to catch what those tests structurally can't: a mislabeled input breaking
`get_by_label`, a picker that silently caps at 100 rows, a modal that doesn't
close, a redirect that goes to the wrong place. Different failure class,
different tool.
