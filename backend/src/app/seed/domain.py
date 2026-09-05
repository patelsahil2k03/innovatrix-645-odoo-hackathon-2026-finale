"""Demo data for the accounting domain (03_DATA_MODEL.md §8).

A ledger with four rows reads as unfinished; the same ledger with a month of real
trading reads as a product. Volume is chosen so pagination, search and sorting are
visibly meaningful and the reports show figures rather than round test numbers.

**Everything that posts goes through `services/`.** Writing documents and journal
entries directly here would let the seed produce data the API itself would have
rejected — an unbalanced entry, a payment over the amount due — and the first
thing anyone notices is a demo whose numbers do not add up. Using the services
means the seed is also a live test of them: if a rule breaks, seeding fails.

Deterministic on `Gen(42)`: the demo you rehearse is the demo you present.
"""

import logging
from datetime import timedelta
from decimal import Decimal
from types import SimpleNamespace

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models.auth import Role, User
from app.models.base import utc_now
from app.models.budgets import Budget, BudgetLine, BudgetState
from app.models.masters import (
    Account,
    AnalyticAccount,
    AnalyticType,
    Contact,
    ContactType,
    Product,
    ProductCategory,
    ProductType,
)
from app.seed.generators import Gen
from app.services import budgets as budget_svc
from app.services import documents as doc_svc
from app.services import payments as pay_svc

logger = logging.getLogger(__name__)

CATEGORIES = ["Seating", "Tables", "Storage", "Bedroom", "Office", "Services"]

# (name, type, category, cost, sale, tax%) — a furniture catalogue, not "Item 1".
PRODUCTS = [
    ("Office Chair", ProductType.GOODS, "Seating", 2400, 4200, 18),
    ("Ergonomic Task Chair", ProductType.GOODS, "Seating", 5200, 8900, 18),
    ("Wooden Dining Chair", ProductType.GOODS, "Seating", 1400, 2600, 12),
    ("Two-Seater Sofa", ProductType.GOODS, "Seating", 18000, 31500, 18),
    ("Three-Seater Sofa", ProductType.GOODS, "Seating", 24000, 42000, 18),
    ("Recliner Armchair", ProductType.GOODS, "Seating", 15500, 27000, 18),
    ("Wooden Dining Table", ProductType.GOODS, "Tables", 12000, 21000, 18),
    ("Glass Coffee Table", ProductType.GOODS, "Tables", 6400, 11200, 18),
    ("Study Desk", ProductType.GOODS, "Tables", 5800, 9900, 18),
    ("Conference Table 8ft", ProductType.GOODS, "Tables", 28000, 47000, 18),
    ("Side Table", ProductType.GOODS, "Tables", 2100, 3900, 12),
    ("Four-Door Wardrobe", ProductType.GOODS, "Storage", 22000, 38500, 18),
    ("Two-Door Wardrobe", ProductType.GOODS, "Storage", 14000, 24500, 18),
    ("Bookshelf 5-Tier", ProductType.GOODS, "Storage", 4600, 8200, 12),
    ("Shoe Rack", ProductType.GOODS, "Storage", 1800, 3400, 12),
    ("Filing Cabinet", ProductType.GOODS, "Storage", 7200, 12500, 18),
    ("Queen Bed Frame", ProductType.GOODS, "Bedroom", 19000, 33000, 18),
    ("King Bed Frame", ProductType.GOODS, "Bedroom", 24500, 42500, 18),
    ("Bedside Table", ProductType.GOODS, "Bedroom", 2300, 4300, 12),
    ("Dressing Table", ProductType.GOODS, "Bedroom", 8900, 15400, 18),
    ("Workstation Cubicle", ProductType.GOODS, "Office", 16500, 28000, 18),
    ("Reception Counter", ProductType.GOODS, "Office", 21000, 36000, 18),
    ("Assembly & Installation", ProductType.SERVICE, "Services", 0, 1500, 18),
    ("Annual Maintenance", ProductType.SERVICE, "Services", 0, 4500, 18),
    ("Office Setup Package", ProductType.COMBO, "Office", 45000, 78000, 18),
]

# Businesses read as vendors, individuals as customers — the mix the statement
# names (Azure Furniture, Nimesh Pathak) rather than twenty identical rows.
VENDOR_NAMES = [
    "Azure Furniture Pvt Ltd", "Rahul Sharma Timber", "Deccan Woodworks",
    "Sagar Plywood & Boards", "Kraft Upholstery Co", "Metro Hardware Supplies",
    "Nandi Foam Industries",
]
CUSTOMER_NAMES = [
    "Nimesh Pathak", "Ananya Desai", "Vikram Joshi", "Priya Menon",
    "Rohan Kulkarni", "Sneha Iyer", "Karthik Reddy", "Meera Bose",
    "Aditya Rathva", "Divya Nair", "Manish Kapoor", "Shreya Deshmukh",
]
BOTH_NAMES = ["Urban Interiors LLP", "Skyline Contract Furnishing"]

