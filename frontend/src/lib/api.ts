/**
 * Typed API client.
 *
 * The auth token lives in an httpOnly cookie the browser sends automatically —
 * this file never touches a token, which is why an XSS bug can't steal the session.
 * That's also why every request sets `credentials: "include"`.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

/** The server's error envelope: {error: {code, message, fields}} */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly fields: Record<string, string>;

  constructor(status: number, code: string, message: string, fields: Record<string, string> = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export interface Page<T> {
  items: T[];
  /** Count of ALL matching rows. Use THIS for "total X" tiles — never items.length,
   *  which is only the current page. (Real bug from the last hackathon.) */
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface ListParams {
  page?: number;
  page_size?: number;
  sort?: string;
  q?: string;
  [key: string]: string | number | boolean | undefined;
}

function buildQuery(params: ListParams = {}): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
  } catch {
    // Network-level failure: the API isn't running, or CORS blocked it. Say so
    // plainly — a bare "Failed to fetch" in a toast tells the user nothing.
    throw new ApiError(0, "NETWORK_ERROR", "Cannot reach the server. Is the API running?");
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const body = text ? safeJson(text) : null;

  if (!response.ok) {
    const envelope = (body?.error ?? {}) as {
      code?: string;
      message?: string;
      fields?: Record<string, string>;
    };
    throw new ApiError(
      response.status,
      envelope.code ?? "UNKNOWN_ERROR",
      envelope.message ?? `Request failed (${response.status})`,
      envelope.fields ?? {},
    );
  }

  return body as T;
}

/** Parse a body that may not be JSON (a proxy error page, an empty response). */
function safeJson(text: string): Record<string, unknown> | null {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

const get = <T,>(path: string, params?: ListParams) => apiFetch<T>(path + buildQuery(params));
const post = <T,>(path: string, body?: unknown) =>
  apiFetch<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined });
const patch = <T,>(path: string, body: unknown) =>
  apiFetch<T>(path, { method: "PATCH", body: JSON.stringify(body) });
const del = <T,>(path: string) => apiFetch<T>(path, { method: "DELETE" });

/* ── Types ──────────────────────────────────────────────────────────────── */

export interface Role {
  id: string;
  name: string;
  description: string | null;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  role: Role;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

/* ── The client ─────────────────────────────────────────────────────────── */

export const api = {
  health: () => get<{ status: string; database: string; version: string }>("/health"),

  auth: {
    login: (email: string, password: string) => post<User>("/auth/login", { email, password }),
    logout: () => post<{ ok: boolean }>("/auth/logout"),
    me: () => get<User>("/auth/me"),
  },

  notifications: {
    list: (params?: ListParams) => get<Page<Notification>>("/notifications", params),
    markAllRead: () => post<{ marked_read: number }>("/notifications/read-all"),
  },

  auditLogs: {
    list: (params?: ListParams) => get<Page<Record<string, unknown>>>("/audit-logs", params),
  },

  // ★ ADD YOUR DOMAIN RESOURCES HERE — mirror the shape above, e.g.:
  //
  // orders: {
  //   list:   (params?: ListParams) => get<Page<Order>>("/orders", params),
  //   get:    (id: string)          => get<Order>(`/orders/${id}`),
  //   create: (body: OrderCreate)   => post<Order>("/orders", body),
  //   update: (id: string, body: Partial<OrderCreate>) => patch<Order>(`/orders/${id}`, body),
  //   remove: (id: string)          => del<void>(`/orders/${id}`),
  //   activate: (id: string)        => post<Order>(`/orders/${id}/activate`),
  // },
};

export { get, post, patch, del, buildQuery, API_BASE };
