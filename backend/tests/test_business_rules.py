"""Every "must", "cannot" and "automatically" from PROBLEM_STATEMENT.md §2.

Each rule gets a **rejecting** test and an **accepting** one. A rejecting test
alone proves only that something is refused — it cannot tell a correct guard from
an endpoint that refuses everything, which is the failure mode that actually
ships. The pair together is the claim.

Error codes are asserted by `code`, not by status alone: the frontend switches on
them, so a code changing silently is a broken contract even when the status is
still 422.
"""

import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.settings import get_settings
from app.main import app

API = "/api/v1"
settings = get_settings()


def _key() -> dict[str, str]:
    return {"Idempotency-Key": str(uuid.uuid4())}


def _code(response) -> str:
    body = response.json()
    assert "error" in body, f"expected an error envelope, got {body}"
    return body["error"]["code"]


def _one(client, path: str, **params):
    rows = client.get(f"{API}{path}", params={"page_size": 100, **params}).json()["items"]
    assert rows, f"expected a row from {path} {params}"
    return rows[0]


@pytest.fixture
def customer(admin_client):
    return _one(admin_client, "/contacts", q="Nimesh")


@pytest.fixture
def vendor(admin_client):
    return _one(admin_client, "/contacts", q="Azure")


@pytest.fixture
def product(admin_client):
    return _one(admin_client, "/products", q="Office Chair")


@pytest.fixture
def bank_journal(admin_client):
    rows = admin_client.get(f"{API}/journals", params={"page_size": 100}).json()["items"]
    return next(j for j in rows if j["type"] == "BANK")


@pytest.fixture
def sales_journal(admin_client):
    rows = admin_client.get(f"{API}/journals", params={"page_size": 100}).json()["items"]
    return next(j for j in rows if j["type"] == "SALES")


@pytest.fixture
def portal_client() -> TestClient:
    client = TestClient(app)
    response = client.post(
        f"{API}/auth/login",
        json={"email": "portal@urbanfurniture.in", "password": settings.seed_password},
    )
    assert response.status_code == 200, response.text
    return client


def _draft_invoice(client, customer_id: str, product_id: str, **overrides) -> dict:
    body = {
        "customer_id": customer_id,
        "lines": [
            {"product_id": product_id, "quantity": 2, "unit_price": 1000.00,
             "tax_pct": 18}
        ],
    }
    body.update(overrides)
    response = client.post(f"{API}/customer-invoices", json=body)
    assert response.status_code == 201, response.text
    return response.json()


def _posted_invoice(client, customer_id: str, product_id: str, **overrides) -> dict:
    invoice = _draft_invoice(client, customer_id, product_id, **overrides)
    posted = client.post(f"{API}/customer-invoices/{invoice['id']}/post")
    assert posted.status_code == 200, posted.text
    return posted.json()


# ── Rule 1 & 2 — entries balance, lines are one-sided ─────────────────────────


def test_every_posted_entry_balances_and_each_line_is_one_sided(admin_client):
    """The ledger's core invariant, asserted over every entry that exists."""
    entries = admin_client.get(
        f"{API}/journal-entries", params={"page_size": 100}
    ).json()["items"]
    assert entries, "the seed should have produced journal entries"

    for entry in entries:
        detail = admin_client.get(f"{API}/journal-entries/{entry['id']}").json()
        debit = sum(line["debit"] for line in detail["lines"])
        credit = sum(line["credit"] for line in detail["lines"])
        assert round(debit - credit, 2) == 0.00, (
            f"{detail['entry_number']} is unbalanced: {debit} vs {credit}"
        )
        for line in detail["lines"]:
            assert not (line["debit"] > 0 and line["credit"] > 0), "line is two-sided"
            assert line["debit"] > 0 or line["credit"] > 0, "line is empty"


# ── Rule 3 — a posted document cannot be edited ───────────────────────────────


def test_rejects_editing_a_posted_invoice(admin_client, customer, product):
    invoice = _posted_invoice(admin_client, customer["id"], product["id"])
    response = admin_client.patch(
        f"{API}/customer-invoices/{invoice['id']}", json={"reference": "TAMPERED"}
    )
    assert response.status_code == 409
    assert _code(response) == "CANNOT_MODIFY_POSTED"


