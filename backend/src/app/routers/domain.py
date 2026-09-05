"""★ YOUR DOMAIN ENDPOINTS GO HERE ★

Recipe (docs/06_BACKEND.md has the long version):

    router = APIRouter(prefix="/orders", tags=["orders"])

    require_order_write = require_roles("Manager")   # name it by INTENT, not role list

    @router.get("", response_model=Page[OrderOut])
    def list_orders(status: str | None = None,
                    params: PageParams = Depends(page_params),
                    db: Session = Depends(get_db),
                    _: User = Depends(get_current_user)):
        stmt = select(Order)
        if status:
            stmt = stmt.where(Order.status == status)
        return paginate(db, stmt, params,
                        sortable={"created_at": Order.created_at,
                                  "reference": Order.reference},
                        searchable=[Order.reference],
                        default_sort="-created_at")

    @router.post("", response_model=OrderOut, status_code=201)
    def create_order(payload: OrderCreate,
                     db: Session = Depends(get_db),
                     user: User = Depends(require_order_write)):
        order = Order(**payload.model_dump(), created_by_id=user.id)
        db.add(order)
        db.commit()
        db.refresh(order)
        rules.emit("order.created", id=order.id)
        return order

    @router.post("/{order_id}/activate", response_model=OrderOut)
    def activate(order_id: str,
                 db: Session = Depends(get_db),
                 user: User = Depends(require_order_write)):
        return rules.activate_order(db, order_id, actor_id=user.id)   # rules live in services/

Then register it in main.py (there is a ★ marker showing exactly where).
"""

from fastapi import APIRouter

router = APIRouter()
