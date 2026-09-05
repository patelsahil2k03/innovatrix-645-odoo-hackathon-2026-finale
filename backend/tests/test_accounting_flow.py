"""The two golden paths, end to end through the API.

    7.2  PO -> confirm -> Vendor Bill -> post -> pay through Bank
    7.3  SO -> confirm -> Customer Invoice -> post -> pay through Cash/Bank

These are the use-case steps the problem statement names, tested the way a judge
would click them. Everything asserts against the **ledger**, not against the
documents, because a document that says it is paid while the ledger disagrees is
exactly the failure mode this system exists to prevent.
"""

import uuid

import pytest

API = "/api/v1"


def _key() -> dict[str, str]:
    return {"Idempotency-Key": str(uuid.uuid4())}


def _first(client, path: str, **params):
    response = client.get(f"{API}{path}", params={"page_size": 100, **params})
    assert response.status_code == 200, response.text
    items = response.json()["items"]
    assert items, f"expected at least one row from {path}"
    return items[0]


@pytest.fixture
def customer(admin_client):
    return _first(admin_client, "/contacts", q="Nimesh")


@pytest.fixture
def vendor(admin_client):
    return _first(admin_client, "/contacts", q="Azure")


@pytest.fixture
def product(admin_client):
    return _first(admin_client, "/products", q="Office Chair")


@pytest.fixture
def bank_journal(admin_client):
    journals = admin_client.get(f"{API}/journals", params={"page_size": 100}).json()
    return next(j for j in journals["items"] if j["type"] == "BANK")


def _trial_balance(client) -> dict:
    response = client.get(f"{API}/reports/trial-balance")
    assert response.status_code == 200, response.text
    return response.json()


# ── 7.3 Record a sale ─────────────────────────────────────────────────────────


def test_sales_chain_posts_a_balanced_entry_and_settles(
    admin_client, customer, product, bank_journal
):
    """SO -> confirm -> invoice -> post -> partial payment -> full payment."""
    order = admin_client.post(
        f"{API}/sales-orders",
        json={
            "customer_id": customer["id"],
            "reference": "ABC-26-001",
            "lines": [
                {"product_id": product["id"], "quantity": 5, "unit_price": 2360.00,
                 "tax_pct": 18}
            ],
        },
    )
    assert order.status_code == 201, order.text
    order = order.json()

    # Tax is computed per line by the server, never taken from the request.
    assert order["untaxed_total"] == 11800.00
    assert order["tax_total"] == 2124.00
    assert order["total"] == 13924.00
    assert order["number"].startswith("S")           # S00001 format
    assert order["reference"] == "ABC-26-001"        # theirs, distinct from ours

    confirmed = admin_client.post(f"{API}/sales-orders/{order['id']}/confirm")
    assert confirmed.status_code == 200, confirmed.text
    assert confirmed.json()["status"] == "CONFIRMED"

    invoice = admin_client.post(f"{API}/sales-orders/{order['id']}/create-invoice")
    assert invoice.status_code == 201, invoice.text
    invoice = invoice.json()
    assert invoice["status"] == "DRAFT"
    assert invoice["so_id"] == order["id"]
    assert invoice["total"] == 13924.00              # copied faithfully
    assert invoice["number"].startswith("INV/")

    # The order is now INVOICED, not still CONFIRMED.
    assert admin_client.get(
        f"{API}/sales-orders/{order['id']}"
    ).json()["status"] == "INVOICED"

    before = _trial_balance(admin_client)

    posted = admin_client.post(f"{API}/customer-invoices/{invoice['id']}/post")
    assert posted.status_code == 200, posted.text
    posted = posted.json()
    assert posted["status"] == "POSTED"
    assert posted["journal_entry_id"] is not None

    # The entry itself: Dr Debtors 13924 / Cr Sales 11800 / Cr Output tax 2124.
    entry = admin_client.get(
        f"{API}/journal-entries/{posted['journal_entry_id']}"
    ).json()
    assert entry["state"] == "POSTED"
    assert entry["entry_number"].startswith("JE/")
    assert sum(line["debit"] for line in entry["lines"]) == 13924.00
    assert sum(line["credit"] for line in entry["lines"]) == 13924.00
    credits = {line["account_name"]: line["credit"] for line in entry["lines"]}
    assert credits["Sales Income"] == 11800.00
    assert credits["Output Tax"] == 2124.00

    after = _trial_balance(admin_client)
    assert after["is_balanced"] is True
    assert after["total_debit"] == before["total_debit"] + 13924.00

    # Partial payment moves the invoice to PARTIAL, not PAID.
    part = admin_client.post(
        f"{API}/payments",
        headers=_key(),
        json={
            "invoice_id": invoice["id"], "direction": "RECEIVE",
            "journal_id": bank_journal["id"], "amount": 4000.00,
        },
    )
    assert part.status_code == 201, part.text
    state = admin_client.get(f"{API}/customer-invoices/{invoice['id']}").json()
    assert state["status"] == "PARTIAL"
    assert state["amount_paid"] == 4000.00
    assert state["amount_due"] == 9924.00

    # Settling the remainder moves it to PAID.
    rest = admin_client.post(
        f"{API}/payments",
        headers=_key(),
        json={
            "invoice_id": invoice["id"], "direction": "RECEIVE",
            "journal_id": bank_journal["id"], "amount": 9924.00,
        },
    )
    assert rest.status_code == 201, rest.text
    state = admin_client.get(f"{API}/customer-invoices/{invoice['id']}").json()
    assert state["status"] == "PAID"
    assert state["amount_due"] == 0.00

    assert _trial_balance(admin_client)["is_balanced"] is True