def test_accepts_editing_a_draft_invoice(admin_client, customer, product):
    invoice = _draft_invoice(admin_client, customer["id"], product["id"])
    response = admin_client.patch(
        f"{API}/customer-invoices/{invoice['id']}", json={"reference": "ABC-26-009"}
    )
    assert response.status_code == 200, response.text
    assert response.json()["reference"] == "ABC-26-009"


def test_the_ledger_exposes_no_write_endpoints():
    """Entries exist only as a side effect of posting a document."""
    paths = app.openapi()["paths"]
    ledger_paths = {p: v for p, v in paths.items() if "journal-entries" in p}
    assert ledger_paths, "the ledger endpoints should exist"
    for path, operations in ledger_paths.items():
        assert set(operations) == {"get"}, f"{path} exposes {set(operations)}"


# ── Rule 4 — posting generates the entry automatically ────────────────────────


def test_posting_generates_exactly_one_entry(admin_client, customer, product):
    invoice = _draft_invoice(admin_client, customer["id"], product["id"])
    assert invoice["journal_entry_id"] is None

    posted = admin_client.post(f"{API}/customer-invoices/{invoice['id']}/post").json()
    assert posted["journal_entry_id"] is not None

    entries = admin_client.get(
        f"{API}/journal-entries",
        params={"source_type": "customer_invoice", "page_size": 100},
    ).json()["items"]
    mine = [e for e in entries if e["source_id"] == invoice["id"]]
    assert len(mine) == 1


# ── Rule 6 — a payment cannot exceed the remaining balance ────────────────────


def test_rejects_payment_above_the_amount_due(
    admin_client, customer, product, bank_journal
):
    invoice = _posted_invoice(admin_client, customer["id"], product["id"])
    response = admin_client.post(
        f"{API}/payments",
        headers=_key(),
        json={
            "invoice_id": invoice["id"], "direction": "RECEIVE",
            "journal_id": bank_journal["id"],
            "amount": float(invoice["total"]) + 0.01,
        },
    )
    assert response.status_code == 422
    assert _code(response) == "OVERALLOCATED_PAYMENT"
    # The message carries a per-field hint the form can display directly.
    assert "amount" in response.json()["error"]["fields"]


def test_accepts_a_payment_of_exactly_the_amount_due(
    admin_client, customer, product, bank_journal
):
    invoice = _posted_invoice(admin_client, customer["id"], product["id"])
    response = admin_client.post(
        f"{API}/payments",
        headers=_key(),
        json={
            "invoice_id": invoice["id"], "direction": "RECEIVE",
            "journal_id": bank_journal["id"], "amount": invoice["total"],
        },
    )
    assert response.status_code == 201, response.text
    assert admin_client.get(
        f"{API}/customer-invoices/{invoice['id']}"
    ).json()["status"] == "PAID"


def test_rejects_a_second_payment_once_fully_paid(
    admin_client, customer, product, bank_journal
):
    invoice = _posted_invoice(admin_client, customer["id"], product["id"])
    admin_client.post(
        f"{API}/payments", headers=_key(),
        json={"invoice_id": invoice["id"], "direction": "RECEIVE",
              "journal_id": bank_journal["id"], "amount": invoice["total"]},
    )
    again = admin_client.post(
        f"{API}/payments", headers=_key(),
        json={"invoice_id": invoice["id"], "direction": "RECEIVE",
              "journal_id": bank_journal["id"], "amount": 1.00},
    )
    assert again.status_code == 422
    assert _code(again) == "INVALID_STATUS_TRANSITION"


# ── Rule 7 — a document cannot be posted twice ────────────────────────────────


def test_rejects_posting_the_same_invoice_twice(admin_client, customer, product):
    invoice = _posted_invoice(admin_client, customer["id"], product["id"])
    again = admin_client.post(f"{API}/customer-invoices/{invoice['id']}/post")
    assert again.status_code in (409, 422)
    assert _code(again) in ("ALREADY_POSTED", "INVALID_STATUS_TRANSITION")


# ── Rule 8 — an archived account cannot receive new postings ──────────────────


