"""One accept + one reject test per row of the rule matrix in
docs/07_TESTING_AND_REVIEW.md §1.2, cross-referenced against the 17 rules in
docs/PROBLEM_STATEMENT.md §2.

Every test below is written against a service or router module that this
schema-only delivery does not build (`app.services.documents`,
`app.services.payments`, `app.services.budgets`, `app.routers.*`). Each such
module is loaded through `pytest.importorskip` so the file collects cleanly
and reports a readable "pending: ..." skip reason instead of a collection
error — this file is the spec those modules are built against, not a
claim that they exist yet.

Tests that need only the schema (no service layer) live in
test_schema_constraints.py and run for real today.
"""

from decimal import Decimal

import pytest


def _skip(module, note):
    return pytest.importorskip(module, reason=f"pending: {note}")


def _skip_unless_route_exists(method: str, path: str, note: str) -> None:
    """For endpoints on a router module that already exists (app.routers.auth is
    real today) but doesn't yet have this specific route — importorskip on the
    module would wrongly let the test run and hit a live 404. Check the actual
    FastAPI route table instead."""
    from app.main import app as fastapi_app

    for route in fastapi_app.routes:
        if getattr(route, "path", None) == path and method.upper() in getattr(
            route, "methods", set()
        ):
            return
    pytest.skip(reason=f"pending: {note}")


# ---------------------------------------------------------------------------
# Rule 3 — posted entry cannot be edited or deleted
# ---------------------------------------------------------------------------


def test_posted_entry_rejects_edit(db, chart_of_accounts, journals, today):
    posting = _skip("app.services.posting", "app/services/posting.py — require_status guard")
    from app.core.errors import AppError

    entry = posting.post_entry(
        db,
        journal=journals["sales"],
        entry_date=today,
        reference="r",
        source_type="manual",
        source_id=None,
        lines=[],
        actor_id=None,
    )
    with pytest.raises(AppError) as exc:
        posting.edit_entry(db, entry.id, actor_id=None, reference="changed")
    assert exc.value.code == "CANNOT_MODIFY_POSTED"


def test_draft_entry_edit_succeeds(db, chart_of_accounts, journals, today):
    posting = _skip("app.services.posting", "app/services/posting.py")
    draft = posting.create_draft_entry(db, journal=journals["sales"], entry_date=today)
    posting.edit_entry(db, draft.id, actor_id=None, reference="fine to edit")


# ---------------------------------------------------------------------------
# Rule 7 — no double posting (service-level idempotent response, not just the DB guard)
# ---------------------------------------------------------------------------


def test_posting_twice_returns_already_posted_on_the_second_call(
    db, chart_of_accounts, journals, customer, today
):
    documents = _skip("app.services.documents", "app/services/documents.py — confirm/post flow")
    from app.core.errors import AppError

    invoice = documents.create_invoice(db, customer=customer, invoice_date=today, actor_id=None)
    documents.confirm_and_post_invoice(db, invoice.id, actor_id=None)
    with pytest.raises(AppError) as exc:
        documents.confirm_and_post_invoice(db, invoice.id, actor_id=None)
    assert exc.value.code == "ALREADY_POSTED"


# ---------------------------------------------------------------------------
# Rule 8 — archived account rejects new postings
# ---------------------------------------------------------------------------


def test_archived_account_rejects_new_posting(db, chart_of_accounts, journals, today):
    posting = _skip("app.services.posting", "app/services/posting.py — require_active_account")
    from app.core.errors import AppError

    chart_of_accounts["sales_income"].is_archived = True
    db.flush()
    with pytest.raises(AppError) as exc:
        posting.post_entry(
            db,
            journal=journals["sales"],
            entry_date=today,
            reference="r",
            source_type="manual",
            source_id=None,
            lines=[
                posting.LineDraft(account=chart_of_accounts["debtors"], debit=Decimal("10")),
                posting.LineDraft(account=chart_of_accounts["sales_income"], credit=Decimal("10")),
            ],
            actor_id=None,
        )
    assert exc.value.code == "ACCOUNT_ARCHIVED"


