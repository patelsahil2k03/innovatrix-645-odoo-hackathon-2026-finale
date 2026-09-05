# 01 — STACK

> **Read at:** 09:35 on day 1, when locking technology decisions.
> **Principle:** the boilerplate locks everything that is *domain-independent*. Everything that
> depends on what the problem statement actually asks for stays **deliberately open** until the
> PS lands. Don't pre-commit to a decision you'll have better information about in one hour.

---

## 1. LOCKED — do not relitigate on the day

These are settled because the team has shipped with them, they need no internet at runtime, and
changing them mid-hackathon costs hours for zero judging points.

### Backend
| Concern | Choice | Pinned | Why |
|---|---|---|---|
| Framework | **FastAPI** | `~=0.141` | Auto Swagger at `/docs` (demo-able), pydantic validation built in |
| Language | **Python 3.13** via `uv` | — | `uv` resolves + installs in seconds, not minutes |
| ORM | **SQLAlchemy 2.0** | `~=2.0.52` | Typed ORM, real constraints, row-level locking |
| Migrations | **Alembic** | `>=1.19` | Proves "data modeling" to judges |
| Settings | **pydantic-settings** | `>=2.15` | `.env` → typed config |
| Auth | **PyJWT + bcrypt** | `>=2.13`, `>=5.0` | See the passlib warning below ⚠️ |
| Real-time | **sse-starlette** | `~=3.4` | Server-Sent Events — simpler than websockets, satisfies "dynamic data" |
| Server | **uvicorn[standard]** | `>=0.52` | — |
| Tests | **pytest + httpx** | `>=9.1`, `>=0.28` | — |

### Frontend
| Concern | Choice | Pinned | Why |
|---|---|---|---|
| Framework | **Next.js 16 (App Router)** | `16.3.4` | File routing, zero config, fast |
| UI runtime | **React 19** | `19.2.8` | — |
| Language | **TypeScript 5.x** | `^5` | ⚠️ **NOT 7** — see below |
| Styling | **Tailwind v4 + hand-rolled tokens** | `^4.3` | Tokens in `design-system.css`; Tailwind for layout utilities |
| Validation | **Zod** | `^4.5` | Mirrors server rules client-side |
| Lint | **ESLint 9** | `^9` | ⚠️ **NOT 10** — see below |

---

## 2. ⚠️ THREE LANDMINES — verified live on 2026-09-05

These were found by checking the actual registries, not by assuming July's pins still hold.
Each one would have cost real time on hackathon day.

### 2.1 🚨 `passlib` is dead — do not use it
`passlib` 1.7.4 was last released in **2020**. It reads `bcrypt.__about__`, an attribute
**removed in bcrypt 4.1+**. Current bcrypt is **5.0.0**. The classic symptom is a confusing
`AttributeError: module 'bcrypt' has no attribute '__about__'` at import or first hash — during
hour 1, while you're trying to get login working.

**The virtual-round project used `passlib[bcrypt]`.** It worked then because the pinned bcrypt
was older. It would not work cleanly today.

✅ **This boilerplate calls `bcrypt` directly** (`core/security.py`). Two functions, no wrapper,
no dead dependency.

### 2.2 ⚠️ TypeScript 7 is current — do not adopt it here
`typescript@latest` is now **7.0.2** (the native/Go compiler rewrite). It is genuinely fast and
genuinely a major version change. A 24-hour hackathon is the **worst possible time** to be the
person debugging a toolchain incompatibility between TS7, Next 16, and ESLint.

✅ Pin `typescript: "^5"`. Revisit after the hackathon.

### 2.3 ⚠️ ESLint jumped to 10, `sse-starlette` jumped 2.x → 3.x
Same reasoning for ESLint — pin `^9`. For `sse-starlette`, the 2.x→3.x major bump may have
changed the `EventSourceResponse` API surface; the boilerplate pins `~=3.4` and **ships a test
that opens the stream** so any drift fails immediately at setup, not at 22:00.

---

## 3. RESOLVED — decided once the problem statement landed

These were deliberately left open. **Urban Furniture: Accounting System** settles them:

| Decision | Resolution | Why |
|---|---|---|
| **Database** | **PostgreSQL for the shared/demo instance · SQLite fine for local dev** | See §3.1 — this was tested, not assumed, and the reason is **not** the one you'd expect. |
| **Charts** | **Hand-rolled SVG** | The reports are tables of figures, not an analytics dashboard. At most: one budget planned-vs-actual bar per line, and a small net-profit trend. Both are a `<rect>` and a `<path>`; `recharts` would be ~200KB to draw two shapes we'd have to re-theme anyway. |
| **Maps / geo** | **Nothing** | Not a location-shaped domain. |
| **File uploads** | **Local disk, images only** | ⚠️ **Reversed.** The mockup draws an **Upload Image** control on both the Contact and Product forms, not a URL field. Local disk, size-capped, extension-allowlisted, served back as a static path. Initials remain the fallback when no image exists. |
| **PDF generation** | **Required — `weasyprint`** | ⚠️ **Reversed.** An earlier reading of the PDF concluded this statement never asks for PDF. The mockup does: invoices and bills carry **Print** and **Send** actions, and the Profit & Loss screen is annotated *"Pdf download on click"*. WeasyPrint renders our existing HTML and CSS, so the print layout and the PDF stay one artefact rather than two templates that drift apart. |
| **Email** | **Required — SMTP via `aiosmtplib`** | The mockup's **Send** action reads *"Allow user to send from Mail"*. See §3.2 — this is the one dependency that can fail on the day, and it is wired so it cannot take the demo with it. |
| **Background jobs** | **The existing asyncio task** | It posts one small payment on a timer — see [`06_BACKEND.md`](06_BACKEND.md) §12. |
| **New dependencies** | **Two: `weasyprint`, `aiosmtplib`** | Both are demanded by the mockup rather than chosen. Everything else in this domain is `Numeric`, `Enum` and `SUM(...) GROUP BY`. |

> **Two dependencies, each traceable to a specific requirement.** The organizers say *"use
> trendy technologies only if they add real value"* — and the defence for each of these is an
> annotation on the official mockup, which is the strongest justification available.

> ### ⚠️ REVERSED IN IMPLEMENTATION — the PDF engine is `xhtml2pdf`, not `weasyprint`
>
> **WeasyPrint does not work on this team's Windows machines.** It binds to GTK
> (`libgobject-2.0-0`, Pango, cairo), a separate native install that is not
> present, and it fails when the library loads rather than at import — so the
> endpoint looks healthy right up until someone clicks Download in the demo.
>
> `xhtml2pdf` replaces it: pure Python, no native dependencies, installs with
> `uv sync` like everything else. It renders the **same Jinja template** the
> print view uses, so the "one artefact, no drift" reasoning that chose an
> HTML-based engine in the first place is untouched — only the engine changed.
>
> WeasyPrint is deliberately **not** in `pyproject.toml`: on a machine that
> cannot use it, importing it writes a multi-line troubleshooting banner to
> stderr on every PDF request. `services/rendering.py` still tries it first, so
> a Linux deployment (or Windows plus the GTK runtime) that installs it gets the
> better renderer with no code change. CSS is kept plain — no flexbox, no grid,
> no web fonts — so both engines produce the same layout.
>
> ### And `aiosmtplib` turned out not to be needed either
>
> `services/mail.py` uses the **standard library's `smtplib`**. The reason to
> reach for the async client is to avoid blocking the event loop, and this
> endpoint never does: `POST /{doc}/{id}/send` is a sync `def`, so FastAPI runs
> it in the threadpool, where a blocking socket with a 10s timeout costs
> nothing. An async client here would add a dependency to solve a problem the
> framework already solved.
>
> It also lets the endpoint report the **real** outcome rather than only that a
> message was handed off — `{queued, to, error}` — which is what makes
> `last_send_error` meaningful.
>
> **Net new dependencies: one.** `xhtml2pdf`, traceable to the mockup's *"Pdf
> download on click"*. (`jinja2` comes in with it and is already in FastAPI's
> own tree.) Fewer moving parts than planned, and the two that were dropped were
> dropped for stated reasons rather than forgotten.

### 3.2 Email is the one thing that can fail on the day

The organizers ask for solutions that *"plan for offline or local"*. Real SMTP is the
opposite of that. This is a decision taken with the risk understood rather than by accident,
and it is contained:

- **Sending is never on the demo path.** Every document can be viewed, printed and downloaded
  as a PDF without touching the network. Send is an extra, not a step in any flow we walk.
- **A failed send never blocks a state change.** The document is posted before mail is
  attempted. A failure surfaces as a dismissible notice — never a rolled-back transaction,
  never a 500.
- **Dispatch is best-effort and recorded**, so the UI can show *sent* or *not sent* honestly
  rather than optimistically.