def test_rejects_posting_to_an_archived_account(admin_client, customer):
    """The seed archives `5100 Other Expense` precisely so this is demonstrable."""
    archived = _one(admin_client, "/accounts", q="5100", include_archived=True)
    assert archived["is_archived"] is True

    made = admin_client.post(
        f"{API}/products",
        json={
            "name": f"Archived-account probe {uuid.uuid4().hex[:6]}",
            "type": "SERVICE", "sales_price": 500, "cost_price": 0,
            "income_account_id": archived["id"],
        },
    )
    assert made.status_code == 201, made.text

    invoice = _draft_invoice(admin_client, customer["id"], made.json()["id"])
    response = admin_client.post(f"{API}/customer-invoices/{invoice['id']}/post")
    assert response.status_code == 422
    assert _code(response) == "ACCOUNT_ARCHIVED"


def test_accepts_posting_to_a_live_account(admin_client, customer, product):
    invoice = _draft_invoice(admin_client, customer["id"], product["id"])
    assert admin_client.post(
        f"{API}/customer-invoices/{invoice['id']}/post"
    ).status_code == 200


# ── Rule 9 — a contact cannot see another contact's documents ─────────────────


def test_portal_sees_only_its_own_documents(portal_client, admin_client):
    own = portal_client.get(f"{API}/portal/documents")
    assert own.status_code == 200, own.text
    mine = own.json()["items"]

    me = portal_client.get(f"{API}/auth/me").json()
    assert me["role"]["name"] == "User"

    # Every returned document really is this contact's.
    all_invoices = admin_client.get(
        f"{API}/customer-invoices", params={"page_size": 100}
    ).json()["items"]
    my_ids = {d["id"] for d in mine}
    for invoice in all_invoices:
        if invoice["id"] in my_ids:
            continue
        # Someone else's document is a 404, never a 403 — a 403 would confirm
        # the record exists.
        response = portal_client.get(f"{API}/portal/documents/{invoice['id']}")
        assert response.status_code == 404, (
            f"{invoice['id']} leaked with {response.status_code}"
        )
        assert _code(response) == "NOT_FOUND"


def test_portal_cannot_reach_internal_endpoints(portal_client):
    for path in ("/contacts", "/customer-invoices", "/reports/trial-balance",
                 "/journal-entries", "/payments"):
        response = portal_client.get(f"{API}{path}")
        assert response.status_code == 403, f"{path} returned {response.status_code}"
        assert _code(response) == "FORBIDDEN"


def test_portal_cannot_pay_someone_elses_document(
    portal_client, admin_client, customer, product
):
    """A cross-contact payment is refused as a 404, under the same lock as the
    balance check."""
    me = portal_client.get(f"{API}/auth/me").json()
    others = [
        c for c in admin_client.get(
            f"{API}/contacts", params={"page_size": 100, "q": "Ananya"}
        ).json()["items"]
    ]
    assert others
    invoice = _posted_invoice(admin_client, others[0]["id"], product["id"])

    response = portal_client.post(
        f"{API}/portal/payments",
        headers=_key(),
        json={"invoice_id": invoice["id"], "amount": 10.00},
    )
    assert response.status_code == 404
    assert _code(response) == "NOT_FOUND"
    assert me["id"]  # the caller was authenticated; the refusal is scoping


# ── Rule 10 — an Accountant cannot modify or archive master data ──────────────


def test_rejects_accountant_modifying_master_data(second_user_client, admin_client):
    """The graded RBAC line, taken from the statement's own wording."""
    assert second_user_client.get(f"{API}/auth/me").json()["role"]["name"] == "Accountant"
    contact = _one(admin_client, "/contacts")

    patched = second_user_client.patch(
        f"{API}/contacts/{contact['id']}", json={"name": "Renamed by accountant"}
    )
    assert patched.status_code == 403
    assert _code(patched) == "FORBIDDEN"

    archived = second_user_client.post(f"{API}/contacts/{contact['id']}/archive")
    assert archived.status_code == 403
    assert _code(archived) == "FORBIDDEN"


def test_accepts_accountant_creating_master_data(second_user_client):
    """"Creates Master Data" — the half of the split the Accountant does have."""
    response = second_user_client.post(
        f"{API}/contacts",
        json={"name": f"Created by accountant {uuid.uuid4().hex[:6]}",
              "type": "CUSTOMER"},
    )
    assert response.status_code == 201, response.text


