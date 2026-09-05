"""Application factory.

Run:  uv run uvicorn app.main:app --reload
Docs: http://localhost:8000/docs
"""

import asyncio
import contextlib
import logging
from collections.abc import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.audit import AuditMiddleware
from app.core.errors import install_error_handlers
from app.core.events import hub
from app.core.settings import get_settings
from app.routers import (
    analytics,
    audit_logs,
    auth,
    budgets,
    events,
    health,
    ledger,
    masters,
    notifications,
    output,
    payments,
    portal,
    purchases,
    reports,
    sales,
)

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

settings = get_settings()

DESCRIPTION = """
Urban Furniture — Accounting System API.

**The spine is the journal entry.** Every posted document writes exactly one
balanced entry, and every report aggregates `journal_lines` rather than summing
documents. `GET /reports/trial-balance` proves it: `difference` is always 0.00.

* **Auth** — JWT in an httpOnly cookie. Use `POST /auth/token` + the Authorize button
  to try protected endpoints from this page.
* **Errors** — every failure returns `{"error": {"code", "message", "fields"}}`.
* **Lists** — every list endpoint supports `page`, `page_size`, `sort`, `q`.
* **Real-time** — `GET /events` is a Server-Sent Events stream.
"""


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    # Bind the running loop so code in the threadpool can publish events safely.
    hub.bind_loop(asyncio.get_running_loop())

    task: asyncio.Task | None = None
    if settings.simulator_enabled:
        from app.services.simulator import run_simulator

        task = asyncio.create_task(run_simulator())

    yield

    if task is not None:
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description=DESCRIPTION,
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_origin_regex=r"https?://.*",
        allow_credentials=True,  # required for the auth cookie to be sent
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(AuditMiddleware)

    install_error_handlers(app)

    prefix = settings.api_prefix
    app.include_router(health.router, prefix=prefix)
    app.include_router(auth.router, prefix=prefix)
    app.include_router(events.router, prefix=prefix)
    app.include_router(notifications.router, prefix=prefix)
    app.include_router(audit_logs.router, prefix=prefix)

    # ── Urban Furniture: the accounting domain ────────────────────────────
    # Registered in the order the system is built (06_BACKEND.md §1): master
    # data, then the two document chains, then payments, then everything that
    # only reads — the ledger and the reports that aggregate it.
    app.include_router(masters.router, prefix=prefix)
    app.include_router(sales.router, prefix=prefix)
    app.include_router(purchases.router, prefix=prefix)
    app.include_router(payments.router, prefix=prefix)
    app.include_router(budgets.router, prefix=prefix)
    app.include_router(ledger.router, prefix=prefix)
    app.include_router(reports.router, prefix=prefix)
    # Same ledger as reports, reshaped for the charts screen.
    app.include_router(analytics.router, prefix=prefix)
    app.include_router(portal.router, prefix=prefix)
    # Print / PDF / Send. Last, because its document routes are deliberately
    # generic and must not shadow anything more specific above them.
    app.include_router(output.router, prefix=prefix)

    return app


app = create_app()
