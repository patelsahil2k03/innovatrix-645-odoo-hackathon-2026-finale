"""Drives the real browser through each of the Account module's 7 screens.

Order matters and is deliberate, not alphabetical: Chart of Accounts and Journals
first (Journals needs accounts to point its defaults at), then Contacts and
Products (Products needs an account to map income/expense to), then Analytic
Accounts, then Budgets last — a Budget line points at a Contact (Responsible)
*and* an Analytic Account, so it exercises both earlier screens' output. This
mirrors how the app is actually meant to be used (docs/03_DATA_MODEL.md §1), not
just a checklist run in file-tree order.

Journal Entries is the 7th screen and gets a *negative* test — it has no create
form on purpose (`frontend/src/app/account/journal-entries/page.tsx`'s own
comment: "Read-only, and that is the point"). Proving that stays true is exactly
as real a test as proving the other six can create a row.
"""

from __future__ import annotations

import re
import time
from dataclasses import asdict

from playwright.sync_api import Page, expect

from qa.e2e.config import Config
from qa.e2e.data import TestDataSet
from qa.e2e.report import ScreenResult, VerificationDetail

ID_FROM_URL = re.compile(r"/([^/]+)/?$")

#: A real record id (UUIDMixin, e.g. "c13c87ab-6999-4740-b8b7-9c277bbde571") —
#: deliberately NOT `[^/]+`, which also matches the literal "new" segment the
#: page starts on and would make `wait_for_url` return immediately, before any
#: redirect happens, reporting success on a page that never actually navigated.
UUID_SEGMENT = r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"


def _redirect_pattern(route_prefix: str) -> re.Pattern:
    return re.compile(rf"{re.escape(route_prefix)}/{UUID_SEGMENT}/?$")


