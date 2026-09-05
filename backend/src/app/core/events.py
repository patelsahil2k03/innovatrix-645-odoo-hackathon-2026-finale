"""In-process pub/sub powering Server-Sent Events.

No Redis, no broker, nothing to install — which also means it works with no internet,
exactly as the organizers ask for ("plan for offline or local solutions").

Publish AFTER the transaction commits. Publishing before means a listener can be told
about a change that then gets rolled back.
"""

import asyncio
import logging
from typing import Any

logger = logging.getLogger(__name__)

# If a subscriber stops reading, drop its events rather than blocking the publisher.
_QUEUE_MAXSIZE = 64


class EventHub:
    def __init__(self) -> None:
        self._subscribers: set[asyncio.Queue] = set()
        self._loop: asyncio.AbstractEventLoop | None = None

    def bind_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        """Called once from the app lifespan so off-loop callers can publish safely."""
        self._loop = loop

    def subscribe(self) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue(maxsize=_QUEUE_MAXSIZE)
        self._subscribers.add(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue) -> None:
        self._subscribers.discard(queue)

    @property
    def subscriber_count(self) -> int:
        return len(self._subscribers)

    def publish(self, event: str, data: dict[str, Any] | None = None) -> None:
        """Fire-and-forget. Safe to call from a sync endpoint running in the
        threadpool as well as from async code."""
        payload = {"event": event, "data": data or {}}
        try:
            running = asyncio.get_running_loop()
        except RuntimeError:
            running = None

        if running is not None:
            self._fanout(payload)
        elif self._loop is not None:
            self._loop.call_soon_threadsafe(self._fanout, payload)
        else:
            logger.debug("Event %s dropped: no event loop bound yet", event)

    def _fanout(self, payload: dict[str, Any]) -> None:
        for queue in list(self._subscribers):
            try:
                queue.put_nowait(payload)
            except asyncio.QueueFull:
                # Slow or dead consumer — drop rather than stall every publisher.
                logger.debug("Dropping event for a full subscriber queue")


hub = EventHub()
