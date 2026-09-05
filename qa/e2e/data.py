"""Real-world test data for the Account module's 7 screens.

Not "Test User 1 / Test Product 2" — the same standard `docs/PROBLEM_STATEMENT.md`
holds the app to ("a judge scrolling a table of Test User 1/2 reads it as
unfinished," `backend/src/app/seed/generators.py`). Every name below is either
lifted straight from the official problem statement's own worked examples
(Azure Furniture, Nimesh Pathak, Office/Wooden furniture) or is a plausible
extension of that same fictional business.

`run_suffix` is mixed into the handful of fields that are actually unique in the
schema (account `code`, contact `email` — see `docs/03_DATA_MODEL.md` §2) so the
suite can be re-run against the same database without a 409 on the second run.
Everything else (names, journals, budgets) is left exactly as a person would
type it, because those columns aren't unique and duplicate-looking master data
is normal in a real ledger.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime


def make_run_suffix() -> str:
    """HHMMSS — unique per run at 1-second resolution, short enough to read in a report."""
    return datetime.now().strftime("%H%M%S")


@dataclass(frozen=True)
class ChartOfAccountData:
    code: str
    name: str
    type: str  # one of the 8 AccountType values, docs/03_DATA_MODEL.md §2


@dataclass(frozen=True)
class JournalData:
    name: str
    type: str
    default_debit_account_label: str   # exact <option> text: "{code} — {name}"
    default_credit_account_label: str


@dataclass(frozen=True)
class ContactData:
    name: str
    type: str  # CUSTOMER | VENDOR | BOTH
    email: str
    mobile: str
    address_street: str
    address_city: str
    address_state: str
    address_country: str
    address_pincode: str


@dataclass(frozen=True)
class ProductData:
    name: str
    type: str  # GOODS | SERVICE | COMBO
    category_name: str          # created inline via the "+ New" modal
    sales_tax_pct: str
    sales_price: str
    cost_price: str
    income_account_label: str
    expense_account_label: str


@dataclass(frozen=True)
class AnalyticAccountData:
    name: str
    type: str  # INCOME | EXPENSE


@dataclass(frozen=True)
class BudgetLineData:
    analytic_account_label: str  # exact <option> text: "{name} ({type})"
    committed_amount: str


@dataclass(frozen=True)
class BudgetData:
    name: str
    responsible_contact_name: str  # matched against the Contacts dropdown by name
    period_start: str              # YYYY-MM-DD
    period_end: str
    line: BudgetLineData


@dataclass(frozen=True)
class TestDataSet:
    run_suffix: str
    chart_of_accounts: ChartOfAccountData
    journal: JournalData
    contact: ContactData
    product: ProductData
    analytic_account: AnalyticAccountData
    budget: BudgetData


def build_dataset(run_suffix: str | None = None) -> TestDataSet:
    run_suffix = run_suffix or make_run_suffix()

    chart_of_accounts = ChartOfAccountData(
        # 9xxx is unused by the seeded Chart of Accounts (1000-5100, see
        # backend/src/app/seed/seed.py) — reserved for this suite's own rows.
        code=f"91{run_suffix[-4:]}",
        name="Warehouse Rent Expense",
        type="EXPENSE",
    )

    journal = JournalData(
        name="Petty Cash Journal",
        type="CASH",
        default_debit_account_label="1000 — Cash",
        # Deliberately one of the always-pre-seeded accounts
        # (backend/src/app/seed/seed.py's own CHART_OF_ACCOUNTS, "nothing can
        # post without these existing") rather than "5100 — Other Expense" —
        # this suite's first live run found that row missing from a real dev
        # database (seed.py skips seeding once any account exists, so a DB
        # seeded before "5100" was added to the script never gets it added
        # later). Petty cash reimbursing a small purchase is a realistic
        # pairing regardless.
        default_credit_account_label="5000 — Purchase Expense",
    )

    # Vendor from the official problem statement's own Purchase use-case (§7.2):
    # "User creates a Purchase Order for Azure Furniture."
    contact = ContactData(
        name="Azure Furniture",
        type="VENDOR",
        email=f"accounts.{run_suffix}@azurefurniture.example.in",
        mobile=f"+919876{run_suffix}",  # +91 followed by a real 10-digit Indian mobile shape
        address_street="204, GIDC Industrial Estate, Phase III",
        address_city="Ahmedabad",
        address_state="Gujarat",
        address_country="India",
        address_pincode="382445",
    )

    # A plausible new SKU alongside the PS's own catalogue examples
    # (Office Chair, Wooden Table, Sofa, Dining Table).
    product = ProductData(
        name="Recliner Sofa (3-Seater)",
        type="GOODS",
        category_name="Living Room Furniture",
        sales_tax_pct="18",   # GST — the same default the product form ships with
        sales_price="24999.00",
        cost_price="16500.00",
        income_account_label="4000 — Sales Income",
        expense_account_label="5000 — Purchase Expense",
    )

    analytic_account = AnalyticAccountData(
        name="New Store Launch – Ahmedabad",
        type="EXPENSE",
    )

    budget = BudgetData(
        name="FY26 Q3 Store Expansion Budget",
        responsible_contact_name=contact.name,  # chains onto the contact created above
        period_start="2026-10-01",
        period_end="2026-12-31",
        line=BudgetLineData(
            analytic_account_label=f"{analytic_account.name} ({analytic_account.type})",
            committed_amount="250000.00",
        ),
    )

    return TestDataSet(
        run_suffix=run_suffix,
        chart_of_accounts=chart_of_accounts,
        journal=journal,
        contact=contact,
        product=product,
        analytic_account=analytic_account,
        budget=budget,
    )
