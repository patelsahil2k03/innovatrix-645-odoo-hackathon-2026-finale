"""Money arithmetic — the single implementation of the per-line tax rule.

docs/03_DATA_MODEL.md §6 is explicit about the method, and about why it matters:

    Tax is computed per line, rounded per line, then summed.
        line_tax = round(untaxed * tax_pct / 100, 2)
        document.tax_total = sum(line_tax)

Computing tax once on the document subtotal instead can round to a different
total by a paisa when lines carry different rates. Both methods are defensible;
what is not defensible is using one in the totals recompute and the other in the
response schema, so every caller in the codebase goes through `line_amounts`.

`ROUND_HALF_UP` rather than Python's default banker's rounding: an invoice that
rounds 0.125 to 0.12 is arithmetic a customer will dispute, whatever IEEE says.
"""

from decimal import ROUND_HALF_UP, Decimal

CENTS = Decimal("0.01")


def q2(value: Decimal) -> Decimal:
    """Quantise to two decimal places, half-up."""
    return Decimal(value).quantize(CENTS, rounding=ROUND_HALF_UP)


def line_amounts(
    quantity: Decimal, unit_price: Decimal, tax_pct: Decimal
) -> tuple[Decimal, Decimal, Decimal]:
    """Return `(untaxed, tax, total)` for one document line, each rounded to 2dp.

    The untaxed figure is rounded before tax is applied to it, so the tax shown
    on screen is always exactly `untaxed * rate` for the number the reader can
    see — not for an unrounded value behind it.
    """
    untaxed = q2(Decimal(quantity) * Decimal(unit_price))
    tax = q2(untaxed * Decimal(tax_pct) / Decimal(100))
    return untaxed, tax, untaxed + tax


def document_totals(lines) -> tuple[Decimal, Decimal, Decimal]:
    """Sum `line_amounts` across a document's lines.

    Accepts anything with `quantity`, `unit_price` and `tax_pct` attributes —
    an ORM line row or an inbound schema, so the same function serves both the
    "what will this cost" preview and the stored totals.
    """
    untaxed_total = Decimal("0.00")
    tax_total = Decimal("0.00")
    for line in lines:
        untaxed, tax, _ = line_amounts(line.quantity, line.unit_price, line.tax_pct)
        untaxed_total += untaxed
        tax_total += tax
    return untaxed_total, tax_total, untaxed_total + tax_total