- **A local catcher is the fallback.** If venue networking is unusable, point `SMTP_HOST` at
  a local MailHog container and the feature still demonstrates end to end, offline.

Configuration lives in `.env` — `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`,
`MAIL_FROM`. With `SMTP_HOST` unset the feature disables itself cleanly instead of raising on
first use.

### 3.1 The database question, actually tested

Two claims get made about SQLite and money. We tested both against SQLAlchemy 2.0.52
rather than repeating folklore.

**Claim 1 — "SQLite loses decimal precision, so money breaks." → FALSE. Do not repeat it.**

```
1000 rows of Decimal("0.07"), summed by SQLite's own SUM():
  DB SUM()  → Decimal('70.00')     exact ✅
  Python    → Decimal('70.00')     exact ✅
  delta     → 0.00
```
SQLAlchemy's SQLite dialect round-trips `Numeric` through a string representation, so
`Decimal` survives storage *and* in-database aggregation. No precision warning is raised.
**Money on SQLite is safe.**

**Claim 2 — "`SELECT … FOR UPDATE` doesn't work on SQLite." → TRUE, and it fails silently.**

The same `with_for_update()` query compiled for each dialect:
```
Postgres:  SELECT s.id, s.n FROM s WHERE s.id = %(id_1)s FOR UPDATE
SQLite:    SELECT s.id, s.n FROM s WHERE s.id = ?
```
The lock clause is **dropped with no error and no warning**. `lock_row()` — our primary
defence against double-posting ([`06_BACKEND.md`](06_BACKEND.md) §4) — becomes a plain
`SELECT` on SQLite while continuing to look correct in the source.

That is exactly the class of failure [`10_LESSONS.md`](10_LESSONS.md) is about: a guard
that silently stops guarding.

**Corollary bug this surfaced (2026-09-05):** `lock_row()`'s plain `SELECT ... FOR UPDATE`
locks whatever table it's given — but four models (`SalesOrder`, `PurchaseOrder`,
`VendorBill`, `CustomerInvoice`) declare their contact relationship as `lazy="joined"`,
so the ORM folds a `LEFT OUTER JOIN` into that same SELECT automatically. Postgres
outright rejects `FOR UPDATE` on the nullable side of an outer join
(`FeatureNotSupported`); SQLite drops the clause entirely per Claim 2 above, so this was
invisible until the first real run against the shared Postgres instance. Fixed by naming
the table explicitly — `with_for_update(of=model)` in `services/rules.py` — which locks
only the row being mutated and works whether or not the join is present.

**So:**
- **Shared / demo / anything being graded → PostgreSQL**, because `lock_row` actually locks.
  `./scripts/dev.sh --db docker` and `uv sync --extra postgres`.
- **Local development → SQLite is fine.** Identical schema, exact money, zero setup, works
  offline. If Docker fails on someone's laptop, they lose nothing but real row locks.
- **Correctness does not depend on the choice.** The real backstop against a duplicate
  journal entry is `UNIQUE(source_type, source_id)` from
  [`03_DATA_MODEL.md`](03_DATA_MODEL.md) §3, and a unique constraint works identically on
  both. The lock turns an ugly constraint violation into a clean `ALREADY_POSTED` — it is
  the difference between a 500 and a 409, not between right and wrong.
- **The concurrency test in [`07_TESTING_AND_REVIEW.md`](07_TESTING_AND_REVIEW.md) §1.3
  only proves anything on Postgres.** Mark it `@pytest.mark.postgres` and skip it on
  SQLite rather than letting it pass vacuously.

---

## 4. HOW TO SWITCH THE DATABASE

One line in `.env` — nothing else changes:

```bash
# SQLite (default — zero setup, survives bad venue wifi and unfamiliar hardware)
DATABASE_URL=sqlite:///./app.db

# PostgreSQL (needs Docker; use if the PS justifies it)
DATABASE_URL=postgresql+psycopg://app:app@localhost:5432/app
```

Then `uv run alembic upgrade head && uv run python -m app.seed`.
`scripts/dev.sh` starts Postgres only when you ask for it (`--db docker`); by default it stays
fully local.

---

## 5. VERSION-CHECK RITUAL (do this once, the morning of)

Registries move. Re-verify before you rely on these pins:

```bash
npm view next version && npm view react version && npm view tailwindcss version
uv pip index versions fastapi 2>/dev/null | head -1
```

If something has moved a **major** version since this doc was written, **do not upgrade on the
day.** Note it, keep the pin, move on. Hackathon day is for shipping, not for migrations.
