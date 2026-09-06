/**
 * SSE passthrough to this machine's backend.
 *
 * Exists because `next.config.ts`'s `/api/*` rewrite buffers streaming
 * responses: through it, a frame the backend emits immediately never arrives,
 * while the same request straight to the backend delivers it in 0.00s. A route
 * handler can hand back the upstream stream untouched, so `/events` stays on
 * the page's own origin like every other call — which keeps the session cookie
 * first-party, the thing that breaks live updates across routed subnets.
 *
 * A filesystem route wins over a config rewrite, so this shadows the catch-all
 * for this one path without any change to the rewrite itself.
 */

const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN ?? "http://127.0.0.1:8000";

// Never prerender or cache: this is an open connection, not a document.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET(request: Request): Promise<Response> {
  const upstream = await fetch(`${BACKEND_ORIGIN}/api/v1/events`, {
    headers: {
      // The auth cookie is httpOnly, so it only exists on this request. Forward
      // it or the backend correctly rejects the stream as unauthenticated.
      cookie: request.headers.get("cookie") ?? "",
      accept: "text/event-stream",
    },
    // Propagates the browser closing the tab through to the backend, so
    // sse-starlette cancels the generator and drops its subscriber.
    signal: request.signal,
    cache: "no-store",
  });

  if (!upstream.ok || upstream.body === null) {
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
    });
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": "text/event-stream",
      // `no-transform` and X-Accel-Buffering stop any proxy in front of this
      // from doing the very buffering this file exists to avoid.
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      Connection: "keep-alive",
    },
  });
}