class AccountModuleTester:
    def __init__(self, page: Page, config: Config):
        self.page = page
        self.config = config

    # ---- shared helpers -------------------------------------------------

    def _url(self, path: str) -> str:
        return f"{self.config.base_url}{path}"

    def _screenshot_b64(self) -> str | None:
        try:
            png = self.page.screenshot(full_page=True)
        except Exception:
            return None
        import base64

        return base64.b64encode(png).decode("ascii")

    def _id_from_url(self) -> str:
        match = ID_FROM_URL.search(self.page.url)
        return match.group(1) if match else ""

    def _api_get(self, path: str):
        return self.page.request.get(f"{self.config.api_url}{path}")

    def login(self) -> None:
        page = self.page
        page.goto(self._url("/login"))
        page.get_by_label("Email").fill(self.config.email)
        page.get_by_label("Password").fill(self.config.password)
        page.get_by_role("button", name="Sign in").click()
        page.wait_for_url(lambda url: "/login" not in url, timeout=self.config.timeout_ms)

    # ---- 1. Chart of Accounts -------------------------------------------

    def test_chart_of_accounts(self, data) -> ScreenResult:
        key, title, route = "chart_of_accounts", "Chart of Accounts", "/account/chart-of-accounts/new"
        started = time.monotonic()
        verifications: list[VerificationDetail] = []
        try:
            page = self.page
            page.goto(self._url(route))
            page.get_by_label("Code").fill(data.code)
            page.get_by_label("Name").fill(data.name)
            page.get_by_label("Type").select_option(data.type)
            page.get_by_role("button", name="Create account").click()
            page.wait_for_url(_redirect_pattern("/account/chart-of-accounts"), timeout=self.config.timeout_ms)
            created_id = self._id_from_url()

            ui_code = page.get_by_label("Code").input_value()
            ui_name = page.get_by_label("Name").input_value()
            verifications.append(VerificationDetail("UI shows the submitted Code", ui_code == data.code, f"saw {ui_code!r}"))
            verifications.append(VerificationDetail("UI shows the submitted Name", ui_name == data.name, f"saw {ui_name!r}"))

            resp = self._api_get(f"/accounts/{created_id}")
            body = resp.json() if resp.ok else {}
            verifications.append(VerificationDetail("API GET /accounts/{id} → 200", resp.ok, f"status {resp.status}"))
            verifications.append(VerificationDetail("API code matches submitted value", body.get("code") == data.code, f"api code={body.get('code')!r}"))
            verifications.append(VerificationDetail("API type matches submitted value", body.get("type") == data.type, f"api type={body.get('type')!r}"))

            return self._finish(key, title, route, data, started, verifications, created_id=created_id)
        except Exception as exc:
            return self._fail(key, title, route, data, started, verifications, exc)

    # ---- 2. Journals ------------------------------------------------------

    def test_journals(self, data) -> ScreenResult:
        key, title, route = "journals", "Journals", "/account/journals/new"
        started = time.monotonic()
        verifications: list[VerificationDetail] = []
        try:
            page = self.page
            page.goto(self._url(route))
            page.get_by_label("Name").fill(data.name)
            page.get_by_label("Type").select_option(data.type)
            page.get_by_label("Default debit account").select_option(label=data.default_debit_account_label)
            page.get_by_label("Default credit account").select_option(label=data.default_credit_account_label)
            page.get_by_role("button", name="Create journal").click()
            page.wait_for_url(_redirect_pattern("/account/journals"), timeout=self.config.timeout_ms)
            created_id = self._id_from_url()

            ui_name = page.get_by_label("Name").input_value()
            verifications.append(VerificationDetail("UI shows the submitted Name", ui_name == data.name, f"saw {ui_name!r}"))

            resp = self._api_get(f"/journals/{created_id}")
            body = resp.json() if resp.ok else {}
            verifications.append(VerificationDetail("API GET /journals/{id} → 200", resp.ok, f"status {resp.status}"))
            verifications.append(VerificationDetail("API type matches submitted value", body.get("type") == data.type, f"api type={body.get('type')!r}"))
            verifications.append(VerificationDetail(
                "API default_debit_account_id is set",
                bool(body.get("default_debit_account_id")),
                "expected a non-null account id",
            ))

            return self._finish(key, title, route, data, started, verifications, created_id=created_id)
        except Exception as exc:
            return self._fail(key, title, route, data, started, verifications, exc)

    # ---- 3. Contacts ------------------------------------------------------

    def test_contacts(self, data) -> ScreenResult:
        key, title, route = "contacts", "Contacts", "/account/contacts/new"
        started = time.monotonic()
        verifications: list[VerificationDetail] = []
        try:
            page = self.page
            page.goto(self._url(route))
            page.get_by_label("Name").fill(data.name)
            page.get_by_label("Type").select_option(data.type)
            page.get_by_label("Email").fill(data.email)
            page.get_by_label("Mobile").fill(data.mobile)
            page.get_by_label("Street").fill(data.address_street)
            page.get_by_label("City").fill(data.address_city)
            page.get_by_label("State").fill(data.address_state)
            page.get_by_label("Country").fill(data.address_country)
            page.get_by_label("Pincode").fill(data.address_pincode)
            # Receivable/Payable accounts left on "System default" on purpose —
            # that is the documented, most common real-world path
            # (frontend/src/components/forms/contact-form.tsx's own hint text).
            page.get_by_role("button", name="Create contact").click()
            page.wait_for_url(_redirect_pattern("/account/contacts"), timeout=self.config.timeout_ms)
            created_id = self._id_from_url()

            ui_name = page.get_by_label("Name").input_value()
            ui_email = page.get_by_label("Email").input_value()
            verifications.append(VerificationDetail("UI shows the submitted Name", ui_name == data.name, f"saw {ui_name!r}"))
            verifications.append(VerificationDetail("UI shows the submitted Email", ui_email == data.email, f"saw {ui_email!r}"))

            resp = self._api_get(f"/contacts/{created_id}")
            body = resp.json() if resp.ok else {}
            verifications.append(VerificationDetail("API GET /contacts/{id} → 200", resp.ok, f"status {resp.status}"))
            verifications.append(VerificationDetail("API type matches submitted value", body.get("type") == data.type, f"api type={body.get('type')!r}"))
            verifications.append(VerificationDetail("API email matches submitted value", body.get("email") == data.email, f"api email={body.get('email')!r}"))

            return self._finish(key, title, route, data, started, verifications, created_id=created_id)
        except Exception as exc:
            return self._fail(key, title, route, data, started, verifications, exc)

    # ---- 4. Products (exercises the inline category-create modal too) -----

    def test_products(self, data) -> ScreenResult:
        key, title, route = "products", "Products", "/account/products/new"
        started = time.monotonic()
        verifications: list[VerificationDetail] = []
        try:
            page = self.page
            page.goto(self._url(route))
            page.get_by_label("Name").fill(data.name)
            page.get_by_label("Type").select_option(data.type)

            # Category can be created inline (docs/03_DATA_MODEL.md §2) via a
            # small modal next to the Category select, not a full autocomplete.
            page.get_by_role("button", name="New").click()
            dialog = page.get_by_role("dialog")
            dialog.get_by_label("Category name").fill(data.category_name)
            dialog.get_by_role("button", name="Create").click()
            expect(dialog).to_be_hidden(timeout=self.config.timeout_ms)

            category_selected = page.get_by_label("Category").input_value() != ""
            name_survived = page.get_by_label("Name").input_value() == data.name
            verifications.append(VerificationDetail(
                "Inline category create closed the modal and selected the new category",
                category_selected,
                "category select is non-empty after create",
            ))

            if not name_survived:
                # Real finding, not a flaky test: `Modal` (components/ui/modal.tsx)
                # renders in place rather than portalling out of the React tree,
                # so `CategoryCombobox`'s own "New category" <form> ends up
                # nested inside ProductForm's outer <form> — invalid HTML that
                # the browser console flags as a hydration mismatch ("<form>
                # cannot contain a nested <form>"). Clicking the inner form's
                # Create button then appears to reset the whole outer form's
                # client state. Every field typed before opening the modal
                # (starting with Name) is gone, so continuing to the submit
                # button would only produce a confusing client-validation
                # failure or timeout instead of naming the actual cause.
                verifications.append(VerificationDetail(
                    "Rest of the form survives the inline category create",
                    False,
                    f"Name reset to {page.get_by_label('Name').input_value()!r} after the modal closed — "
                    "see the nested <form>/hydration note in qa/e2e/runner.py's test_products",
                ))
                return self._finish(
                    key, title, route, data, started, verifications,
                    notes=(
                        "Likely root cause: Modal (frontend/src/components/ui/modal.tsx) doesn't portal "
                        "out of the React tree, so CategoryCombobox's inline 'New category' <form> renders "
                        "nested inside the outer Product <form> — an HTML spec violation (a <form> cannot "
                        "contain a <form>) that the browser flags as a hydration mismatch. The practical "
                        "effect: clicking Create inside that modal wipes the rest of the product form's "
                        "state. Fix is a frontend change (portal the Modal, e.g. via a React portal to "
                        "document.body) — flagging for a decision rather than making it here."
                    ),
                )

            page.get_by_label("Sales tax %").fill(data.sales_tax_pct)
            page.get_by_label("Sales price").fill(data.sales_price)
            page.get_by_label("Cost price").fill(data.cost_price)
            page.get_by_label("Income account").select_option(label=data.income_account_label)
            page.get_by_label("Expense account").select_option(label=data.expense_account_label)
            page.get_by_role("button", name="Create product").click()
            page.wait_for_url(_redirect_pattern("/account/products"), timeout=self.config.timeout_ms)
            created_id = self._id_from_url()

            ui_name = page.get_by_label("Name").input_value()
            verifications.append(VerificationDetail("UI shows the submitted Name", ui_name == data.name, f"saw {ui_name!r}"))

            resp = self._api_get(f"/products/{created_id}")
            body = resp.json() if resp.ok else {}
            verifications.append(VerificationDetail("API GET /products/{id} → 200", resp.ok, f"status {resp.status}"))
            verifications.append(VerificationDetail(
                "API sales_price matches submitted value",
                str(body.get("sales_price")) == data.sales_price or float(body.get("sales_price", -1)) == float(data.sales_price),
                f"api sales_price={body.get('sales_price')!r}",
            ))
            verifications.append(VerificationDetail(
                "API category_id was set by the inline create",
                bool(body.get("category_id")),
                "expected a non-null category id",
            ))

            return self._finish(key, title, route, data, started, verifications, created_id=created_id)
        except Exception as exc:
            return self._fail(key, title, route, data, started, verifications, exc)

    # ---- 5. Analytic Accounts --------------------------------------------

    def test_analytic_accounts(self, data) -> ScreenResult:
        key, title, route = "analytic_accounts", "Analytic Accounts", "/account/analyticals/new"
        started = time.monotonic()
        verifications: list[VerificationDetail] = []
        try:
            page = self.page
            page.goto(self._url(route))
            page.get_by_label("Name").fill(data.name)
            page.get_by_label("Type").select_option(data.type)
            page.get_by_role("button", name="Create analytic account").click()
            page.wait_for_url(_redirect_pattern("/account/analyticals"), timeout=self.config.timeout_ms)
            created_id = self._id_from_url()

            ui_name = page.get_by_label("Name").input_value()
            verifications.append(VerificationDetail("UI shows the submitted Name", ui_name == data.name, f"saw {ui_name!r}"))

            resp = self._api_get(f"/analytic-accounts/{created_id}")
            body = resp.json() if resp.ok else {}
            verifications.append(VerificationDetail("API GET /analytic-accounts/{id} → 200", resp.ok, f"status {resp.status}"))
            verifications.append(VerificationDetail("API type matches submitted value", body.get("type") == data.type, f"api type={body.get('type')!r}"))

            return self._finish(key, title, route, data, started, verifications, created_id=created_id)
        except Exception as exc:
            return self._fail(key, title, route, data, started, verifications, exc)

    # ---- 6. Budgets (chains onto Contacts + Analytic Accounts above) ------

    def test_budgets(self, data) -> ScreenResult:
        key, title, route = "budgets", "Budgets", "/account/budgets/new"
        started = time.monotonic()
        verifications: list[VerificationDetail] = []
        try:
            page = self.page
            page.goto(self._url(route))
            page.get_by_label("Name").fill(data.name)
            page.get_by_label("Responsible").select_option(label=data.responsible_contact_name)
            page.get_by_label("Period start").fill(data.period_start)
            page.get_by_label("Period end").fill(data.period_end)
            page.get_by_label("Analytic account").select_option(label=data.line.analytic_account_label)
            page.get_by_label("Committed amount").fill(data.line.committed_amount)
            page.get_by_role("button", name="Save budget").click()
            page.wait_for_url(_redirect_pattern("/account/budgets"), timeout=self.config.timeout_ms)
            created_id = self._id_from_url()

            analytic_name = data.line.analytic_account_label.split(" (")[0]

            # This is a bespoke detail view (a lines table), not the same form
            # component reused read-only. Use an auto-retrying assertion, not a
            # one-shot .is_visible() — the table's own data fetch hasn't
            # necessarily resolved the instant the redirect lands.
            row = page.get_by_role("row").filter(has_text=analytic_name).first
            try:
                # Capped well below the general timeout: by this point the
                # page has already settled (the warm-up pass and the redirect
                # wait absorbed any cold-compile delay), so a genuinely-missing
                # row doesn't need the full budget to be ruled out.
                expect(row).to_be_visible(timeout=min(self.config.timeout_ms, 8_000))
                row_ok, row_detail = True, "row text matched the analytic account name"
            except AssertionError:
                row_ok, row_detail = False, (
                    f"no row rendered {analytic_name!r} — see the API check below for whether "
                    "the data exists but under a different field name than the page reads"
                )
            verifications.append(VerificationDetail(
                "Budget line for the submitted Analytic account is visible on the detail page", row_ok, row_detail
            ))

            resp = self._api_get(f"/budgets/{created_id}")
            body = resp.json() if resp.ok else {}
            verifications.append(VerificationDetail("API GET /budgets/{id} → 200", resp.ok, f"status {resp.status}"))
            lines = body.get("lines") or []
            committed_ok = any(
                float(line.get("committed_amount", -1)) == float(data.line.committed_amount) for line in lines
            )
            verifications.append(VerificationDetail(
                "API committed_amount matches submitted value", committed_ok, f"api lines={lines!r}"
            ))
            name_in_api = any(line.get("analytic_account") == analytic_name for line in lines)
            verifications.append(VerificationDetail(
                "API line carries the analytic account's name (field: analytic_account)",
                name_in_api,
                f"api analytic_account values={[line.get('analytic_account') for line in lines]!r}",
            ))
            achieved_ok = all(float(line.get("achieved_amount") or 0) == 0.0 for line in lines)
            verifications.append(VerificationDetail(
                "Achieved is computed as 0 — no invoices/bills posted against this tag yet "
                "(docs/03_DATA_MODEL.md §2: achieved is never stored, always computed on read)",
                achieved_ok,
                f"achieved values={[line.get('achieved_amount') for line in lines]!r}",
            ))

            notes = None
            if not row_ok and name_in_api:
                # Confirmed: the data is correct end to end, only the detail
                # page's own rendering is wrong. Backend schema field is
                # `analytic_account` (schemas/budgets.py's BudgetLineOut,
                # AliasPath("analytic_account", "name")); the detail page's JSX
                # (frontend/src/app/account/budgets/[id]/page.tsx) reads
                # `line.analytic_account_name`, which the API never sends —
                # so it always falls back to the "—" placeholder. Same bug
                # class as brain/mistakes/2026-09-05-fe-be-report-contract-drift.md,
                # a new instance of it, on the Budgets detail page specifically.
                notes = (
                    "FE/BE field-name mismatch, not a flaky test: the API line carries the analytic "
                    "account's name as `analytic_account`; the detail page's JSX reads "
                    "`line.analytic_account_name`, which the API never sends, so every budget line "
                    "renders '—' in that column regardless of what was actually saved. "
                    "See brain/mistakes/2026-09-05-fe-be-report-contract-drift.md for the same bug "
                    "class already fixed once on the report pages — this is a fresh instance on Budgets."
                )

            return self._finish(key, title, route, data, started, verifications, created_id=created_id, notes=notes)
        except Exception as exc:
            return self._fail(key, title, route, data, started, verifications, exc)

    # ---- 7. Journal Entries — a NEGATIVE test, by design -------------------

    def test_journal_entries_readonly(self) -> ScreenResult:
        key, title, route = "journal_entries", "Journal Entries (read-only by design)", "/account/journal-entries"
        started = time.monotonic()
        verifications: list[VerificationDetail] = []
        data = {
            "expectation": "no create form exists on this screen — that is the feature, not a gap",
            "reference": "frontend/src/app/account/journal-entries/page.tsx — 'Read-only, and that is the point'",
        }
        try:
            page = self.page
            page.goto(self._url(route))
            # Wait for the page to actually settle before asserting an absence —
            # a one-shot .count() taken mid-navigation/while data is still
            # loading can under-count and produce a false pass just as easily
            # as a false fail.
            expect(page.get_by_role("heading", name="Journal Entries")).to_be_visible(timeout=self.config.timeout_ms)
            new_link_count = page.get_by_role("link", name=re.compile(r"^\s*new\b", re.I)).count()
            verifications.append(VerificationDetail(
                "No 'New' link on the Journal Entries list", new_link_count == 0, f"found {new_link_count} matching link(s)"
            ))

            # Unlike the other 6 modules, this route has no dedicated `new/`
            # folder — only `[id]/page.tsx`. So "/journal-entries/new" does NOT
            # hit Next's routing-level not-found page; Next's [id] segment
            # happily matches the literal string "new" as an id, the detail
            # page then fetches a journal entry with that id, and the fetch
            # 404s at the API layer — rendering AsyncState's generic
            # role="alert" error state, not a dedicated 404 page. Verified
            # directly (this suite's first attempt asserted the wrong
            # mechanism and had to be corrected against the real behaviour).
            # The outcome a user actually cares about is identical either way:
            # there is no way to create a journal entry by hand.
            page.goto(self._url("/account/journal-entries/new"))
            error_state = page.get_by_role("alert").filter(has_text=re.compile(r"no longer exists", re.I))
            try:
                expect(error_state).to_be_visible(timeout=self.config.timeout_ms)
                no_create_ok = True
                detail = (
                    "no [id] resolves to a create form — 'new' is treated as an id, "
                    "the fetch 404s, and the generic record-not-found state renders instead"
                )
            except AssertionError:
                no_create_ok = False
                detail = f"expected the record-not-found error state; current URL is {page.url!r}"
            verifications.append(VerificationDetail(
                "/account/journal-entries/new never renders a create form", no_create_ok, detail
            ))

            return self._finish(key, title, route, data, started, verifications)
        except Exception as exc:
            return self._fail(key, title, route, data, started, verifications, exc)

    # ---- shared finish/fail -----------------------------------------------

    def _finish(self, key, title, route, data, started, verifications, created_id=None, notes=None) -> ScreenResult:
        as_dict = asdict(data) if hasattr(data, "__dataclass_fields__") else dict(data)
        status = "pass" if verifications and all(v.passed for v in verifications) else "fail"
        screenshot = self._screenshot_b64() if status != "pass" else None
        return ScreenResult(
            key=key,
            title=title,
            route=route,
            data_used=as_dict,
            status=status,
            duration_s=time.monotonic() - started,
            verifications=verifications,
            created_id=created_id,
            screenshot_b64=screenshot,
            notes=notes,
        )

    def _fail(self, key, title, route, data, started, verifications, exc: Exception, notes=None) -> ScreenResult:
        as_dict = asdict(data) if hasattr(data, "__dataclass_fields__") else dict(data)
        return ScreenResult(
            key=key,
            title=title,
            route=route,
            data_used=as_dict,
            status="error",
            duration_s=time.monotonic() - started,
            verifications=verifications,
            error=f"{type(exc).__name__}: {exc}",
            screenshot_b64=self._screenshot_b64(),
            notes=notes,
        )


