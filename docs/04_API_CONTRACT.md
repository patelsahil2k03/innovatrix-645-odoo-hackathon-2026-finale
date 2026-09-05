# 04 — API CONTRACT

> **This is the coordination surface between frontend and backend.**
> **Rule: this document changes BEFORE the code does, never after.** If you change an endpoint
> without editing this file first, you have broken the other half of the team without telling them.

---

## 1. UNIVERSAL CONVENTIONS (already implemented — apply to every endpoint you add)

**Base path:** `/api/v1`

### Error envelope — every non-2xx response
```json
{ "error": { "code": "CARGO_EXCEEDS_CAPACITY",
             "message": "Human-readable explanation.",
             "fields": { "cargo_weight_kg": "Must be at most 500" } } }
```
- `code` — `SCREAMING_SNAKE_CASE`, stable, what the frontend switches on
- `message` — safe to show a user
- `fields` — present only for validation errors; keys match the request body field names **exactly**
  so the frontend can drop them straight into form fields

**Invalid input must never produce a 500.** Always an enveloped 4xx.

### Standard codes
| Code | HTTP | When |
|---|---|---|
| `VALIDATION_ERROR` | 422 | Body/query failed schema validation |
| `UNAUTHORIZED` | 401 | Missing/invalid/expired token |
| `FORBIDDEN` | 403 | Authenticated but role lacks permission |
| `NOT_FOUND` | 404 | Resource doesn't exist |
| `CONFLICT` | 409 | Uniqueness or concurrent-state conflict |
| *(domain codes)* | 422 | ★ **Enumerate every one you add, in §4 below** |

> ⚠️ Last round this doc promised "domain codes below" and then never listed them. The frontend
> ended up guessing. **List every code you invent.**

### Paginated list envelope — every list endpoint
```json
{ "items": [ ... ], "total": 128, "page": 1, "page_size": 20, "pages": 7 }
```
Query params supported by `core/pagination.py` on any list endpoint:

| Param | Type | Default | Notes |
|---|---|---|---|
| `page` | int ≥1 | 1 | |
| `page_size` | int 1..100 | 20 | |
| `sort` | string | — | `field` or `-field` for descending. **Allowlisted per endpoint** |
| `q` | string | — | Free-text search across that endpoint's declared searchable columns |

> ⚠️ **Frontend: KPI totals must read `total`, never `items.length`.** `items` is one page.
> This exact bug shipped last round and silently under-reported every count past 200 rows.

### Auth
- `POST /auth/login` sets an **httpOnly cookie**. The browser sends it automatically —
  the frontend never handles a token.
- `Authorization: Bearer <token>` also works, for `curl` and Swagger demos.
- Every endpoint except `/health` and `/auth/login` requires authentication.

---

## 2. ENDPOINTS ALREADY BUILT

| Method | Path | Auth | Returns |
|---|---|---|---|
| `GET` | `/health` | none | `{status, database, version}` |
| `POST` | `/auth/login` | none | `{user}` + sets cookie |
| `POST` | `/auth/token` | none | `{access_token, token_type}` — curl/Swagger only |
| `POST` | `/auth/logout` | user | `{ok: true}` + clears cookie |
| `GET` | `/auth/me` | user | `{id, email, full_name, role}` |
| `GET` | `/events` | user | **SSE stream**, 15s heartbeat |
| `GET` | `/notifications` | user | Paginated, scoped to the calling user only |
| `POST` | `/notifications/read-all` | user | `{marked_read: n}` |
| `GET` | `/audit-logs` | admin role | Paginated audit trail |

### SSE event frames
```
event: connected
data: {"ts": "2026-09-05T10:00:00Z"}

event: <domain>.<action>
data: {"id": "...", ...}

: heartbeat        ← comment frame every 15s, keeps proxies from closing the stream
```
Naming convention: `noun.verb_past` — e.g. `order.created`, `order.dispatched`, `kpi.refresh`.

---

## 3. ★ YOUR DOMAIN ENDPOINTS — fill this in at 10:00

Copy this block per resource. **Write it before you write the code.**

### `<Resource>`

| Method | Path | Role required | Purpose |
|---|---|---|---|
| `GET` | `/<resources>` | any | List — paginated, `sort` allowlist: `[...]`, `q` searches: `[...]` |
| `GET` | `/<resources>/{id}` | any | Detail |
| `POST` | `/<resources>` | `<role>` | Create |
| `PATCH` | `/<resources>/{id}` | `<role>` | Partial update |
| `DELETE` | `/<resources>/{id}` | `<role>` | Soft delete / archive |
| `POST` | `/<resources>/{id}/<action>` | `<role>` | State transition (dispatch/approve/close/…) |

**Create request**
```json
{ "field_a": "string, required, max 120",
  "field_b": 123.4,
  "status": "draft|active|done" }
```

**Response**
```json
{ "id": "uuid", "field_a": "...", "field_b": 123.4,
  "status": "draft", "created_at": "2026-09-05T10:00:00Z" }
```

**Domain rules enforced (each returns 422 with the listed code):**
| Rule | Code |
|---|---|
| e.g. cargo must not exceed capacity | `CARGO_EXCEEDS_CAPACITY` |
| e.g. cannot dispatch a non-draft | `INVALID_STATUS_TRANSITION` |

---

## 4. ★ DOMAIN ERROR CODE REGISTRY — every code, no exceptions

| Code | HTTP | Meaning | Raised in |
|---|---|---|---|
| | | | |

*(Add a row the moment you invent a code. The frontend switches on these strings.)*

---

## 5. CONTRACT CHANGE PROTOCOL

1. Edit this file **first**
2. Say it out loud to the room (or in the group chat) — one line: *"changing X to Y"*
3. Then change the backend
4. Frontend updates `lib/api.ts` types to match

The QA owner (Card D) polices drift. A contract change that isn't announced is how you get a
frontend calling an endpoint that no longer exists at 23:00.
