# 03 — DATA MODEL

> **Read when:** turning the problem statement into tables.
> **Owner:** Backend Core, with the whole team present for the first 20 minutes.

---

## 1. THE RECIPE: PROBLEM STATEMENT → SCHEMA

**Step 1 — Underline every noun.** Those are your candidate tables. Most Odoo-style
statements have 5–9 real entities plus users/roles (already built).

**Step 2 — Find the spine.** Almost every one of these problems has ONE entity that
moves through statuses with rules attached — an order, a trip, a booking, a request,
a ticket. **That entity is the app.** Its state machine is what you demo, what you
validate, and what the judges probe. Identify it before anything else.

**Step 3 — Underline every verb.** Those are your endpoints and your state
transitions. "Dispatch", "approve", "close", "cancel" → `POST /things/{id}/dispatch`.

**Step 4 — Underline every "must"/"cannot"/"automatically".** Those are your business
rules. Write them down as a numbered list; that list becomes both `services/rules.py`
and your test file. If the statement says *"a driver with an expired licence cannot be
assigned"*, that's one rule, one guard, one reject-test and one accept-test.

**Step 5 — Write the ERD on paper before typing.** Ten minutes with everyone looking
at the same diagram prevents the 6-hour "wait, I thought orders belonged to
customers" conversation.

---

## 2. RULES FOR EVERY TABLE

- **`UUIDMixin`** always. **`TimestampMixin`** whenever a row can be edited later.
- **Unique constraints** on anything the statement calls unique (registration number,
  email, reference code). Enforce it in the DB, not just in a router.
- **CHECK constraints** for every numeric rule (`quantity > 0`, `weight <= capacity`).
  A rule enforced by the database cannot be bypassed by a bug in a route handler —
  and it demonstrates real data modelling, which is on the "nice to have" list.
- **Index** every column you will filter or sort by: status, foreign keys, dates.
- **Status columns use a Python `Enum` with `native_enum=False`.** Native PostgreSQL
  enum types require a migration dance to change, and you will want to add a status
  value later.
- **Money** as `Numeric(12, 2)` if exactness matters; `Float` is fine for a demo but
  say so out loud if asked.
- **Dates**: `DateTime(timezone=True)` and always UTC. Never mix `date.today()` (local)
  with `datetime.now(UTC)` — that inconsistency silently broke three tests on every
  IST machine in the previous project.

---

## 3. MIGRATIONS

```bash
cd backend
uv run alembic revision --autogenerate -m "add orders"
uv run alembic upgrade head
uv run alembic check          # verifies models match the latest migration
```

Two things that bite:
1. **Autogenerate only sees models that are imported.** Add every new model to
   `models/__init__.py` or Alembic will cheerfully generate an empty migration.
2. **Read the generated migration before applying it.** Autogenerate is good, not
   perfect — especially with enum and constraint changes.

If migrations become a time sink mid-build, `Base.metadata.create_all()` (what the
seed script calls) is an acceptable fallback for a demo. Say so honestly if asked;
don't pretend a migration chain exists that doesn't.

---

## 4. SEED DATA — WORTH MORE THAN IT LOOKS

A dashboard with 4 rows of "Test 1, Test 2" reads as unfinished. The same dashboard
with 60 believable rows reads as a product. It is one of the cheapest credibility
wins available, and the generators are already written (`seed/generators.py`:
Indian names, real city coordinates, plate numbers, phone numbers, dates).

**Volume target:** 40–80 rows for the main entity, 15–30 for supporting ones. Enough
to make pagination, search and sorting visibly meaningful.

**Seed the edge cases you want to demo.** If a rule says "expired licences are
blocked", seed two expired licences — otherwise you cannot show the rule working.
Deliberately seed:
- a couple of rows in each status
- at least one row that violates a soft rule (expiring soon, over threshold)
- one row that will make a validation demo fail convincingly

**Keep it deterministic** (`Gen(42)`). The demo you rehearse should be the demo you
present.

---

## 5. WHAT'S ALREADY IN THE DATABASE

`roles`, `users`, `audit_logs`, `notifications` — built, tested, seeded. Don't
rebuild them; add your domain tables alongside and reference `users.id` for
ownership/audit columns.
