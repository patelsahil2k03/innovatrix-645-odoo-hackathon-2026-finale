# 06 — BACKEND PLAYBOOK

> **Owner:** Backend Core. **Read before your first router.**

---

## 1. THE 15-MINUTE RESOURCE RECIPE

Five files, in this order, per entity. Everything cross-cutting already exists.

**1 · Model** → `models/domain.py`
```python
class Order(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "orders"
    __table_args__ = (CheckConstraint("quantity > 0", name="ck_orders_qty_positive"),)

    reference: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[OrderStatus] = mapped_column(
        Enum(OrderStatus, native_enum=False), default=OrderStatus.DRAFT, index=True
    )
```
Then add it to `models/__init__.py` or Alembic won't see it.

**2 · Schemas** → `schemas/domain.py`
```python
class OrderCreate(BaseModel):
    reference: str = Field(min_length=1, max_length=32)
    quantity: float = Field(gt=0, le=100_000)      # bounds mirror the CHECK constraint

class OrderOut(ORMModel):
    id: str
    reference: str
    quantity: float
    status: OrderStatus
    created_at: datetime
```

**3 · Rules** → `services/rules.py` — only for transitions and cross-entity rules.
Plain CRUD does not need a service.

**4 · Router** → `routers/domain.py` — see the worked example in that file's docstring.

**5 · Register** → `main.py`, at the `★ REGISTER YOUR DOMAIN ROUTERS HERE` marker.

Then: `alembic revision --autogenerate -m "add orders" && alembic upgrade head`.

---

## 2. THE LOCKING DISCIPLINE (the one thing to get right)

For any endpoint that changes a status:

```
1. LOCK the row you will mutate        lock_row(db, Order, order_id)
2. RE-CHECK its state AFTER the lock   require_status(order.status, OrderStatus.DRAFT)
3. Mutate
4. Commit
5. THEN publish the event              emit("order.activated", id=order.id)
```

Step 2 is the one everyone skips. A check made *before* the lock is a check against a
value that may already be stale — two concurrent requests both pass it and both apply
the transition. This was a real, shipped bug in the previous project: the code locked
the related rows but never the row it was actually mutating, so a background task and
a user request could double-complete the same record, writing a duplicate child row
and firing a duplicate event.

`services/rules.py` has `lock_row`, `require`, `require_status` and `emit` ready to use.

---

## 3. ERROR DISCIPLINE

- Raise `AppError(code, message, fields=...)` — never a bare `HTTPException` for
  domain failures, and never let a 500 reach the client for bad input.
- **Add every new code to the registry in `04_API_CONTRACT.md` §4.** The frontend
  switches on those strings; an unlisted code is an undocumented API.
- `fields` keys must match the request body field names exactly, so the UI can drop
  each message straight into the matching input.

---

## 4. RBAC

Name dependencies by intent, not by role list, at the top of the router:
```python
require_order_write = require_roles("Administrator", "Manager")
```
Reads stay open to any authenticated user; only writes are gated. If the problem
statement demands per-record ownership ("a user sees only their own orders"), filter
in the query by `user.id` — that's a data-scoping rule, not an RBAC role.

---

## 5. LISTS

Always use the shared pagination helper — never return a bare list:
```python
return paginate(db, select(Order), params,
                sortable={"created_at": Order.created_at, "reference": Order.reference},
                searchable=[Order.reference],
                default_sort="-created_at")
```
`sortable`/`searchable` are allowlists, so an arbitrary `?sort=` string can't reach SQL.

---

## 6. MAKING DATA MOVE

Wire `services/simulator.py::_tick()` to your domain once core CRUD works. It must
call the same service functions the API calls — never write to the DB directly there,
or your "live" data will violate the very rules you're demonstrating.

Keep each tick small: a judge should see *one* thing change, not ten.

---

## 7. QUICK CHECKS

```bash
uv run pytest                                   # full suite
uv run uvicorn app.main:app --reload            # http://localhost:8000/docs
curl localhost:8000/api/v1/health
../scripts/verify-sse.sh                        # prove real-time works
```

Swagger at `/docs` is genuinely demo-able — use `POST /auth/token` + the Authorize
button to show a business rule rejecting a bad request live.
