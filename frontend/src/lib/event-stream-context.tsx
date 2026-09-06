"use client";

/**
 * One real SSE connection per session, shared by every `useEventStream` caller.
 *
 * Before this existed, each of the ~16 call sites of `useEventStream` opened its
 * own `EventSource`. A single page (the dashboard) could hold 6+ of those open
 * at once — enough on its own to exhaust the browser's ~6-connections-per-origin
 * limit, so every ordinary `fetch()` on the page queued behind them and never
 * ran. This provider opens the one connection the app is allowed to keep open,
 * and hands out a pub/sub API so hooks subscribe to event names instead of each
 * managing a socket.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { API_BASE } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

type EventHandler = (data: Record<string, unknown>) => void;

interface EventStreamContextValue {
  connected: boolean;
  subscribe: (eventName: string, handler: EventHandler) => () => void;
}

const EventStreamContext = createContext<EventStreamContextValue | null>(null);

export function EventStreamProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [connected, setConnected] = useState(false);

  // eventName -> handlers currently interested in it. Lives across reconnects.
  const listenersRef = useRef(new Map<string, Set<EventHandler>>());
  const sourceRef = useRef<EventSource | null>(null);
  // Event names that already have a native listener bound to the CURRENT
  // EventSource instance — a new instance needs every name rebound.
  const boundNamesRef = useRef(new Set<string>());

  const bindNativeListener = useCallback((eventName: string) => {
    const source = sourceRef.current;
    if (!source || boundNamesRef.current.has(eventName)) return;
    source.addEventListener(eventName, (event: MessageEvent) => {
      let payload: Record<string, unknown> = {};
      try {
        payload = JSON.parse(event.data);
      } catch {
        /* a malformed frame must not break the stream */
      }
      listenersRef.current.get(eventName)?.forEach((handler) => handler(payload));
    });
    boundNamesRef.current.add(eventName);
  }, []);

  useEffect(() => {
    // `/events` requires a logged-in user, and `EventSource` retries forever on
    // its own, so connecting before auth resolves would hammer the API with 401s.
    // No synchronous setConnected() here: `connected` is ANDed with `!!user`
    // below, so there's nothing to reconcile — a logged-out session just never
    // reads as connected regardless of stale state left by a prior session.
    if (!user) {
      return;
    }

    const source = new EventSource(`${API_BASE}/events`, { withCredentials: true });
    sourceRef.current = source;
    boundNamesRef.current = new Set();

    source.addEventListener("connected", () => setConnected(true));
    source.onerror = () => setConnected(false);

    // Re-bind every event name any subscriber already registered before this
    // connection existed (e.g. a component mounted while the previous one was
    // closing, or this is a reconnect after the session changed).
    listenersRef.current.forEach((_handlers, eventName) => bindNativeListener(eventName));

    return () => {
      source.close();
      if (sourceRef.current === source) sourceRef.current = null;
      setConnected(false);
    };
  }, [user, bindNativeListener]);

  const subscribe = useCallback(
    (eventName: string, handler: EventHandler) => {
      let handlers = listenersRef.current.get(eventName);
      if (!handlers) {
        handlers = new Set();
        listenersRef.current.set(eventName, handlers);
      }
      handlers.add(handler);
      bindNativeListener(eventName);

      return () => {
        handlers?.delete(handler);
      };
    },
    [bindNativeListener],
  );

  return (
    <EventStreamContext.Provider value={{ connected: connected && !!user, subscribe }}>
      {children}
    </EventStreamContext.Provider>
  );
}

export function useEventStreamContext(): EventStreamContextValue {
  const context = useContext(EventStreamContext);
  if (!context) {
    throw new Error("useEventStreamContext must be used inside <EventStreamProvider>");
  }
  return context;
}