# ── 7.2 Record a purchase ─────────────────────────────────────────────────────


def test_purchase_chain_posts_and_pays_through_bank(
    admin_client, vendor, product, bank_journal
):
    order = admin_client.post(
        f"{API}/purchase-orders",
        json={
            "vendor_id": vendor["id"],
            "lines": [
                {"product_id": product["id"], "quantity": 10, "unit_price": 2000.00,
                 "tax_pct": 18}
            ],
        },
    )
    assert order.status_code == 201, order.text
    order = order.json()
    assert order["number"].startswith("P")           # P00001 format
    assert order["total"] == 23600.00

    admin_client.post(f"{API}/purchase-orders/{order['id']}/confirm")

    bill = admin_client.post(f"{API}/purchase-orders/{order['id']}/create-bill")
    assert bill.status_code == 201, bill.text
    bill = bill.json()
    assert bill["number"].startswith("Bill/")
    assert bill["po_id"] == order["id"]
    assert bill["total"] == 23600.00

    assert admin_client.get(
        f"{API}/purchase-orders/{order['id']}"
    ).json()["status"] == "BILLED"

    posted = admin_client.post(f"{API}/vendor-bills/{bill['id']}/post")
    assert posted.status_code == 200, posted.text
    entry = admin_client.get(
        f"{API}/journal-entries/{posted.json()['journal_entry_id']}"
    ).json()

    # Dr Purchase Expense 20000 + Dr Input Tax 3600 / Cr Creditors 23600.
    debits = {line["account_name"]: line["debit"] for line in entry["lines"]}
    assert debits["Purchase Expense"] == 20000.00
    assert debits["Input Tax"] == 3600.00
    credits = {line["account_name"]: line["credit"] for line in entry["lines"]}
    assert credits["Creditors"] == 23600.00

    paid = admin_client.post(
        f"{API}/payments",
        headers=_key(),
        json={
            "bill_id": bill["id"], "direction": "SEND",
            "journal_id": bank_journal["id"], "amount": 23600.00,
        },
    )
    assert paid.status_code == 201, paid.text
    assert admin_client.get(
        f"{API}/vendor-bills/{bill['id']}"
    ).json()["status"] == "PAID"

    assert _trial_balance(admin_client)["is_balanced"] is True


# ── 7.4 Generate reports ──────────────────────────────────────────────────────


def test_balance_sheet_balances_and_pl_reports_separately(admin_client):
    sheet = admin_client.get(f"{API}/reports/balance-sheet")
    assert sheet.status_code == 200, sheet.text
    sheet = sheet.json()

    # Assets == Liabilities + Capital + retained earnings. If this fails, the
    # ledger is telling the truth about something genuinely broken.
    assert sheet["is_balanced"] is True, (
        f"assets {sheet['total_assets']} != "
        f"liabilities+capital {sheet['total_liabilities_and_capital']}"
    )
    assert {r["account_type"] for r in sheet["assets"]["rows"]} <= {"ASSET", "BANK", "CASH"}
    assert {r["account_type"] for r in sheet["liabilities"]["rows"]} <= {"LIABILITY"}
    assert any(r["account_name"] == "Retained Earnings" for r in sheet["equity"]["rows"])

    pl = admin_client.get(f"{API}/reports/profit-and-loss").json()
    # EXPENSE and OTHER_EXPENSE report on separate lines — the reason
    # OTHER_EXPENSE is its own account type at all.
    assert pl["expenses"]["key"] == "EXPENSE"
    assert pl["other_expenses"]["key"] == "OTHER_EXPENSE"
    assert pl["net_profit"] == round(
        pl["total_income"] - pl["total_expenses"], 2
    )


def test_trial_balance_is_zero_across_the_whole_seeded_ledger(admin_client):
    """The badge the whole build hangs on."""
    report = _trial_balance(admin_client)
    assert report["difference"] == 0.00
    assert report["is_balanced"] is True
    assert report["total_debit"] == report["total_credit"]
    assert report["rows"], "a seeded ledger should have accounts in it"


def test_reports_export_as_csv(admin_client):
    for name in ("trial-balance", "balance-sheet", "profit-and-loss"):
        response = admin_client.get(f"{API}/reports/{name}/export")
        assert response.status_code == 200, response.text
        assert response.headers["content-type"].startswith("text/csv")
        assert "attachment" in response.headers["content-disposition"]
        assert len(response.text.splitlines()) > 1