def test_active_account_posts_fine(db, chart_of_accounts, journals, today):
    posting = _skip("app.services.posting", "app/services/posting.py")
    posting.post_entry(
        db,
        journal=journals["sales"],
        entry_date=today,
        reference="r",
        source_type="manual",
        source_id=None,
        lines=[
            posting.LineDraft(account=chart_of_accounts["debtors"], debit=Decimal("10")),
            posting.LineDraft(account=chart_of_accounts["sales_income"], credit=Decimal("10")),
        ],
        actor_id=None,
    )


# ---------------------------------------------------------------------------
# Rule 6 — payment allocation cannot exceed remaining balance
# ---------------------------------------------------------------------------


def test_overallocated_payment_is_rejected(db, chart_of_accounts, journals, customer, today):
    payments = _skip("app.services.payments", "app/services/payments.py")
    documents = _skip("app.services.documents", "app/services/documents.py")
    from app.core.errors import AppError

    invoice = documents.create_invoice(db, customer=customer, invoice_date=today, actor_id=None)
    documents.confirm_and_post_invoice(db, invoice.id, actor_id=None)  # total = 100.00, say
    with pytest.raises(AppError) as exc:
        payments.pay(
            db,
            invoice_id=invoice.id,
            amount=Decimal("150.00"),
            journal=journals["bank"],
            payment_date=today,
            idempotency_key="over-1",
            actor_id=None,
        )
    assert exc.value.code == "OVERALLOCATED_PAYMENT"


def test_exact_balance_payment_settles_in_full(db, chart_of_accounts, journals, customer, today):
    payments = _skip("app.services.payments", "app/services/payments.py")
    documents = _skip("app.services.documents", "app/services/documents.py")

    invoice = documents.create_invoice(db, customer=customer, invoice_date=today, actor_id=None)
    documents.confirm_and_post_invoice(db, invoice.id, actor_id=None)
    payments.pay(
        db,
        invoice_id=invoice.id,
        amount=invoice.total - invoice.amount_paid,
        journal=journals["bank"],
        payment_date=today,
        idempotency_key="exact-1",
        actor_id=None,
    )
    assert invoice.status.value == "PAID"


def test_partial_payment_leaves_status_partial(db, chart_of_accounts, journals, customer, today):
    payments = _skip("app.services.payments", "app/services/payments.py")
    documents = _skip("app.services.documents", "app/services/documents.py")

    invoice = documents.create_invoice(db, customer=customer, invoice_date=today, actor_id=None)
    documents.confirm_and_post_invoice(db, invoice.id, actor_id=None)
    payments.pay(
        db,
        invoice_id=invoice.id,
        amount=(invoice.total - invoice.amount_paid) / 2,
        journal=journals["bank"],
        payment_date=today,
        idempotency_key="partial-1",
        actor_id=None,
    )
    assert invoice.status.value == "PARTIAL"


# ---------------------------------------------------------------------------
# Idempotent payment — the double-click guard
# ---------------------------------------------------------------------------


def test_same_idempotency_key_returns_the_original_payment(
    db, chart_of_accounts, journals, customer, today
):
    payments = _skip("app.services.payments", "app/services/payments.py §5")
    documents = _skip("app.services.documents", "app/services/documents.py")

    invoice = documents.create_invoice(db, customer=customer, invoice_date=today, actor_id=None)
    documents.confirm_and_post_invoice(db, invoice.id, actor_id=None)
    first = payments.pay(
        db,
        invoice_id=invoice.id,
        amount=Decimal("10.00"),
        journal=journals["bank"],
        payment_date=today,
        idempotency_key="dup-key",
        actor_id=None,
    )
    second = payments.pay(
        db,
        invoice_id=invoice.id,
        amount=Decimal("10.00"),
        journal=journals["bank"],
        payment_date=today,
        idempotency_key="dup-key",
        actor_id=None,
    )
    assert first.id == second.id


