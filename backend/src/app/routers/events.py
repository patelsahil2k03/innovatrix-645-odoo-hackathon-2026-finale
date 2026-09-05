"""Server-Sent Events stream — the 'dynamic data, not static JSON' proof.

NOTE ON sse-starlette 3.x: the library owns heartbeats (via `ping=`) and owns
disconnect detection — it cancels this generator when the client goes away. Do not
hand-roll a heartbeat loop here; in 2.x that was common, in 3.x it fights the library
and the stream never closes cleanly.
"""

import json
from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends
from sse_starlette.sse import EventSourceResponse

from app.core.events import hub
from app.core.rbac import get_current_user
from app.models.auth import User

router = APIRouter(tags=["events"])

HEARTBEAT_SECONDS = 15


@router.get("/events")
async def stream(_: User = Depends(get_current_user)) -> EventSourceResponse:
    """Subscribe once from the frontend (`useEventStream`); every screen benefits."""

    async def generator() -> AsyncIterator[dict]:
        queue = hub.subscribe()
        try:
            yield {"event": "connected", "data": json.dumps({"ok": True})}
            while True:
                payload = await queue.get()
                yield {
                    "event": payload["event"],
                    "data": json.dumps(payload["data"], default=str),
                }
        finally:
            # Runs when sse-starlette cancels us on client disconnect.
            hub.unsubscribe(queue)

    return EventSourceResponse(
        generator(),
        ping=HEARTBEAT_SECONDS,
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
