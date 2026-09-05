# 02 — ARCHITECTURE

> **Read before writing your first module.** This describes what the boilerplate already does,
> and exactly where your domain code plugs in.

---

## 1. THE SHAPE

```
Browser (Next.js, client-rendered)
   │  REST  /api/v1/*        ──────────────┐
   │  SSE   /api/v1/events   ──────────┐   │
   ▼                                   │   ▼
FastAPI app  (src/app/main.py)         │  routers/*.py
   ├─ CORS middleware                  │     └─ request/response shaping + RBAC only
   ├─ Audit middleware  ───────────────┤     
   ├─ Error handlers (envelope)        │  services/*.py
   └─ Routers                          │     └─ ALL business rules, in locked transactions
        │                              │
        ▼                              │  models/*.py
   SQLAlchemy Session (per request)    │     └─ tables, constraints, indexes
        │                              │
        ▼                              │
   SQLite  or  PostgreSQL              │
        ▲                              │
        │                              │
   Background task (asyncio) ──────────┘
   mutates data on a timer, publishes events → this is the "dynamic data" proof
```

**One rule governs the whole layout:** routers do not contain business rules, and services do
not contain HTTP concepts. If a rule matters, it lives in `services/` where both an API request
and the background task hit the same code path.

---

## 2. WHAT IS ALREADY BUILT (do not rebuild)

| Concern | Where | Status |
|---|---|---|
| App factory, lifespan, CORS | `core/` + `main.py` | ✅ done |
| Settings from `.env` | `core/settings.py` | ✅ done |
| DB session per request | `core/database.py` | ✅ done |
| Error envelope + handlers | `core/errors.py` | ✅ done |
| Password hashing (bcrypt direct) | `core/security.py` | ✅ done |
| JWT create/decode + token extraction | `core/security.py` | ✅ done |
| Login / logout / me + RBAC deps | `core/rbac.py`, `routers/auth.py` | ✅ done |
| Pagination + sort allowlist + search | `core/pagination.py` | ✅ done |
| SSE hub + `/events` | `core/events.py`, `routers/events.py` | ✅ done |
| Audit log middleware | `core/audit.py` | ✅ done |
| CSV streaming export | `core/csv_export.py` | ✅ done |
| Notifications | `models/system.py`, `routers/notifications.py` | ✅ done |
| Seed framework + generators | `seed/` | ✅ done |
| Tests for all of the above | `tests/` | ✅ passing |

**You write only:** your domain models, their schemas, their routers, and the rule engine in
`services/rules.py`. Everything else is plumbing that already works.

---

## 3. WHERE THE DOMAIN CODE GOES

The generic `domain.py` placeholders get replaced by named accounting modules:

```
src/app/
├── models/
│   ├── base.py       ← Base, UUIDMixin, TimestampMixin  (given)
│   ├── auth.py       ← User, Role                        (given)
│   ├── system.py     ← AuditLog, Notification            (given)
│   ├── masters.py    ← Contact · Product · Account · Journal · AnalyticAccount
│   ├── ledger.py     ← ★ JournalEntry · JournalLine      THE CORE
│   ├── documents.py  ← PurchaseOrder · VendorBill · SalesOrder · CustomerInvoice
│   └── payments.py   ← Payment · PaymentAllocation
├── schemas/          ← one module per models file, same names
├── routers/
│   ├── health.py auth.py events.py notifications.py      (given)
│   ├── masters.py documents.py payments.py
│   ├── ledger.py     ← read-only: list + detail, no writes
│   ├── reports.py    ← balance-sheet · profit-and-loss · budget · trial-balance
│   └── portal.py     ← contact-scoped, separate router
└── services/
    ├── posting.py    ← ★★ post_entry() / reverse_entry()  — the accounting engine
    ├── payments.py   ← allocation + idempotency
    ├── reports.py    ← ledger aggregation
    └── rules.py      ← lock_row · require_status · emit  (given)
```

Register each router in `main.py` at the `★ REGISTER YOUR DOMAIN ROUTERS HERE` marker.

**`services/posting.py` is the only module that writes to `journal_lines`.** Nothing else
imports `JournalLine` for writing — not a router, not the simulator, not the seed script.
If a second write path appears, the guarantee is gone.

---

## 4. THE REQUEST LIFECYCLE

1. Request arrives → **CORS** → **AuditMiddleware** (records successful writes)
2. Router matches → **`Depends(get_current_user)`** decodes the JWT from the httpOnly cookie
   (falls back to `Authorization: Bearer` for curl/Swagger)
3. Write endpoints add **`Depends(require_roles(...))`** — a 403 here is the *real* security
   boundary; the frontend hiding a button is only UX