def test_different_idempotency_keys_create_two_payments(
    db, chart_of_accounts, journals, customer, today
):
    payments = _skip("app.services.payments", "app/services/payments.py")
    documents = _skip("app.services.documents", "app/services/documents.py")

    invoice = documents.create_invoice(db, customer=customer, invoice_date=today, actor_id=None)
    documents.confirm_and_post_invoice(db, invoice.id, actor_id=None)
    first = payments.pay(
        db,
        invoice_id=invoice.id,
        amount=Decimal("5.00"),
        journal=journals["bank"],
        payment_date=today,
        idempotency_key="key-a",
        actor_id=None,
    )
    second = payments.pay(
        db,
        invoice_id=invoice.id,
        amount=Decimal("5.00"),
        journal=journals["bank"],
        payment_date=today,
        idempotency_key="key-b",
        actor_id=None,
    )
    assert first.id != second.id


# ---------------------------------------------------------------------------
# Status transitions
# ---------------------------------------------------------------------------


def test_billing_a_draft_purchase_order_is_rejected(db, vendor, today):
    documents = _skip("app.services.documents", "app/services/documents.py")
    from app.core.errors import AppError

    po = documents.create_purchase_order(db, vendor=vendor, order_date=today, actor_id=None)
    with pytest.raises(AppError) as exc:
        documents.convert_po_to_bill(db, po.id, actor_id=None)
    assert exc.value.code == "INVALID_STATUS_TRANSITION"


def test_confirmed_purchase_order_bills_successfully(db, vendor, today):
    documents = _skip("app.services.documents", "app/services/documents.py")

    po = documents.create_purchase_order(db, vendor=vendor, order_date=today, actor_id=None)
    documents.confirm_purchase_order(db, po.id, actor_id=None)
    bill = documents.convert_po_to_bill(db, po.id, actor_id=None)
    assert bill is not None
    assert po.status.value == "BILLED"


# ---------------------------------------------------------------------------
# Rule 10 — accountant cannot modify or archive master data (RBAC)
# ---------------------------------------------------------------------------


def test_accountant_cannot_patch_a_contact(second_user_client):
    _skip("app.routers.masters", "app/routers/masters.py — contacts router (RBAC-gated)")
    resp = second_user_client.patch("/api/v1/contacts/some-id", json={"name": "x"})
    assert resp.status_code == 403


def test_admin_can_patch_a_contact(admin_client):
    _skip("app.routers.masters", "app/routers/masters.py")
    resp = admin_client.patch("/api/v1/contacts/some-id", json={"name": "x"})
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Rule 9 — a contact cannot see another contact's documents (404, not 403)
# ---------------------------------------------------------------------------


def test_portal_user_gets_404_on_another_contacts_invoice(client):
    _skip("app.routers.portal", "app/routers/portal.py — data-scoped portal endpoints")
    resp = client.get("/api/v1/portal/invoices/not-mine")
    assert resp.status_code == 404  # not 403 — a 403 would confirm the record exists


def test_portal_user_sees_own_invoice(client):
    _skip("app.routers.portal", "app/routers/portal.py")
    resp = client.get("/api/v1/portal/invoices/mine")
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Rule 12 — tax computed by system, never typed by user
# ---------------------------------------------------------------------------


def test_client_sent_tax_amount_is_ignored(db, chart_of_accounts, customer, product, today):
    documents = _skip("app.services.documents", "app/services/documents.py")

    invoice = documents.create_invoice(db, customer=customer, invoice_date=today, actor_id=None)
    line = documents.add_invoice_line(
        db,
        invoice_id=invoice.id,
        product_id=product.id,
        quantity=Decimal("1"),
        # a malicious/naive client also sends an explicit tax_amount; it must be ignored
        client_supplied_tax_amount=Decimal("999999.99"),
    )
    expected_tax = round(product.sales_price * product.sales_tax_pct / 100, 2)
    assert line.tax_pct == product.sales_tax_pct
    assert round(line.quantity * line.unit_price * line.tax_pct / 100, 2) == expected_tax


# ---------------------------------------------------------------------------
# Rule 13 — no zero-line documents
# ---------------------------------------------------------------------------