ANALYTIC_ACCOUNTS = [
    ("Retail Showroom", AnalyticType.INCOME),
    ("Corporate Projects", AnalyticType.INCOME),
    ("Online Channel", AnalyticType.INCOME),
    ("Raw Material Purchase", AnalyticType.EXPENSE),
    ("Showroom Operations", AnalyticType.EXPENSE),
    ("Logistics", AnalyticType.EXPENSE),
]


def _ns(**kwargs) -> SimpleNamespace:
    """A stand-in for a request schema, so the seed can call the same service
    functions the routers do without importing pydantic models."""
    return SimpleNamespace(**kwargs)


def seed_categories(db: Session) -> dict[str, ProductCategory]:
    out: dict[str, ProductCategory] = {}
    for name in CATEGORIES:
        row = db.execute(
            select(ProductCategory).where(ProductCategory.name == name)
        ).scalar_one_or_none()
        if row is None:
            row = ProductCategory(name=name)
            db.add(row)
        out[name] = row
    db.commit()
    return out


def seed_products(
    db: Session, categories: dict[str, ProductCategory], accounts: dict[str, Account]
) -> list[Product]:
    """Every product carries its income and expense account.

    Without them a document cannot post at all — it raises
    MISSING_ACCOUNT_MAPPING — so the seed sets them rather than leaving a
    catalogue that looks complete and fails on the first Post.
    """
    income, expense = accounts["4000"], accounts["5000"]
    out: list[Product] = []
    for name, ptype, category, cost, sale, tax in PRODUCTS:
        row = db.execute(select(Product).where(Product.name == name)).scalar_one_or_none()
        if row is None:
            row = Product(
                name=name,
                type=ptype,
                category_id=categories[category].id,
                cost_price=Decimal(cost),
                sales_price=Decimal(sale),
                sales_tax_pct=Decimal(tax),
                income_account_id=income.id,
                expense_account_id=expense.id,
            )
            db.add(row)
        out.append(row)
    db.commit()
    return out


def seed_contacts(db: Session, accounts: dict[str, Account], gen: Gen) -> list[Contact]:
    """Contacts carry the receivable/payable accounts their documents post to."""
    debtors, creditors = accounts["1100"], accounts["2000"]
    existing = db.execute(select(Contact)).scalars().all()
    if existing:
        return existing

    out: list[Contact] = []
    plan = (
        [(n, ContactType.VENDOR) for n in VENDOR_NAMES]
        + [(n, ContactType.CUSTOMER) for n in CUSTOMER_NAMES]
        # At least one contact who is BOTH — the statement allows it and the
        # edge case is worth being able to demo.
        + [(n, ContactType.BOTH) for n in BOTH_NAMES]
    )
    for name, ctype in plan:
        city, state, _code, _lat, _lng = gen.city()
        out.append(
            Contact(
                name=name,
                type=ctype,
                email=gen.email(name if " " in name else f"{name} office"),
                mobile=gen.phone(),
                address_street=f"{gen.rng.randint(1, 240)}, "
                f"{gen.rng.choice(['MG Road', 'Ring Road', 'Industrial Estate', 'Market Lane'])}",
                address_city=city,
                address_state=state,
                address_country="India",
                address_pincode=str(gen.rng.randint(110001, 799999)),
                receivable_account_id=debtors.id,
                payable_account_id=creditors.id,
            )
        )
    db.add_all(out)
    db.commit()
    return out


def seed_analytic_accounts(db: Session) -> list[AnalyticAccount]:
    out: list[AnalyticAccount] = []
    for name, atype in ANALYTIC_ACCOUNTS:
        row = db.execute(
            select(AnalyticAccount).where(AnalyticAccount.name == name)
        ).scalar_one_or_none()
        if row is None:
            row = AnalyticAccount(name=name, type=atype)
            db.add(row)
        out.append(row)
    db.commit()
    return out


def seed_portal_user(db: Session, contacts: list[Contact]) -> User | None:
    """One contact gets a portal login, so the scoping rule can be demonstrated
    rather than only described."""
    from app.core.security import hash_password
    from app.core.settings import get_settings

    settings = get_settings()
    role = db.execute(select(Role).where(Role.name == "User")).scalar_one_or_none()
    if role is None:
        return None

    customer = next((c for c in contacts if c.type is ContactType.CUSTOMER), None)
    if customer is None:
        return None

    email = "portal@urbanfurniture.in"
    existing = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
    if existing is not None:
        return existing

    user = User(
        email=email,
        full_name=customer.name,
        password_hash=hash_password(settings.seed_password),
        role_id=role.id,
        login_id="portal01",
        contact_id=customer.id,
    )
    db.add(user)
    db.commit()
    return user