def test_kpis_read_the_ledger(admin_client):
    kpis = admin_client.get(f"{API}/reports/kpis")
    assert kpis.status_code == 200, kpis.text
    body = kpis.json()
    assert body["is_balanced"] is True
    assert set(body) == {
        "receivables", "payables", "cash", "net_profit", "is_balanced",
        # The control accounts behind each figure, so the dashboard tile can
        # link to the ledger it came from instead of guessing an account code.
        "receivable_account_ids", "payable_account_ids", "cash_account_ids",
    }

    # Receivables must be the contacts' receivable control account ONLY. It used
    # to sum every ASSET account, which folded recoverable Input Tax into "money
    # customers owe us" — an asset, but not a receivable.
    accounts = admin_client.get(f"{API}/accounts?page_size=100").json()["items"]
    input_tax = next((a for a in accounts if a["code"] == "1200"), None)
    if input_tax is not None:
        assert input_tax["id"] not in body["receivable_account_ids"]


# ── §3.5 Print, PDF and Send ──────────────────────────────────────────────────


def test_print_view_and_pdf_render_from_the_same_document(admin_client):
    invoice = _first(admin_client, "/customer-invoices", status="PAID")

    printed = admin_client.get(f"{API}/customer-invoices/{invoice['id']}/print")
    assert printed.status_code == 200, printed.text
    assert printed.headers["content-type"].startswith("text/html")
    # The print view really describes this document, not a placeholder.
    assert invoice["number"] in printed.text

    pdf = admin_client.get(f"{API}/customer-invoices/{invoice['id']}/pdf")
    assert pdf.status_code == 200, pdf.text
    assert pdf.headers["content-type"] == "application/pdf"
    assert pdf.content.startswith(b"%PDF-")
    assert invoice["number"].replace("/", "-") in pdf.headers["content-disposition"]


def test_vendor_bills_print_and_download_too(admin_client):
    bill = _first(admin_client, "/vendor-bills", status="PAID")
    assert admin_client.get(
        f"{API}/vendor-bills/{bill['id']}/print"
    ).status_code == 200
    pdf = admin_client.get(f"{API}/vendor-bills/{bill['id']}/pdf")
    assert pdf.status_code == 200
    assert pdf.content.startswith(b"%PDF-")


@pytest.mark.parametrize(
    "name", ["profit-and-loss", "balance-sheet", "trial-balance"]
)
def test_reports_download_as_pdf(admin_client, name):
    """The mockup annotates the P&L screen 'Pdf download on click'."""
    response = admin_client.get(f"{API}/reports/{name}/pdf")
    assert response.status_code == 200, response.text
    assert response.headers["content-type"] == "application/pdf"
    assert response.content.startswith(b"%PDF-")


def test_report_pdf_route_is_not_shadowed_by_the_document_route(admin_client):
    """`/{doc_type}/{doc_id}/pdf` is two wildcards wide and would happily match
    `/reports/balance-sheet/pdf`. If registration order ever regresses, this
    fails with a document 404 instead of returning a report."""
    response = admin_client.get(f"{API}/reports/balance-sheet/pdf")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"

    unknown = admin_client.get(f"{API}/reports/not-a-report/pdf")
    assert unknown.status_code == 404
    assert unknown.json()["error"]["code"] == "NOT_FOUND"


def test_send_refuses_explicitly_when_smtp_is_not_configured(admin_client):
    """A silent no-op is the one behaviour that would let the UI claim it sent."""
    invoice = _first(admin_client, "/customer-invoices", status="PAID")
    response = admin_client.post(
        f"{API}/customer-invoices/{invoice['id']}/send", json={}
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "MAIL_NOT_CONFIGURED"


def test_status_counts_covers_every_state_including_the_empty_ones(admin_client):
    """A state with no documents must render as 0, not disappear.

    A missing column reads as "this state cannot happen"; a zero reads as
    "nothing is there yet". Only the second is true, and the difference is
    visible on screen — so the response is built from the enum, not from
    whatever rows happen to exist.
    """
    response = admin_client.get(f"{API}/status-counts")
    assert response.status_code == 200, response.text
    modules = response.json()["modules"]

    assert set(modules) == {
        "sales_orders",
        "customer_invoices",
        "purchase_orders",
        "vendor_bills",
        "budgets",
    }

    orders = modules["sales_orders"]
    assert set(orders["by_status"]) == {"DRAFT", "CONFIRMED", "INVOICED", "CANCELLED"}
    assert orders["total"] == sum(orders["by_status"].values())

    # Cross-check one module against the list endpoint's own total, so the two
    # can never drift apart without a test noticing.
    listed = admin_client.get(f"{API}/sales-orders", params={"page_size": 1})
    assert listed.json()["total"] == orders["total"]


def test_status_counts_needs_a_session(client):
    """Counts are staff-only (`require_internal`); anonymous gets nothing."""
    assert client.get(f"{API}/status-counts").status_code == 401


def test_status_counts_is_staff_only(portal_client):
    """A portal contact has no business knowing how many drafts exist."""
    assert portal_client.get(f"{API}/status-counts").status_code == 403