def test_confirming_an_empty_invoice_is_rejected(db, customer, today):
    documents = _skip("app.services.documents", "app/services/documents.py")
    from app.core.errors import AppError

    invoice = documents.create_invoice(db, customer=customer, invoice_date=today, actor_id=None)
    with pytest.raises(AppError) as exc:
        documents.confirm_and_post_invoice(db, invoice.id, actor_id=None)
    assert exc.value.code == "EMPTY_DOCUMENT"


def test_confirming_an_invoice_with_one_line_succeeds(db, customer, product, today):
    documents = _skip("app.services.documents", "app/services/documents.py")

    invoice = documents.create_invoice(db, customer=customer, invoice_date=today, actor_id=None)
    documents.add_invoice_line(db, invoice_id=invoice.id, product_id=product.id, quantity=Decimal("1"))
    documents.confirm_and_post_invoice(db, invoice.id, actor_id=None)
    assert invoice.status.value in ("POSTED", "PARTIAL", "PAID")


# ---------------------------------------------------------------------------
# Rule 14 — paid document cannot be cancelled
# ---------------------------------------------------------------------------


def test_cancelling_a_paid_invoice_is_rejected(db, chart_of_accounts, journals, customer, product, today):
    documents = _skip("app.services.documents", "app/services/documents.py")
    payments = _skip("app.services.payments", "app/services/payments.py")
    from app.core.errors import AppError

    invoice = documents.create_invoice(db, customer=customer, invoice_date=today, actor_id=None)
    documents.add_invoice_line(db, invoice_id=invoice.id, product_id=product.id, quantity=Decimal("1"))
    documents.confirm_and_post_invoice(db, invoice.id, actor_id=None)
    payments.pay(
        db,
        invoice_id=invoice.id,
        amount=invoice.total,
        journal=journals["bank"],
        payment_date=today,
        idempotency_key="pay-before-cancel",
        actor_id=None,
    )
    with pytest.raises(AppError) as exc:
        documents.cancel_invoice(db, invoice.id, actor_id=None)
    assert exc.value.code == "CANNOT_CANCEL_WITH_PAYMENTS"


def test_cancelling_an_unpaid_draft_succeeds(db, customer, product, today):
    documents = _skip("app.services.documents", "app/services/documents.py")

    invoice = documents.create_invoice(db, customer=customer, invoice_date=today, actor_id=None)
    documents.add_invoice_line(db, invoice_id=invoice.id, product_id=product.id, quantity=Decimal("1"))
    documents.cancel_invoice(db, invoice.id, actor_id=None)
    assert invoice.status.value == "CANCELLED"


# ---------------------------------------------------------------------------
# Rule 16 — a line's tax rate and account mapping are a snapshot at creation time
# ---------------------------------------------------------------------------


def test_changing_product_tax_rate_does_not_affect_an_already_created_line(
    db, customer, product, today
):
    documents = _skip("app.services.documents", "app/services/documents.py")

    invoice = documents.create_invoice(db, customer=customer, invoice_date=today, actor_id=None)
    line = documents.add_invoice_line(
        db, invoice_id=invoice.id, product_id=product.id, quantity=Decimal("1")
    )
    original_rate = line.tax_pct
    product.sales_tax_pct = original_rate + 10
    db.flush()
    db.refresh(line)
    assert line.tax_pct == original_rate


# ---------------------------------------------------------------------------
# Rule 17 — archiving doesn't rewrite history
# ---------------------------------------------------------------------------


def test_archived_contact_cannot_be_used_on_a_new_invoice(db, customer, today):
    documents = _skip("app.services.documents", "app/services/documents.py")
    from app.core.errors import AppError

    customer.is_archived = True
    db.flush()
    with pytest.raises(AppError):
        documents.create_invoice(db, customer=customer, invoice_date=today, actor_id=None)


