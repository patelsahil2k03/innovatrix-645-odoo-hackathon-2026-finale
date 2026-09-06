"""Shared response shapes."""

from decimal import Decimal
from typing import Annotated, Generic, TypeVar

from pydantic import BaseModel, ConfigDict, PlainSerializer

Money = Annotated[
    Decimal,
    PlainSerializer(float, return_type=float, when_used="json"),
]
"""Money crosses the wire as a JSON number, not a quoted string.

Pydantic v2 serialises `Decimal` to a string by default, which would make every
amount in every response `"11800.00"` instead of `11800.00` — the API contract
(§3.6, §3.8) shows bare numbers, and the frontend does arithmetic on them.
`Decimal` is still what arrives and what the service layer computes with, so no
rounding is done in floating point; the conversion happens only on the way out.
"""

T = TypeVar("T")


class ORMModel(BaseModel):
    """Base for any schema built from a SQLAlchemy row.

    `populate_by_name` so a field that reads a nested relationship through an
    `AliasPath` (e.g. `product_name` <- `line.product.name`) can still be set by
    its own name when a schema is built by hand rather than from a row.
    """

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class Page(BaseModel, Generic[T]):
    """The list envelope every paginated endpoint returns.

    `total` is the count of ALL matching rows. The frontend must use it for any
    "total X" tile — using len(items) silently under-reports past one page.
    """

    items: list[T]
    total: int
    page: int
    page_size: int
    pages: int


class Message(BaseModel):
    ok: bool = True
    message: str | None = None
