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
from app.routers import audit_logs, auth, domain, events, health, notifications

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

settings = get_settings()

DESCRIPTION = """
Hackathon boilerplate API.

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

    # ★ REGISTER YOUR DOMAIN ROUTERS HERE ★
    app.include_router(domain.router, prefix=prefix)

    return app


app = create_app()