def test_archived_contacts_existing_invoices_still_post(db, customer, product, today):
    """Archiving after the fact must not touch documents that already reference the contact."""
    documents = _skip("app.services.documents", "app/services/documents.py")

    invoice = documents.create_invoice(db, customer=customer, invoice_date=today, actor_id=None)
    documents.add_invoice_line(db, invoice_id=invoice.id, product_id=product.id, quantity=Decimal("1"))
    customer.is_archived = True
    db.flush()
    documents.confirm_and_post_invoice(db, invoice.id, actor_id=None)  # must not raise


# ---------------------------------------------------------------------------
# Sign-up credential rules (docs/03_DATA_MODEL.md §9)
# ---------------------------------------------------------------------------


def test_signup_rejects_a_weak_password(client):
    _skip_unless_route_exists(
        "POST", "/api/v1/auth/signup", "app/routers/auth.py — self-registration endpoint"
    )
    resp = client.post(
        "/api/v1/auth/signup",
        json={"login_id": "newuser1", "email": "new@example.test", "password": "weak"},
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "WEAK_PASSWORD"


def test_signup_rejects_a_taken_login_id(client):
    _skip_unless_route_exists("POST", "/api/v1/auth/signup", "app/routers/auth.py")
    payload = {"login_id": "taken01", "email": "a@example.test", "password": "Str0ng!Pass"}
    client.post("/api/v1/auth/signup", json=payload)
    resp = client.post(
        "/api/v1/auth/signup", json={**payload, "email": "b@example.test"}
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "LOGIN_ID_TAKEN"


def test_valid_signup_creates_an_accountant(client):
    _skip_unless_route_exists("POST", "/api/v1/auth/signup", "app/routers/auth.py")
    resp = client.post(
        "/api/v1/auth/signup",
        json={"login_id": "gooduser1", "email": "good@example.test", "password": "Str0ng!Pass"},
    )
    assert resp.status_code == 201
    assert resp.json()["role"] == "Accountant"


# ---------------------------------------------------------------------------
# Mail never blocks posting (docs/06_BACKEND.md §7)
# ---------------------------------------------------------------------------


def test_smtp_failure_does_not_roll_back_the_posted_document(
    db, customer, product, today, monkeypatch
):
    documents = _skip("app.services.documents", "app/services/documents.py")
    mail = _skip("app.services.mail", "app/services/mail.py")

    async def _boom(*a, **k):
        raise RuntimeError("smtp down")

    monkeypatch.setattr(mail, "send_document", _boom)

    invoice = documents.create_invoice(db, customer=customer, invoice_date=today, actor_id=None)
    documents.add_invoice_line(db, invoice_id=invoice.id, product_id=product.id, quantity=Decimal("1"))
    documents.confirm_and_post_invoice(db, invoice.id, actor_id=None)
    assert invoice.status.value != "DRAFT"  # still posted regardless of mail failure


# ---------------------------------------------------------------------------
# Budget rules
# ---------------------------------------------------------------------------


def test_revising_a_draft_budget_is_rejected(db, analytic_accounts, today):
    budgets = _skip("app.services.budgets", "app/services/budgets.py")
    from app.core.errors import AppError
    from app.models import Budget
    from app.models.enums import BudgetState

    budget = Budget(
        name="Draft budget", period_start=today, period_end=today, state=BudgetState.DRAFT
    )
    db.add(budget)
    db.flush()
    with pytest.raises(AppError) as exc:
        budgets.revise(db, budget.id, actor_id=None)
    assert exc.value.code == "BUDGET_NOT_CONFIRMED"


def test_revising_a_confirmed_budget_a_second_time_is_rejected(db, analytic_accounts, today):
    budgets = _skip("app.services.budgets", "app/services/budgets.py")
    from app.core.errors import AppError
    from app.models import Budget
    from app.models.enums import BudgetState

    budget = Budget(
        name="Confirmed budget", period_start=today, period_end=today, state=BudgetState.CONFIRMED
    )
    db.add(budget)
    db.flush()
    budgets.revise(db, budget.id, actor_id=None)
    with pytest.raises(AppError) as exc:
        budgets.revise(db, budget.id, actor_id=None)
    assert exc.value.code == "ALREADY_REVISED"