4. Router calls a **service** function, passing the DB session
5. Service opens a transaction, **locks the rows it will mutate**, re-checks their state,
   applies the rule, commits
6. **After commit**, the service publishes an SSE event
7. Router returns a pydantic schema; errors anywhere become `{error:{code,message,fields}}`

---

## 5. REAL-TIME: HOW "DYNAMIC DATA" IS PROVEN

Judging criterion #1 is *"use real-time or dynamic data sources, avoid static JSON."*

Two mechanisms, already wired:

**a) SSE push.** `core/events.py` is an in-process asyncio pub/sub. Any service can call
`hub.publish("thing.updated", {...})` after a commit. `GET /api/v1/events` streams these to the
browser with a heartbeat. The frontend's `useEventStream()` hook subscribes once and any screen
can react.

**b) A background task that actually changes data.** `main.py`'s lifespan starts an optional
asyncio loop (`SIMULATOR_ENABLED=true`). Here it posts **one customer payment against an
open invoice** on a timer — the best possible tick for this domain, because a single event
visibly moves three things at once:

```
payment posts  →  invoice status DRAFT/POSTED → PARTIAL → PAID
               →  cash KPI rises, receivables KPI falls
               →  trial balance recomputes and stays 0.00 ✓
```

**It must call the same service functions the API calls** — never mutate the DB directly,
or your "live" data will violate the very rules you're demonstrating. In this system that
is not a style preference: a direct write would produce an unbalanced ledger on stage.

> In the demo, say the words out loud: *"this number is changing live, from our database —
> nothing here is hardcoded."* Judges are explicitly listening for it.

### The posting path, end to end

```
POST /customer-invoices/{id}/post
  → router: require_roles("Admin","Accountant")
  → service: lock_row(invoice) → require_status(DRAFT)
  → service: build lines from contact + product account mappings
  → posting.post_entry():  balance check → duplicate guard → number → write
  → COMMIT
  → emit("document.posted") + emit("ledger.changed", is_balanced=True)
  → browser: invoice row updates, KPIs update, trial-balance badge re-asserts
```

Every write in this system ends the same way: commit, then publish. Never the reverse — an
event published before commit can describe a transaction that then rolls back.

---

## 6. AUTH & RBAC MODEL

- JWT in an **httpOnly cookie** → JavaScript can never read the token → no XSS token theft
- `Authorization: Bearer` also accepted, so Swagger and `curl` demos work
- **All reads are open to any authenticated user. Only writes are role-gated.** This is a
  deliberate simplification that has never cost points and saves a lot of matrix-wrangling.
- Roles are seeded rows, not an enum in code — the PS's role names go in `seed/seed.py`
- The frontend mirrors the write-permissions in `lib/roles.ts` **for UI convenience only**

---

## 7. FRONTEND SHAPE

```
src/
├── app/                    Next.js App Router — one folder per route
│   ├── layout.tsx          AuthProvider + theme boot script (no flash of wrong theme)
│   ├── design-system.css   ★ ALL design tokens. Locked hour 1.
│   ├── login/page.tsx
│   └── <your routes>/
├── components/
│   ├── shell/              app shell: sidebar, topbar
│   └── ui/                 accessible primitives — USE THESE, don't rewrite
└── lib/
    ├── api.ts              typed client; unwraps the error envelope into ApiError
    ├── auth-context.tsx    session + route gating
    ├── use-fetch.ts        loading/error/data for a page's main call
    ├── use-paged-rows.ts   client-side sort/paginate for small lists
    ├── use-debounced-value.ts   ← use for EVERY search box
    ├── use-event-stream.ts SSE subscription
    ├── validation.ts       Zod schemas mirroring server rules
    └── roles.ts            UI-only permission helpers
```

**Data flow:** page calls `useFetch(() => api.things.list(params))` → renders `<AsyncState>`
(loading / error / empty / data) → mutations call `api.*` then bump the reload key.

---

## 8. ARCHITECTURE DECISIONS AND WHY

| Decision | Why | What we rejected |
|---|---|---|
| Business rules in `services/`, not routers | The background task and the API must enforce identical rules | Rules in routers (duplicated, drifts) |
| Metrics computed on read | No cache invalidation bugs in a 24h build | Denormalised/stored aggregates |
| In-process SSE hub | Zero infrastructure, works offline | Redis pub/sub, websockets |
| httpOnly cookie for JWT | XSS can't steal it | `localStorage` token |
| Server-side pagination from day one | Adding it later means touching every screen | Client-side filtering of a full fetch |
| Reads open, writes gated | Simple, defensible, fast to build | Full per-resource permission matrix |
| Hand-rolled CSS tokens | Total control, no framework fighting | A component library (theming costs hours) |
