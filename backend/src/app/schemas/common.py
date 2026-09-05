"""Shared response shapes."""

from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict

T = TypeVar("T")


class ORMModel(BaseModel):
    """Base for any schema built from a SQLAlchemy row."""

    model_config = ConfigDict(from_attributes=True)


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