#: Every screen this run touches, visited once, best-effort, before anything is
#: timed or asserted — see the warm-up note in `run_all()`.
_ROUTES_TO_WARM = [
    "/account/chart-of-accounts/new",
    "/account/journals/new",
    "/account/contacts/new",
    "/account/products/new",
    "/account/analyticals/new",
    "/account/budgets/new",
    "/account/journal-entries",
]


def run_all(page: Page, config: Config, dataset: TestDataSet) -> list[ScreenResult]:
    page.set_default_timeout(config.timeout_ms)
    tester = AccountModuleTester(page, config)
    tester.login()

    # Warm-up: Next.js dev mode (Turbopack) compiles a route on its FIRST
    # request in this server process, which can comfortably exceed a normal
    # interaction timeout — that's what actually happened the first time this
    # suite ran (every screen timed out waiting on its first field, and a
    # failure screenshot taken moments later showed the exact same page fully
    # rendered and usable). Hitting every route once up front, discarding
    # whatever happens, means the timed/asserted pass below only ever measures
    # real interaction time.
    for warm_route in _ROUTES_TO_WARM:
        try:
            page.goto(f"{config.base_url}{warm_route}", timeout=config.timeout_ms)
        except Exception:
            pass

    results: list[ScreenResult] = []
    results.append(tester.test_chart_of_accounts(dataset.chart_of_accounts))
    results.append(tester.test_journals(dataset.journal))
    results.append(tester.test_contacts(dataset.contact))
    results.append(tester.test_products(dataset.product))
    results.append(tester.test_analytic_accounts(dataset.analytic_account))
    results.append(tester.test_budgets(dataset.budget))
    results.append(tester.test_journal_entries_readonly())
    return results
