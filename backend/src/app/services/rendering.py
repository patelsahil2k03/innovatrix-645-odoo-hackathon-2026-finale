"""HTML and PDF rendering for documents and reports (04_API_CONTRACT.md §3.5).

**One template, two outputs.** The print view and the PDF render the same Jinja
file, so the layout a user prints from the browser and the layout they download
cannot drift apart — the reason 01_STACK.md §3 chose an HTML-based PDF engine
over a drawing API in the first place.

⚠️ **Deviation from 01_STACK.md §3, and why.** That table names WeasyPrint, and
WeasyPrint does not work on this project's Windows machines: it binds to GTK
(`libgobject-2.0-0`, Pango, cairo), a separate native install that is not
present, and it fails at call time rather than at import — so the endpoint looks
fine until someone clicks Download. `xhtml2pdf` is used instead: pure Python,
no native dependencies, installs with `uv sync` like everything else.

WeasyPrint is **not** in `pyproject.toml`, because leaving it there means a
multi-line troubleshooting banner on stderr for every PDF request on a machine
that cannot use it. The `_weasyprint_pdf` branch below is still tried first, so
a deployment that does install it (a Linux box, or Windows plus the GTK runtime)
silently gets the better renderer with no code change. Both engines read the one
shared template, so neither gets a layout of its own to maintain.
"""

import io
import logging
from decimal import Decimal
from functools import lru_cache
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, StrictUndefined, select_autoescape

from app.core.errors import AppError
from app.models.base import utc_now
from app.services.money import line_amounts, q2

logger = logging.getLogger(__name__)

TEMPLATE_ROOT = Path(__file__).resolve().parent.parent / "templates"

_env = Environment(
    loader=FileSystemLoader(str(TEMPLATE_ROOT)),
    autoescape=select_autoescape(["html"]),
    # A typo in a template name should fail loudly at render time, not render a
    # document with a silently blank total on it.
    undefined=StrictUndefined,
    trim_blocks=True,
    lstrip_blocks=True,
)

COMPANY_NAME = "Urban Furniture"


def money(value) -> str:
    """Indian digit grouping — 12,34,567.89, not 1,234,567.89.

    Every figure on a printed document goes through this, so the PDF matches
    what the rest of the product shows rather than defaulting to a US grouping
    on the one artefact a customer keeps.
    """
    amount = q2(Decimal(value or 0))
    negative = amount < 0
    whole, _, fraction = f"{abs(amount):.2f}".partition(".")

    if len(whole) > 3:
        head, tail = whole[:-3], whole[-3:]
        groups = []
        while len(head) > 2:
            groups.insert(0, head[-2:])
            head = head[:-2]
        if head:
            groups.insert(0, head)
        whole = ",".join([*groups, tail])

    return f"{'-' if negative else ''}{whole}.{fraction}"


def render_document(doc, contact, *, kind: str) -> str:
    """Render an invoice or a bill to standalone HTML."""
    is_invoice = kind == "customer_invoice"
    lines = [
        {
            "name": line.product.name if line.product else "Item",
            "quantity": f"{Decimal(line.quantity):g}",
            "unit_price": money(line.unit_price),
            "tax_pct": f"{Decimal(line.tax_pct):g}",
            "untaxed": money(
                line_amounts(line.quantity, line.unit_price, line.tax_pct)[0]
            ),
        }
        for line in doc.lines
    ]

    due = Decimal(doc.total) - Decimal(doc.amount_paid)
    return _env.get_template("documents/document.html").render(
        doc=doc,
        title="Customer Invoice" if is_invoice else "Vendor Bill",
        party_label="Billed to" if is_invoice else "Billed by",
        company_name=COMPANY_NAME,
        contact=contact,
        doc_date=doc.invoice_date if is_invoice else doc.bill_date,
        lines=lines,
        totals={
            "untaxed": money(doc.untaxed_total),
            "tax": money(doc.tax_total),
            "total": money(doc.total),
            "paid": money(doc.amount_paid),
            "due": money(due),
        },
        generated_at=utc_now().strftime("%Y-%m-%d %H:%M UTC"),
    )


def render_report(
    *,
    title: str,
    subtitle: str,
    sections: list[dict],
    footer_rows: list[dict],
    amount_heading: str = "Amount",
    badge: str | None = None,
) -> str:
    return _env.get_template("reports/report.html").render(
        title=title,
        subtitle=subtitle,
        sections=sections,
        footer_rows=footer_rows,
        amount_heading=amount_heading,
        badge=badge,
        company_name=COMPANY_NAME,
        generated_at=utc_now().strftime("%Y-%m-%d %H:%M UTC"),
    )


@lru_cache(maxsize=1)
def _weasyprint() -> object | None:
    """Probe for WeasyPrint once per process, not once per request.

    Cached because the failure is expensive and loud: on a machine without GTK,
    importing WeasyPrint writes a multi-line troubleshooting banner to stderr.
    Doing that on every PDF download would bury the real logs.
    """
    try:
        from weasyprint import HTML
    except (ImportError, OSError) as exc:
        # OSError as well as ImportError: WeasyPrint can import successfully and
        # then fail loading libgobject, which is exactly what Windows does.
        logger.info("WeasyPrint not available (%s); using xhtml2pdf", type(exc).__name__)
        return None
    return HTML


def _weasyprint_pdf(html: str) -> bytes | None:
    """Preferred engine wherever its native libraries are installed."""
    engine = _weasyprint()
    if engine is None:
        return None
    try:
        return engine(string=html).write_pdf()
    except OSError as exc:
        logger.warning("WeasyPrint failed to render (%s); falling back", exc)
        return None


def _xhtml2pdf_pdf(html: str) -> bytes | None:
    """Pure-Python fallback. No native dependencies, works anywhere."""
    try:
        from xhtml2pdf import pisa
    except ImportError:
        return None

    buffer = io.BytesIO()
    result = pisa.CreatePDF(src=html, dest=buffer, encoding="utf-8")
    if result.err:
        logger.warning("xhtml2pdf reported %s error(s) rendering a PDF", result.err)
        return None
    return buffer.getvalue()


def html_to_pdf(html: str) -> bytes:
    """Render HTML to PDF with whichever engine this machine actually has."""
    for engine in (_weasyprint_pdf, _xhtml2pdf_pdf):
        pdf = engine(html)
        if pdf:
            return pdf

    raise AppError(
        "PDF_ENGINE_UNAVAILABLE",
        "No PDF engine is available on this server. Run `uv sync` to install "
        "xhtml2pdf. The print view works without either engine.",
        status_code=503,
    )