def test_accepts_admin_modifying_master_data(admin_client):
    contact = admin_client.post(
        f"{API}/contacts",
        json={"name": f"Admin edit probe {uuid.uuid4().hex[:6]}", "type": "CUSTOMER"},
    ).json()
    patched = admin_client.patch(
        f"{API}/contacts/{contact['id']}", json={"name": "Renamed by admin"}
    )
    assert patched.status_code == 200, patched.text
    assert patched.json()["name"] == "Renamed by admin"


# ── Rule 11 — PO to Bill copies lines faithfully ──────────────────────────────


def test_converting_a_po_copies_every_line_and_marks_it_billed(
    admin_client, vendor, product
):
    order = admin_client.post(
        f"{API}/purchase-orders",
        json={
            "vendor_id": vendor["id"],
            "lines": [
                {"product_id": product["id"], "quantity": 3, "unit_price": 1500,
                 "tax_pct": 18},
                {"product_id": product["id"], "quantity": 7, "unit_price": 900,
                 "tax_pct": 12},
            ],
        },
    ).json()
    admin_client.post(f"{API}/purchase-orders/{order['id']}/confirm")
    bill = admin_client.post(
        f"{API}/purchase-orders/{order['id']}/create-bill"
    ).json()

    assert len(bill["lines"]) == len(order["lines"]) == 2
    for order_line, bill_line in zip(
        sorted(order["lines"], key=lambda x: x["unit_price"]),
        sorted(bill["lines"], key=lambda x: x["unit_price"]),
        strict=True,
    ):
        assert bill_line["quantity"] == order_line["quantity"]
        assert bill_line["unit_price"] == order_line["unit_price"]
        assert bill_line["tax_pct"] == order_line["tax_pct"]
        assert bill_line["account_id"] == order_line["account_id"]
    assert bill["total"] == order["total"]

    assert admin_client.get(
        f"{API}/purchase-orders/{order['id']}"
    ).json()["status"] == "BILLED"


def test_rejects_billing_an_unconfirmed_po(admin_client, vendor, product):
    order = admin_client.post(
        f"{API}/purchase-orders",
        json={
            "vendor_id": vendor["id"],
            "lines": [{"product_id": product["id"], "quantity": 1,
                       "unit_price": 100}],
        },
    ).json()
    response = admin_client.post(f"{API}/purchase-orders/{order['id']}/create-bill")
    assert response.status_code == 422
    assert _code(response) == "INVALID_STATUS_TRANSITION"


# ── Rules 12 & 15 — the server computes tax, per line, rounded per line ───────


def test_tax_is_computed_per_line_and_ignores_client_supplied_totals(
    admin_client, customer, product
):
    """Two lines at different rates, each rounded before being summed.

    3 x 1499.50 at 12.5% is 4498.50 -> 562.31 (not 562.3125), and 1 x 999.99 at
    18% is 999.99 -> 180.00. Summing rounded line tax gives 742.31; taxing the
    5498.49 subtotal at a blended rate would land somewhere else entirely.
    """
    invoice = admin_client.post(
        f"{API}/customer-invoices",
        json={
            "customer_id": customer["id"],
            # Deliberately sent, and deliberately ignored — totals are derived.
            "total": 999999.99,
            "tax_total": 0,
            "lines": [
                {"product_id": product["id"], "quantity": 3, "unit_price": 1499.50,
                 "tax_pct": 12.5},
                {"product_id": product["id"], "quantity": 1, "unit_price": 999.99,
                 "tax_pct": 18},
            ],
        },
    )
    assert invoice.status_code == 201, invoice.text
    invoice = invoice.json()

    assert invoice["untaxed_total"] == 5498.49
    assert invoice["tax_total"] == 742.31
    assert invoice["total"] == 6240.80

    by_rate = {line["tax_pct"]: line for line in invoice["lines"]}
    assert by_rate[12.5]["tax"] == 562.31
    assert by_rate[18.0]["tax"] == 180.00


# ── Rule 13 — a document with no lines cannot be confirmed or posted ──────────


def test_rejects_confirming_an_order_with_no_lines(admin_client, customer):
    order = admin_client.post(
        f"{API}/sales-orders", json={"customer_id": customer["id"], "lines": []}
    )
    assert order.status_code == 201, order.text
    response = admin_client.post(
        f"{API}/sales-orders/{order.json()['id']}/confirm"
    )
    assert response.status_code == 422
    assert _code(response) == "EMPTY_DOCUMENT"