def seed_transactions(
    db: Session,
    contacts: list[Contact],
    products: list[Product],
    analytics: list[AnalyticAccount],
    gen: Gen,
    actor_id: str | None,
) -> dict[str, int]:
    """A month of trading, built through the service layer.

    The mix is chosen so every status in both chains is visible on screen without
    anyone having to create one during the demo: draft and confirmed orders,
    posted invoices, one partially paid, several fully paid, and one left open
    past its due date.
    """
    customers = [c for c in contacts if c.type in (ContactType.CUSTOMER, ContactType.BOTH)]
    vendors = [c for c in contacts if c.type in (ContactType.VENDOR, ContactType.BOTH)]
    income_tags = [a for a in analytics if a.type is AnalyticType.INCOME]
    expense_tags = [a for a in analytics if a.type is AnalyticType.EXPENSE]
    sellable = [p for p in products if p.sales_price > 0]
    # Services are sold, not bought — their cost_price is 0, and a purchase line
    # at zero would post nothing. Buying only what has a cost keeps the seeded
    # purchase side realistic as well as postable.
    purchasable = [p for p in products if p.cost_price > 0]

    counts = {
        "sales_orders": 0, "customer_invoices": 0,
        "purchase_orders": 0, "vendor_bills": 0, "payments": 0,
    }
    today = utc_now().date()

    def lines(pool, tags, count: int) -> list:
        return [
            _ns(
                product_id=gen.rng.choice(pool).id,
                quantity=Decimal(gen.rng.randint(1, 6)),
                unit_price=None,      # snapshot from the product
                tax_pct=None,         # snapshot from the product
                account_id=None,
                analytic_account_id=gen.rng.choice(tags).id if tags else None,
            )
            for _ in range(count)
        ]

    # ── Sales: 40 orders, most invoiced, most of those paid ───────────────────
    for i in range(40):
        order_date = today - timedelta(days=gen.rng.randint(1, 75))
        order = doc_svc.create_sales_order(
            db,
            _ns(
                customer_id=gen.rng.choice(customers).id,
                order_date=order_date,
                reference=f"SO-REF-{1000 + i}",
                lines=lines(sellable, income_tags, gen.rng.randint(1, 4)),
            ),
        )
        db.commit()
        counts["sales_orders"] += 1

        if i % 10 == 0:          # a few stay DRAFT so that status is visible
            continue
        doc_svc.confirm_sales_order(db, order.id)
        db.commit()
        if i % 7 == 0:           # a few stop at CONFIRMED
            continue

        invoice = doc_svc.create_invoice_from_so(db, order.id)
        invoice.due_date = order_date + timedelta(days=30)
        db.commit()
        counts["customer_invoices"] += 1

        doc_svc.post_customer_invoice(db, invoice.id, actor_id=actor_id)
        db.commit()

        if i % 9 == 3:
            # Left unpaid and past due, so the overdue state is demonstrable.
            continue
        if i % 9 == 5:
            # Deliberately PARTIAL — pay 40% of the total.
            part = (Decimal(invoice.total) * Decimal("0.4")).quantize(Decimal("0.01"))
            _pay(db, invoice_id=invoice.id, amount=part, gen=gen, actor_id=actor_id,
                 when=order_date + timedelta(days=gen.rng.randint(2, 20)))
            counts["payments"] += 1
            continue

        _pay(db, invoice_id=invoice.id, amount=Decimal(invoice.total), gen=gen,
             actor_id=actor_id, when=order_date + timedelta(days=gen.rng.randint(2, 25)))
        counts["payments"] += 1

    # ── Purchases: 30 orders, most billed and paid ────────────────────────────
    for i in range(30):
        order_date = today - timedelta(days=gen.rng.randint(1, 75))
        order = doc_svc.create_purchase_order(
            db,
            _ns(
                vendor_id=gen.rng.choice(vendors).id,
                order_date=order_date,
                reference=f"PO-REF-{2000 + i}",
                lines=lines(purchasable, expense_tags, gen.rng.randint(1, 3)),
            ),
        )
        db.commit()
        counts["purchase_orders"] += 1

        if i % 8 == 0:
            continue
        doc_svc.confirm_purchase_order(db, order.id)
        db.commit()
        if i % 6 == 0:
            continue

        bill = doc_svc.create_bill_from_po(db, order.id)
        bill.due_date = order_date + timedelta(days=30)
        db.commit()
        counts["vendor_bills"] += 1

        doc_svc.post_vendor_bill(db, bill.id, actor_id=actor_id)
        db.commit()

        if i % 7 == 2:
            continue
        if i % 7 == 4:
            part = (Decimal(bill.total) * Decimal("0.5")).quantize(Decimal("0.01"))
            _pay(db, bill_id=bill.id, amount=part, gen=gen, actor_id=actor_id,
                 when=order_date + timedelta(days=gen.rng.randint(2, 20)))
            counts["payments"] += 1
            continue

        _pay(db, bill_id=bill.id, amount=Decimal(bill.total), gen=gen,
             actor_id=actor_id, when=order_date + timedelta(days=gen.rng.randint(2, 25)))
        counts["payments"] += 1

    return counts


