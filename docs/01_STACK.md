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

## 3. DELIBERATELY OPEN — decide when the PS lands

Do not pre-commit these. You will have far better information at 09:30 on day 1.

| Decision | Options | Decide based on |
|---|---|---|
| **Database** | **SQLite** (zero setup, one file) vs **PostgreSQL** (Docker) | Both already work — flip `DATABASE_URL` in `.env`, nothing else changes. Default to **SQLite** unless the PS needs concurrent writes, JSON/array columns, or you want the "real DB" story. On unfamiliar venue hardware, SQLite removes an entire class of failure. |
| **Charts** | Hand-rolled SVG vs `recharts` | If the PS wants 1–2 simple charts, hand-roll (zero deps, already themed). If it wants a real analytics dashboard, `recharts@3.10` is worth the install. |
| **Maps / geo** | Leaflet, or nothing | Only if the PS is location-shaped. Don't add it speculatively. |
| **File uploads** | Local disk vs base64-in-DB | Only if the PS demands attachments. |
| **Background jobs** | asyncio task (already in boilerplate) vs anything heavier | The built-in asyncio task is almost certainly enough. |
| **Any domain library** | — | Only if it saves >1 hour AND you can explain it to the evaluator. |

**Rule of thumb from the organizers themselves:** *"Use trendy technologies only if they add
real value."* Every dependency you add is a dependency you must defend at 13:00.

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