def test_rejects_posting_an_invoice_with_no_lines(admin_client, customer):
    invoice = admin_client.post(
        f"{API}/customer-invoices", json={"customer_id": customer["id"], "lines": []}
    ).json()
    response = admin_client.post(f"{API}/customer-invoices/{invoice['id']}/post")
    assert response.status_code == 422
    assert _code(response) == "EMPTY_DOCUMENT"


def test_accepts_confirming_an_order_with_lines(admin_client, customer, product):
    order = admin_client.post(
        f"{API}/sales-orders",
        json={
            "customer_id": customer["id"],
            "lines": [{"product_id": product["id"], "quantity": 1,
                       "unit_price": 500}],
        },
    ).json()
    assert admin_client.post(
        f"{API}/sales-orders/{order['id']}/confirm"
    ).status_code == 200


# ── Rule 14 — a document with payments cannot be cancelled ────────────────────


def test_rejects_cancelling_an_invoice_that_has_payments(
    admin_client, customer, product, bank_journal
):
    invoice = _posted_invoice(admin_client, customer["id"], product["id"])
    admin_client.post(
        f"{API}/payments", headers=_key(),
        json={"invoice_id": invoice["id"], "direction": "RECEIVE",
              "journal_id": bank_journal["id"], "amount": 100.00},
    )
    response = admin_client.post(f"{API}/customer-invoices/{invoice['id']}/cancel")
    assert response.status_code == 409
    assert _code(response) == "CANNOT_CANCEL_WITH_PAYMENTS"


def test_accepts_cancelling_an_unpaid_posted_invoice_by_reversing_it(
    admin_client, customer, product
):
    """Cancelling reverses rather than deletes — both entries stay in the ledger
    and the trial balance still lands on zero."""
    invoice = _posted_invoice(admin_client, customer["id"], product["id"])
    entry_id = invoice["journal_entry_id"]

    response = admin_client.post(f"{API}/customer-invoices/{invoice['id']}/cancel")
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "CANCELLED"

    original = admin_client.get(f"{API}/journal-entries/{entry_id}").json()
    assert original["state"] == "REVERSED"

    reversal = [
        e for e in admin_client.get(
            f"{API}/journal-entries", params={"page_size": 100, "state": "POSTED"}
        ).json()["items"]
        if e["reversal_of_id"] == entry_id
    ]
    assert len(reversal) == 1

    balance = admin_client.get(f"{API}/reports/trial-balance").json()
    assert balance["is_balanced"] is True


# ── Rule 16 — a line's tax and account are a snapshot, not a live lookup ──────


def test_changing_a_product_price_does_not_rewrite_an_existing_document(
    admin_client, customer
):
    made = admin_client.post(
        f"{API}/products",
        json={
            "name": f"Snapshot probe {uuid.uuid4().hex[:6]}", "type": "GOODS",
            "sales_price": 1000, "cost_price": 500, "sales_tax_pct": 5,
        },
    ).json()

    # A line created with no explicit price or rate snapshots the product's.
    invoice = admin_client.post(
        f"{API}/customer-invoices",
        json={
            "customer_id": customer["id"],
            "lines": [{"product_id": made["id"], "quantity": 2}],
        },
    ).json()
    assert invoice["lines"][0]["unit_price"] == 1000.00
    assert invoice["lines"][0]["tax_pct"] == 5.00
    assert invoice["total"] == 2100.00

    # The product's price and rate both change afterwards.
    admin_client.patch(
        f"{API}/products/{made['id']}", json={"sales_price": 9999, "sales_tax_pct": 28}
    )

    unchanged = admin_client.get(f"{API}/customer-invoices/{invoice['id']}").json()
    assert unchanged["lines"][0]["unit_price"] == 1000.00
    assert unchanged["lines"][0]["tax_pct"] == 5.00
    assert unchanged["total"] == 2100.00


# ── Rule 17 — archiving never touches history ─────────────────────────────────