def _pay(db: Session, *, gen: Gen, actor_id, amount, when, invoice_id=None, bill_id=None):
    """Register one payment through the payment service, split across Bank and
    Cash so both journals carry real activity."""
    from app.models.masters import Journal, JournalType

    journal_type = JournalType.BANK if gen.maybe(0.7) else JournalType.CASH
    journal = db.execute(
        select(Journal).where(Journal.type == journal_type)
    ).scalars().first()

    pay_svc.register_payment(
        db,
        _ns(
            invoice_id=invoice_id,
            bill_id=bill_id,
            journal_id=journal.id if journal else None,
            amount=amount,
            payment_date=when,
            note=gen.rng.choice(
                ["UPI ref " + str(gen.rng.randint(1000, 9999)), "NEFT", "Cheque", None]
            ),
        ),
        idempotency_key=f"seed-{invoice_id or bill_id}-{when}-{amount}",
        actor_id=actor_id,
    )
    db.commit()


def seed_budgets(
    db: Session, contacts: list[Contact], analytics: list[AnalyticAccount], gen: Gen
) -> int:
    """Two budgets: one comfortably inside plan, one deliberately over it.

    A budget nobody has exceeded cannot demonstrate the variance colour, which is
    the whole point of the report.
    """
    if db.execute(select(Budget)).scalars().first() is not None:
        return 0

    today = utc_now().date()
    start = today.replace(day=1) - timedelta(days=90)
    end = today + timedelta(days=30)
    responsible = contacts[0] if contacts else None

    by_name = {a.name: a for a in analytics}

    created = 0
    for name, allocations, state in (
        (
            "FY Retail Plan",
            {"Retail Showroom": 900000, "Online Channel": 250000},
            BudgetState.CONFIRMED,
        ),
        (
            # Under-funded on purpose: actual spend will exceed this.
            "Procurement Budget",
            {"Raw Material Purchase": 120000, "Logistics": 40000},
            BudgetState.CONFIRMED,
        ),
        (
            "Showroom Refit (draft)",
            {"Showroom Operations": 300000},
            BudgetState.DRAFT,
        ),
    ):
        budget = Budget(
            name=name,
            period_start=start,
            period_end=end,
            responsible_id=responsible.id if responsible else None,
            state=state,
        )
        db.add(budget)
        db.flush()
        budget.lines = [
            BudgetLine(
                budget_id=budget.id,
                analytic_account_id=by_name[tag].id,
                committed_amount=Decimal(amount),
            )
            for tag, amount in allocations.items()
            if tag in by_name
        ]
        created += 1
    db.commit()
    return created


def archive_demo_account(db: Session) -> bool:
    """Archive one unused account so the posting rejection can be demonstrated.

    `Other Expense` is chosen because nothing in the seeded trading uses it —
    archiving an account that already carries postings would be a fine thing to
    do (history is untouched) but a confusing thing to demo.
    """
    account = db.execute(select(Account).where(Account.code == "5100")).scalar_one_or_none()
    if account is None or account.is_archived:
        return False
    account.is_archived = True
    db.commit()
    return True


def seed_domain(db: Session, accounts: dict[str, Account], actor_id: str | None,
                gen: Gen) -> dict[str, int]:
    """Everything above, in dependency order."""
    categories = seed_categories(db)
    products = seed_products(db, categories, accounts)
    contacts = seed_contacts(db, accounts, gen)
    analytics = seed_analytic_accounts(db)
    seed_portal_user(db, contacts)

    counts = {
        "categories": len(categories),
        "products": len(products),
        "contacts": len(contacts),
        "analytic_accounts": len(analytics),
    }

    try:
        counts.update(
            seed_transactions(db, contacts, products, analytics, gen, actor_id)
        )
    except AppError as exc:
        # The seed goes through the same services the API does, so a business
        # rule failing here is a real bug, not a seeding quirk. Say so loudly
        # rather than shipping a half-populated database that looks fine.
        db.rollback()
        logger.error("Seeding transactions hit a business rule: %s — %s",
                     exc.code, exc.message)
        raise

    counts["budgets"] = seed_budgets(db, contacts, analytics, gen)
    counts["archived_accounts"] = int(archive_demo_account(db))
    return counts
