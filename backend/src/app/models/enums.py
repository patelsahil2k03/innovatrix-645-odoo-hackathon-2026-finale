import enum


class ContactType(str, enum.Enum):
    CUSTOMER = "CUSTOMER"
    VENDOR = "VENDOR"
    BOTH = "BOTH"


class ProductType(str, enum.Enum):
    GOODS = "GOODS"
    SERVICE = "SERVICE"
    COMBO = "COMBO"


class AccountType(str, enum.Enum):
    ASSET = "ASSET"
    BANK = "BANK"
    CASH = "CASH"
    LIABILITY = "LIABILITY"
    CAPITAL = "CAPITAL"
    INCOME = "INCOME"
    EXPENSE = "EXPENSE"
    OTHER_EXPENSE = "OTHER_EXPENSE"


DEBIT_POSITIVE_TYPES = {
    AccountType.ASSET,
    AccountType.BANK,
    AccountType.CASH,
    AccountType.EXPENSE,
    AccountType.OTHER_EXPENSE,
}
CREDIT_POSITIVE_TYPES = {AccountType.LIABILITY, AccountType.CAPITAL, AccountType.INCOME}


class JournalType(str, enum.Enum):
    SALES = "SALES"
    PURCHASE = "PURCHASE"
    BANK = "BANK"
    CASH = "CASH"
    MISC = "MISC"


class AnalyticType(str, enum.Enum):
    INCOME = "INCOME"
    EXPENSE = "EXPENSE"


class BudgetState(str, enum.Enum):
    DRAFT = "DRAFT"
    CONFIRMED = "CONFIRMED"
    REVISED = "REVISED"
    CANCELLED = "CANCELLED"


class EntryState(str, enum.Enum):
    DRAFT = "DRAFT"
    POSTED = "POSTED"
    REVERSED = "REVERSED"


class DocStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    CONFIRMED = "CONFIRMED"
    POSTED = "POSTED"
    PARTIAL = "PARTIAL"
    PAID = "PAID"
    BILLED = "BILLED"
    INVOICED = "INVOICED"
    CANCELLED = "CANCELLED"


class PaymentDirection(str, enum.Enum):
    RECEIVE = "RECEIVE"
    SEND = "SEND"
