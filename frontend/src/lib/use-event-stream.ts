"use client";

import { useEffect, useRef, useState } from "react";

import { API_BASE } from "@/lib/api";

type EventHandler = (data: Record<string, unknown>) => void;

/**
 * One SSE connection per browser tab, shared by every `useEventStream` call.
 *
 * The dashboard alone has four independent subscribers — KPIs, status counts,
 * the analytics charts and the page itself — and each used to open its OWN
 * `EventSource`. A connection like that never closes on its own, so one
 * dashboard load held four permanent sockets against this origin. Chrome caps
 * concurrent connections per origin at 6 (HTTP/1.1, which is what the dev
 * server speaks), so four of those six slots were gone for the life of the
 * tab. Every ordinary fetch — trend, ageing, top contacts, the page's own
 * recent-entries query — then queued for whatever was left, behind
 * connections that never free up. That is what made requests read as hanging
 * for over a minute on a fresh load: the response was never slow to compute
 * (7–13ms measured straight against the API); there was no socket free to
 * carry it.
 *
 * Now there is exactly one EventSource per tab, ref-counted across every
 * caller and reused as components mount and unmount, rather than reopened.
 */

interface Bus {
  source: EventSource;
  refCount: number;
  /** event name -> the handlers currently interested in it. */
  handlersByEvent: Map<string, Set<EventHandler>>;
  /** event names the shared source already has a listener bound for. */
  boundEvents: Set<string>;
  connectedListeners: Set<(connected: boolean) => void>;
}

let bus: Bus | null = null;

function ensureBus(): Bus {
  if (bus) return bus;

  const source = new EventSource(`${API_BASE}/events`, { withCredentials: true });
  const created: Bus = {
    source,
    refCount: 0,
    handlersByEvent: new Map(),
    boundEvents: new Set(),
    connectedListeners: new Set(),
  };

  source.addEventListener("connected", () => {
    created.connectedListeners.forEach((notify) => notify(true));
  });
  source.onerror = () => {
    created.connectedListeners.forEach((notify) => notify(false));
  };

  bus = created;
  return created;
}

/** Bind the shared source to a named SSE event exactly once, ever, for as
 *  long as this bus lives — every current and future subscriber's handler
 *  for that name is looked up at dispatch time, not at bind time. */
function bindEvent(activeBus: Bus, eventName: string) {
  if (activeBus.boundEvents.has(eventName)) return;
  activeBus.boundEvents.add(eventName);
  activeBus.source.addEventListener(eventName, (event: MessageEvent) => {
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(event.data);
    } catch {
      /* a malformed frame must not break the stream */
    }
    activeBus.handlersByEvent.get(eventName)?.forEach((handler) => handler(payload));
  });
}

function releaseBus() {
  if (!bus) return;
  bus.refCount -= 1;
  if (bus.refCount <= 0) {
    bus.source.close();
    bus = null;
  }
}

/**
 *   const live = useEventStream({
 *     "kpi.refresh":    () => reload(),
 *     "order.activated": (data) => console.log(data.id),
 *   });
 *
 * Returns whether the stream is currently connected, for a "live" indicator.
 *
 * `enabled` gates participation — pass `false` while the session is still
 * loading or unauthenticated. `/events` requires a logged-in user, and an
 * ungated call from `AppShell` would open the shared connection with 401s
 * from the moment any page mounts, before the auth check has even resolved.
 */
export function useEventStream(
  handlers: Record<string, EventHandler>,
  enabled = true,
): boolean {
  // Lazy initializer rather than a setState call inside the effect below: a
  // subscriber that mounts after the shared connection is already open must
  // start out reporting "connected" too, and computing that during the
  // initial render is the documented pattern — the alternative was flagged
  // outright by react-hooks/set-state-in-effect.
  const [connected, setConnected] = useState(
    () => bus?.source.readyState === EventSource.OPEN,
  );

  // Keep handlers in a ref so re-renders don't tear down the subscription.
  // Writing a ref during render is not allowed, so update it in an effect.
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  // Dependency values must be simple expressions, so derive the key first.
  const eventNames = Object.keys(handlers).sort().join(",");

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const activeBus = ensureBus();
    activeBus.refCount += 1;
    activeBus.connectedListeners.add(setConnected);

    const registered = eventNames ? eventNames.split(",") : [];
    const subscriptions = registered.map((eventName) => {
      bindEvent(activeBus, eventName);
      const wrapped: EventHandler = (payload) => handlersRef.current[eventName]?.(payload);
      let set = activeBus.handlersByEvent.get(eventName);
      if (!set) {
        set = new Set();
        activeBus.handlersByEvent.set(eventName, set);
      }
      set.add(wrapped);
      return { eventName, wrapped };
    });

    return () => {
      subscriptions.forEach(({ eventName, wrapped }) =>
        activeBus.handlersByEvent.get(eventName)?.delete(wrapped),
      );
      activeBus.connectedListeners.delete(setConnected);
      releaseBus();
    };
    // Re-subscribe if the SET of event names changes, or once `enabled` flips true.
  }, [eventNames, enabled]);

  // Gated rather than reset inside the effect: writing state from an effect body
  // costs a second render pass, and while disabled there is no stream to be
  // connected to regardless of what the last run left behind.
  return enabled && connected;
}
