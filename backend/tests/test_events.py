"""Event-hub tests.

The hub is our code, so it gets real unit tests. The HTTP stream itself is NOT
tested in-process: `EventSourceResponse` (sse-starlette 3.x) uses anyio task groups
that neither starlette's `TestClient` (background-thread portal) nor
`httpx.ASGITransport` (buffers the whole body) can drive — both hang on an endpoint
that never finishes.

That's a test-harness limit, not a broken endpoint. Verified against real uvicorn:

    event: connected
    data: {"ok": true}

    event: kpi.refresh          ← simulator, every 2s
    data: {"source": "simulator"}

Re-verify any time you touch the events router:  ./scripts/verify-sse.sh
"""

import asyncio

from app.core.events import EventHub


def test_events_requires_authentication(client):
    """Non-streaming path: the dependency rejects before the stream starts, so this
    returns immediately and is safe to assert in-process."""
    response = client.get("/api/v1/events")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


def test_hub_delivers_a_published_event_to_a_subscriber():
    async def scenario():
        hub = EventHub()
        hub.bind_loop(asyncio.get_running_loop())
        queue = hub.subscribe()
        hub.publish("thing.created", {"id": "abc"})
        return await asyncio.wait_for(queue.get(), timeout=2)

    payload = asyncio.run(scenario())
    assert payload["event"] == "thing.created"
    assert payload["data"]["id"] == "abc"


def test_every_subscriber_receives_the_same_event():
    """Two browser tabs open on the dashboard must both update."""

    async def scenario():
        hub = EventHub()
        hub.bind_loop(asyncio.get_running_loop())
        a, b = hub.subscribe(), hub.subscribe()
        hub.publish("kpi.refresh", {"n": 1})
        return (
            await asyncio.wait_for(a.get(), timeout=2),
            await asyncio.wait_for(b.get(), timeout=2),
        )

    first, second = asyncio.run(scenario())
    assert first["event"] == second["event"] == "kpi.refresh"


def test_hub_drops_events_for_a_full_queue_instead_of_blocking():
    """A stalled browser tab must never freeze the API for everyone else.

    Publishing far past the queue bound must return promptly rather than deadlock
    the publisher.
    """

    async def scenario():
        hub = EventHub()
        hub.bind_loop(asyncio.get_running_loop())
        hub.subscribe()  # deliberately never drained
        for i in range(500):
            hub.publish("spam", {"i": i})
        return True

    assert asyncio.run(scenario()) is True


def test_unsubscribe_removes_the_subscriber():
    async def scenario():
        hub = EventHub()
        hub.bind_loop(asyncio.get_running_loop())
        queue = hub.subscribe()
        assert hub.subscriber_count == 1
        hub.unsubscribe(queue)
        return hub.subscriber_count

    assert asyncio.run(scenario()) == 0


def test_publish_without_a_bound_loop_is_a_noop_not_a_crash():
    """During startup, or from a plain script, there may be no loop yet. Publishing
    must degrade quietly rather than take the caller down with it."""
    hub = EventHub()
    hub.publish("too.early", {"x": 1})  # must not raise
