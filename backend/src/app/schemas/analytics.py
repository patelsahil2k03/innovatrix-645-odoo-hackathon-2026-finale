"""Analytics response shapes.

Response-only, like `schemas/reports.py` — there is nothing to write here.

Every series is returned in the order it should be drawn, and money uses the
same `Money` type as the reports so a chart and a report can never disagree
about rounding.
"""

from datetime import date

from pydantic import BaseModel

from app.schemas.common import Money


class TrendPoint(BaseModel):
    """One month on the trend series.

    `label` is server-rendered rather than formatted in the browser: the axis
    ticks then match the tooltip and the CSV export exactly, instead of three
    separate pieces of code agreeing by coincidence.
    """

    month: date
    label: str
    income: Money
    expense: Money
    net_profit: Money


class TrendOut(BaseModel):
    points: list[TrendPoint]
    total_income: Money
    total_expense: Money
    total_net_profit: Money


class BreakdownSlice(BaseModel):
    id: str
    label: str
    type: str
    amount: Money


class BreakdownOut(BaseModel):
    slices: list[BreakdownSlice]


class RankedRow(BaseModel):
    id: str
    label: str
    amount: Money


class TopContactsOut(BaseModel):
    direction: str
    rows: list[RankedRow]


class AgeingBucket(BaseModel):
    bucket: str
    amount: Money


class AgeingOut(BaseModel):
    as_of: date
    receivables: list[AgeingBucket]
    payables: list[AgeingBucket]
