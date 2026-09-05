"""Sending a document by email — best-effort, and contained on purpose.

01_STACK.md §3.2 calls this "the one thing that can fail on the day", and every
decision here follows from that:

- **The document is already posted** before mail is attempted. A delivery failure
  records itself on the document and returns normally; it never raises, never
  rolls back, and never turns a successful posting into a failed request.
- **With `SMTP_HOST` unset the feature refuses explicitly** with
  `MAIL_NOT_CONFIGURED` rather than pretending to have sent something. A silent
  no-op is the one behaviour that would let the UI lie.
- **The outcome is stored**, so `last_sent_at` / `last_send_error` let the UI say
  *sent* or *not sent* honestly instead of optimistically.
"""

import logging
import smtplib
from email.message import EmailMessage

from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.core.settings import get_settings
from app.models.base import utc_now
from app.services.rendering import html_to_pdf, render_document

logger = logging.getLogger(__name__)
settings = get_settings()


def _build_message(doc, contact, kind: str, to: str, html: str) -> EmailMessage:
    label = "Invoice" if kind == "customer_invoice" else "Bill"
    message = EmailMessage()
    message["Subject"] = f"{label} {doc.number} from Urban Furniture"
    message["From"] = settings.mail_from
    message["To"] = to
    message.set_content(
        f"Dear {contact.name},\n\n"
        f"Please find {label.lower()} {doc.number} attached, "
        f"for a total of {doc.total}.\n\n"
        "Regards,\nUrban Furniture"
    )
    message.add_alternative(html, subtype="html")

    try:
        message.add_attachment(
            html_to_pdf(html),
            maintype="application",
            subtype="pdf",
            filename=f"{doc.number.replace('/', '-')}.pdf",
        )
    except AppError:
        # No PDF engine on this machine. The HTML body still carries the whole
        # document, so send it rather than failing the send outright.
        logger.info("Sending %s without a PDF attachment: no engine available",
                    doc.number)
    return message


def send_document(db: Session, doc, contact, *, kind: str, to: str | None = None) -> dict:
    """Mail a document. Returns `{queued, to, error}`; never raises on delivery."""
    recipient = (to or contact.email or "").strip()
    if not recipient:
        raise AppError(
            "VALIDATION_ERROR",
            f"{contact.name} has no email address to send to.",
            fields={"to": "Add an email address to this contact first."},
        )

    if not settings.smtp_host:
        raise AppError(
            "MAIL_NOT_CONFIGURED",
            "Email is not configured on this server. Set SMTP_HOST to enable "
            "sending — the document can still be printed and downloaded.",
        )

    html = render_document(doc, contact, kind=kind)
    message = _build_message(doc, contact, kind, recipient, html)

    error: str | None = None
    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
            smtp.ehlo()
            if smtp.has_extn("starttls"):
                smtp.starttls()
                smtp.ehlo()
            if settings.smtp_user and settings.smtp_password:
                smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.send_message(message)
    except Exception as exc:  # noqa: BLE001 — mail must never escalate
        # Deliberately broad. smtplib raises a dozen unrelated exception types
        # and the network adds more; every one of them means the same thing here
        # (it did not send) and none of them may reach the client as a 500 for
        # an operation whose real work — posting — already succeeded.
        error = str(exc)[:200]
        logger.warning("Mail send failed for %s: %s", doc.number, exc)

    doc.last_send_error = error
    if error is None:
        doc.last_sent_at = utc_now()
    db.commit()

    return {"queued": error is None, "to": recipient, "error": error}
