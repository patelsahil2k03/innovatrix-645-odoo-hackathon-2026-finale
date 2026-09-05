"""Reusable pagination + sorting + search for any list endpoint.

Sortable and searchable columns are ALLOWLISTED per endpoint — a user cannot sort by
an arbitrary string, so there is no SQL injection surface here.
"""

from dataclasses import dataclass
from math import ceil
from typing import Any

from fastapi import Query
from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import InstrumentedAttribute, Session


@dataclass(frozen=True)
class PageParams:
    page: int
    page_size: int
    sort: str | None
    q: str | None


def page_params(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    sort: str | None = Query(None, description="field or -field for descending"),
    q: str | None = Query(None, description="free-text search"),
) -> PageParams:
    return PageParams(page=page, page_size=page_size, sort=sort, q=q)


def paginate(
    db: Session,
    stmt: Select,
    params: PageParams,
    *,
    sortable: dict[str, InstrumentedAttribute],
    searchable: list[InstrumentedAttribute] | None = None,
    default_sort: str | None = None,
) -> dict[str, Any]:
    """Apply search + sort + limit/offset and return the standard page envelope.

    Returns {items, total, page, page_size, pages}. `total` is the count of ALL
    matching rows, not just this page — the frontend must use it for any "total"
    KPI. (Using items.length there is a real bug we shipped last round.)
    """
    if params.q and searchable:
        needle = f"%{params.q.strip()}%"
        stmt = stmt.where(or_(*[col.ilike(needle) for col in searchable]))

    total = db.execute(
        select(func.count()).select_from(stmt.order_by(None).subquery())
    ).scalar_one()

    sort_key = params.sort or default_sort
    if sort_key:
        descending = sort_key.startswith("-")
        column = sortable.get(sort_key.lstrip("-"))
        if column is not None:
            stmt = stmt.order_by(column.desc() if descending else column.asc())

    rows = db.execute(
        stmt.offset((params.page - 1) * params.page_size).limit(params.page_size)
    ).scalars().all()

    return {
        "items": rows,
        "total": total,
        "page": params.page,
        "page_size": params.page_size,
        "pages": ceil(total / params.page_size) if params.page_size else 0,
    }
