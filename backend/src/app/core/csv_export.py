"""Streaming CSV export.

Most Odoo-style problem statements ask for CSV export somewhere. Streaming means a
large report never materialises fully in memory.
"""

import csv
import io
from collections.abc import Iterable, Iterator
from typing import Any

from fastapi.responses import StreamingResponse


def csv_response(
    filename: str,
    headers: list[str],
    rows: Iterable[Iterable[Any]],
) -> StreamingResponse:
    def generate() -> Iterator[str]:
        buffer = io.StringIO()
        writer = csv.writer(buffer)

        writer.writerow(headers)
        yield buffer.getvalue()
        buffer.seek(0)
        buffer.truncate(0)

        for row in rows:
            writer.writerow(list(row))
            yield buffer.getvalue()
            buffer.seek(0)
            buffer.truncate(0)

    return StreamingResponse(
        generate(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
