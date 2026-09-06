"""Print, PDF and Send for documents, and PDF for reports (§3.5, §3.8).

Kept in one module rather than duplicated across `sales.py` and `purchases.py`:
an invoice and a bill differ by two field names here, and three near-identical
copies of a PDF endpoint is how the invoice layout and the bill layout end up
diverging without anyone deciding that they should.

Portal access is allowed on a document the caller owns — a customer must be able
to download their own invoice — and the ownership test is the same 404-not-403
rule the rest of the portal uses.
"""

from datetime import date

from fastapi import APIRouter, Body, Depends, Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.errors import AppError
from app.core.rbac import ROLE_PORTAL, get_current_user, require_txn_write
from app.models.auth import User
from app.models.documents import CustomerInvoice, VendorBill
from app.models.masters import Contact
from app.services import mail as mail_svc
from app.services import reports as report_svc
from app.services.rendering import html_to_pdf, money, render_document, render_report

router = APIRouter(tags=["output"])

# `/reports/{name}/pdf` is declared on its own router and included FIRST.
# `/{doc_type}/{doc_id}/pdf` below is two wildcards wide and would otherwise
# swallow it — FastAPI matches in declaration order, not by specificity, so
# "reports" would arrive as a doc_type and 404. Specific before generic.
reports_router = APIRouter(tags=["reports"])
documents_router = APIRouter(tags=["output"])

_DOCUMENTS = {
    "customer-invoices": (CustomerInvoice, "customer_invoice", "customer_id"),
    "vendor-bills": (VendorBill, "vendor_bill", "vendor_id"),
}


def _load(db: Session, doc_type: str, doc_id: str, user: User):
    """Fetch a document, enforcing portal scoping when the caller is a contact."""
    if doc_type not in _DOCUMENTS:
        raise AppError("NOT_FOUND", "There is no such document type.", 404)

    model, kind, owner_field = _DOCUMENTS[doc_type]
    doc = db.get(model, doc_id)
    if doc is None:
        raise AppError("NOT_FOUND", "That document no longer exists.", 404)

    # A portal user reaches only their own document, and a miss is a 404 — the
    # same reasoning as routers/portal.py: a 403 would confirm it exists.
    if user.role.name == ROLE_PORTAL and getattr(doc, owner_field) != user.contact_id:
        raise AppError("NOT_FOUND", "That document no longer exists.", 404)

    contact = db.get(Contact, getattr(doc, owner_field))
    return doc, contact, kind


@documents_router.get("/{doc_type}/{doc_id}/print", response_class=Response)
def print_document(
    doc_type: str,
    doc_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Response:
    """The print view — the same HTML the PDF is rendered from."""
    doc, contact, kind = _load(db, doc_type, doc_id, user)
    return Response(
        content=render_document(doc, contact, kind=kind), media_type="text/html"
    )


@documents_router.get("/{doc_type}/{doc_id}/pdf", response_class=Response)
def document_pdf(
    doc_type: str,
    doc_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Response:
    doc, contact, kind = _load(db, doc_type, doc_id, user)
    pdf = html_to_pdf(render_document(doc, contact, kind=kind))
    filename = f"{doc.number.replace('/', '-')}.pdf"
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@documents_router.post("/{doc_type}/{doc_id}/send")
def send_document(
    doc_type: str,
    doc_id: str,
    to: str | None = Body(None, embed=True),
    db: Session = Depends(get_db),
    user: User = Depends(require_txn_write),
) -> dict:
    """Mail the document. Returns as soon as the attempt resolves.

    A delivery failure is reported in the body (`queued: false` with an `error`),
    not raised — the document is already posted, and mail must not be able to
    look like it undid that.
    """
    doc, contact, kind = _load(db, doc_type, doc_id, user)
    return mail_svc.send_document(db, doc, contact, kind=kind, to=to)


# ── Report PDFs ───────────────────────────────────────────────────────────────


@reports_router.get("/reports/{name}/pdf", response_class=Response)
def report_pdf(
    name: str,
    as_of: date | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Response:
    """`Pdf download on click`, as the mockup annotates the P&L screen."""
    from app.models.base import utc_now

    today = utc_now().date()

    if name == "profit-and-loss":
        report = report_svc.profit_and_loss(
            db, date_from or date(today.year, 1, 1), date_to or today
        )
        sections = [
            {
                "label": section["label"],
                "total": money(section["total"]),
                "rows": [
                    {
                        "code": row["account_code"],
                        "name": row["account_name"],
                        "amount": money(row["balance"]),
                    }
                    for row in section["rows"]
                ],
            }
            for section in (
                report["income"], report["expenses"], report["other_expenses"]
            )
        ]
        html = render_report(
            title="Profit & Loss",
            subtitle=f"{report['date_from']} to {report['date_to']}",
            sections=sections,
            footer_rows=[
                {"label": "Total income", "amount": money(report["total_income"])},
                {"label": "Total expenses", "amount": money(report["total_expenses"])},
                {"label": "Net profit", "amount": money(report["net_profit"])},
            ],
        )

    elif name == "balance-sheet":
        report = report_svc.balance_sheet(db, as_of or today)
        sections = [
            {
                "label": section["label"],
                "total": money(section["total"]),
                "rows": [
                    {
                        "code": row["account_code"],
                        "name": row["account_name"],
                        "amount": money(row["balance"]),
                    }
                    for row in section["rows"]
                ],
            }
            for section in (report["assets"], report["liabilities"], report["equity"])
        ]
        html = render_report(
            title="Balance Sheet",
            subtitle=f"As at {report['as_of']}",
            sections=sections,
            footer_rows=[
                {"label": "Total assets", "amount": money(report["total_assets"])},
                {
                    "label": "Total liabilities & equity",
                    "amount": money(report["total_liabilities_and_capital"]),
                },
            ],
            badge=(
                "Assets equal liabilities and capital."
                if report["is_balanced"]
                else "⚠ This balance sheet does not balance."
            ),
        )

    elif name == "trial-balance":
        report = report_svc.trial_balance(db, as_of or today)
        sections = [
            {
                "label": "All accounts",
                "total": money(report["total_debit"]),
                "rows": [
                    {
                        "code": row["account_code"],
                        "name": row["account_name"],
                        "amount": f"{money(row['debit'])} / {money(row['credit'])}",
                    }
                    for row in report["rows"]
                ],
            }
        ]
        html = render_report(
            title="Trial Balance",
            subtitle=f"As at {report['as_of']}",
            sections=sections,
            amount_heading="Debit / Credit",
            footer_rows=[
                {
                    "label": "Totals",
                    "amount": (
                        f"{money(report['total_debit'])} / "
                        f"{money(report['total_credit'])}"
                    ),
                },
                {"label": "Difference", "amount": money(report["difference"])},
            ],
            badge=(
                f"Trial balance {money(report['difference'])} — balanced."
                if report["is_balanced"]
                else f"⚠ Out by {money(report['difference'])}."
            ),
        )

    else:
        raise AppError(
            "NOT_FOUND",
            f"There is no printable report called {name!r}.",
            status_code=404,
        )

    return Response(
        content=html_to_pdf(html),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{name}.pdf"'},
    )


router.include_router(reports_router)
router.include_router(documents_router)