def test_archiving_a_product_leaves_posted_documents_and_reports_intact(
    admin_client, customer
):
    made = admin_client.post(
        f"{API}/products",
        json={"name": f"Archive probe {uuid.uuid4().hex[:6]}", "type": "GOODS",
              "sales_price": 700, "cost_price": 300},
    ).json()
    invoice = _posted_invoice(admin_client, customer["id"], made["id"])

    before = admin_client.get(f"{API}/reports/trial-balance").json()
    assert admin_client.post(
        f"{API}/products/{made['id']}/archive"
    ).status_code == 200

    # The document is untouched...
    after_doc = admin_client.get(f"{API}/customer-invoices/{invoice['id']}").json()
    assert after_doc["total"] == invoice["total"]
    assert after_doc["status"] == "POSTED"

    # ...and so is the ledger it produced.
    after = admin_client.get(f"{API}/reports/trial-balance").json()
    assert after["total_debit"] == before["total_debit"]
    assert after["is_balanced"] is True

    # But it can no longer be put on a new document.
    blocked = admin_client.post(
        f"{API}/customer-invoices",
        json={
            "customer_id": customer["id"],
            "lines": [{"product_id": made["id"], "quantity": 1}],
        },
    )
    assert blocked.status_code == 422
    assert _code(blocked) == "PRODUCT_ARCHIVED"


def test_archived_master_data_is_hidden_from_lists_but_still_fetchable(admin_client):
    archived = _one(admin_client, "/accounts", q="5100", include_archived=True)
    visible = admin_client.get(
        f"{API}/accounts", params={"page_size": 100}
    ).json()["items"]
    assert archived["id"] not in {a["id"] for a in visible}
    assert admin_client.get(f"{API}/accounts/{archived['id']}").status_code == 200


# ── Idempotency — the double-clicked Pay button ───────────────────────────────


def test_replaying_an_idempotency_key_returns_the_original_payment(
    admin_client, customer, product, bank_journal
):
    invoice = _posted_invoice(admin_client, customer["id"], product["id"])
    body = {
        "invoice_id": invoice["id"], "direction": "RECEIVE",
        "journal_id": bank_journal["id"], "amount": 100.00,
    }
    headers = _key()

    first = admin_client.post(f"{API}/payments", headers=headers, json=body)
    assert first.status_code == 201, first.text

    second = admin_client.post(f"{API}/payments", headers=headers, json=body)
    # A retry is not an error: 200 with the original, not a second payment.
    assert second.status_code == 200
    assert second.json()["id"] == first.json()["id"]

    state = admin_client.get(f"{API}/customer-invoices/{invoice['id']}").json()
    assert state["amount_paid"] == 100.00, "the retry must not have paid twice"


def test_rejects_a_payment_with_no_idempotency_key(
    admin_client, customer, product, bank_journal
):
    invoice = _posted_invoice(admin_client, customer["id"], product["id"])
    response = admin_client.post(
        f"{API}/payments",
        json={"invoice_id": invoice["id"], "direction": "RECEIVE",
              "journal_id": bank_journal["id"], "amount": 10.00},
    )
    assert response.status_code == 422
    assert _code(response) == "VALIDATION_ERROR"


def test_rejects_reusing_a_key_for_a_different_payment(
    admin_client, customer, product, bank_journal
):
    invoice = _posted_invoice(admin_client, customer["id"], product["id"])
    headers = _key()
    admin_client.post(
        f"{API}/payments", headers=headers,
        json={"invoice_id": invoice["id"], "direction": "RECEIVE",
              "journal_id": bank_journal["id"], "amount": 50.00},
    )
    response = admin_client.post(
        f"{API}/payments", headers=headers,
        json={"invoice_id": invoice["id"], "direction": "RECEIVE",
              "journal_id": bank_journal["id"], "amount": 75.00},
    )
    assert response.status_code == 409
    assert _code(response) == "DUPLICATE_PAYMENT"


# ── Payment journal and target validation ─────────────────────────────────────


def test_rejects_paying_through_a_sales_journal(
    admin_client, customer, product, sales_journal
):
    invoice = _posted_invoice(admin_client, customer["id"], product["id"])
    response = admin_client.post(
        f"{API}/payments", headers=_key(),
        json={"invoice_id": invoice["id"], "direction": "RECEIVE",
              "journal_id": sales_journal["id"], "amount": 10.00},
    )
    assert response.status_code == 422
    assert _code(response) == "INVALID_JOURNAL_TYPE"


def test_rejects_a_payment_targeting_both_or_neither_document(
    admin_client, bank_journal
):
    for targets in ({}, {"invoice_id": str(uuid.uuid4()), "bill_id": str(uuid.uuid4())}):
        response = admin_client.post(
            f"{API}/payments", headers=_key(),
            json={"direction": "RECEIVE", "journal_id": bank_journal["id"],
                  "amount": 10.00, **targets},
        )
        assert response.status_code == 422
        assert _code(response) == "VALIDATION_ERROR"


def test_rejects_paying_a_draft_invoice(
    admin_client, customer, product, bank_journal
):
    """There is no receivable to settle until the invoice has posted."""
    invoice = _draft_invoice(admin_client, customer["id"], product["id"])
    response = admin_client.post(
        f"{API}/payments", headers=_key(),
        json={"invoice_id": invoice["id"], "direction": "RECEIVE",
              "journal_id": bank_journal["id"], "amount": 10.00},
    )
    assert response.status_code == 422
    assert _code(response) == "INVALID_STATUS_TRANSITION"


# ── Contact type — a vendor cannot be billed as a customer ────────────────────


def test_rejects_a_vendor_on_a_sales_document(admin_client, vendor, product):
    response = admin_client.post(
        f"{API}/sales-orders",
        json={
            "customer_id": vendor["id"],
            "lines": [{"product_id": product["id"], "quantity": 1,
                       "unit_price": 100}],
        },
    )
    assert response.status_code == 422
    assert _code(response) == "CONTACT_TYPE_MISMATCH"


def test_accepts_a_both_contact_on_either_chain(admin_client, product):
    both = _one(admin_client, "/contacts", q="Urban Interiors")
    assert both["type"] == "BOTH"
    line = [{"product_id": product["id"], "quantity": 1, "unit_price": 100}]

    sale = admin_client.post(
        f"{API}/sales-orders", json={"customer_id": both["id"], "lines": line}
    )
    assert sale.status_code == 201, sale.text
    purchase = admin_client.post(
        f"{API}/purchase-orders", json={"vendor_id": both["id"], "lines": line}
    )
    assert purchase.status_code == 201, purchase.text


# ── Budgets — computed achievement and the revision chain ─────────────────────


def test_budget_lines_compute_achievement_without_storing_it(admin_client):
    budget = _one(admin_client, "/budgets", state="CONFIRMED")
    detail = admin_client.get(f"{API}/budgets/{budget['id']}").json()
    assert detail["lines"], "a seeded budget should have lines"

    for line in detail["lines"]:
        assert line["amount_to_achieve"] == round(
            line["committed_amount"] - line["achieved_amount"], 2
        )
        if line["committed_amount"] > 0:
            assert line["achieved_pct"] == round(
                line["achieved_amount"] / line["committed_amount"] * 100, 2
            )


def test_revising_a_budget_creates_a_linked_successor(admin_client):
    created = admin_client.post(
        f"{API}/budgets",
        json={
            "name": f"Revision probe {uuid.uuid4().hex[:6]}",
            "period_start": "2026-01-01", "period_end": "2026-12-31",
            "lines": [],
        },
    ).json()
    admin_client.post(f"{API}/budgets/{created['id']}/confirm")

    successor = admin_client.post(f"{API}/budgets/{created['id']}/revise")
    assert successor.status_code == 201, successor.text
    successor = successor.json()

    assert successor["name"].endswith(" Revised")
    assert successor["revision_of_id"] == created["id"]

    original = admin_client.get(f"{API}/budgets/{created['id']}").json()
    assert original["state"] == "REVISED"
    assert original["revised_with_id"] == successor["id"]

    # A budget can only be revised once.
    again = admin_client.post(f"{API}/budgets/{created['id']}/revise")
    assert again.status_code == 409
    assert _code(again) == "ALREADY_REVISED"


def test_rejects_revising_a_draft_budget(admin_client):
    draft = admin_client.post(
        f"{API}/budgets",
        json={
            "name": f"Draft probe {uuid.uuid4().hex[:6]}",
            "period_start": "2026-01-01", "period_end": "2026-06-30", "lines": [],
        },
    ).json()
    response = admin_client.post(f"{API}/budgets/{draft['id']}/revise")
    assert response.status_code == 422
    assert _code(response) == "BUDGET_NOT_CONFIRMED"


def test_rejects_a_budget_period_that_ends_before_it_starts(admin_client):
    response = admin_client.post(
        f"{API}/budgets",
        json={"name": "Backwards", "period_start": "2026-06-30",
              "period_end": "2026-01-01", "lines": []},
    )
    assert response.status_code == 422
    assert _code(response) == "VALIDATION_ERROR"


# ── Sign up (04_API_CONTRACT.md §3.0) ─────────────────────────────────────────


@pytest.mark.parametrize(
    ("password", "why"),
    [
        ("Short1!a", "exactly 8 characters — the rule is *longer* than 8"),
        ("alllowercase@1", "no uppercase letter"),
        ("ALLUPPERCASE@1", "no lowercase letter"),
        ("NoSpecialChar1", "no special character"),
    ],
)
def test_rejects_a_weak_signup_password(password, why):
    client = TestClient(app)
    response = client.post(
        f"{API}/auth/signup",
        json={
            "login_id": f"u{uuid.uuid4().hex[:8]}",
            "email": f"{uuid.uuid4().hex[:8]}@example.in",
            "full_name": "Test User", "password": password,
        },
    )
    assert response.status_code == 422, why
    assert _code(response) == "WEAK_PASSWORD"
    assert "password" in response.json()["error"]["fields"]


@pytest.mark.parametrize("login_id", ["short", "waytoolongloginid"])
def test_rejects_a_login_id_outside_six_to_twelve_characters(login_id):
    client = TestClient(app)
    response = client.post(
        f"{API}/auth/signup",
        json={
            "login_id": login_id,
            "email": f"{uuid.uuid4().hex[:8]}@example.in",
            "full_name": "Test User", "password": "Valid@Pass123",
        },
    )
    assert response.status_code == 422
    assert _code(response) == "VALIDATION_ERROR"


def test_accepts_a_valid_signup_and_creates_an_accountant():
    client = TestClient(app)
    login_id = f"u{uuid.uuid4().hex[:8]}"
    email = f"{uuid.uuid4().hex[:8]}@example.in"
    response = client.post(
        f"{API}/auth/signup",
        json={"login_id": login_id, "email": email, "full_name": "New Joiner",
              "password": "Valid@Pass123"},
    )
    assert response.status_code == 201, response.text
    # Self-registration always creates an Accountant, never an Admin.
    assert response.json()["role"]["name"] == "Accountant"

    duplicate = client.post(
        f"{API}/auth/signup",
        json={"login_id": login_id, "email": f"{uuid.uuid4().hex[:8]}@example.in",
              "full_name": "Impostor", "password": "Valid@Pass123"},
    )
    assert duplicate.status_code == 409
    assert _code(duplicate) == "LOGIN_ID_TAKEN"

    duplicate_email = client.post(
        f"{API}/auth/signup",
        json={"login_id": f"u{uuid.uuid4().hex[:8]}", "email": email,
              "full_name": "Impostor", "password": "Valid@Pass123"},
    )
    assert duplicate_email.status_code == 409
    assert _code(duplicate_email) == "EMAIL_TAKEN"


# ── Numbering ─────────────────────────────────────────────────────────────────


def test_document_numbers_match_the_specified_formats(admin_client):
    import re

    checks = [
        ("/customer-invoices", r"^INV/\d{4}/\d{4}$"),
        ("/vendor-bills", r"^Bill/\d{4}/\d{4}$"),
        ("/sales-orders", r"^S\d{5}$"),
        ("/purchase-orders", r"^P\d{5}$"),
        ("/journal-entries", r"^JE/\d{4}/\d{5}$"),
    ]
    for path, pattern in checks:
        rows = admin_client.get(
            f"{API}{path}", params={"page_size": 20}
        ).json()["items"]
        assert rows, f"expected rows at {path}"
        key = "entry_number" if "journal" in path else "number"
        for row in rows:
            assert re.match(pattern, row[key]), (
                f"{row[key]} does not match {pattern}"
            )


def test_numbers_are_unique_and_gapless_within_their_sequence(admin_client):
    rows = admin_client.get(
        f"{API}/sales-orders", params={"page_size": 100, "sort": "number"}
    ).json()["items"]
    numbers = [int(r["number"][1:]) for r in rows]
    assert len(numbers) == len(set(numbers)), "a number was issued twice"
    # Gapless within the range actually returned.
    assert numbers == list(range(min(numbers), min(numbers) + len(numbers)))
