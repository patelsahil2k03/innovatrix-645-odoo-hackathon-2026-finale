/**
 * Typed API client.
 *
 * The auth token lives in an httpOnly cookie the browser sends automatically —
 * this file never touches a token, which is why an XSS bug can't steal the session.
 * That's also why every request sets `credentials: "include"`.
 *
 * Domain shapes mirror docs/03_DATA_MODEL.md and docs/04_API_CONTRACT.md exactly —
 * those documents change before this file does (RULES.md §4), never the other way.
 */

/**
 * Relative on purpose. `next.config.ts` proxies `/api/*` to this machine's own
 * backend, so the browser only ever talks to the origin that served the page:
 * open localhost:3000 and you hit your own API, open <host-ip>:3000 and you hit
 * that host's. Nothing about the API's address is baked into the bundle.
 *
 * Only set NEXT_PUBLIC_API_URL to point somewhere else deliberately (a deployed
 * API, a tunnel). Pointing it at a hostname other than the one serving the page
 * makes the session cookie third-party, which some networks and browsers drop.
 */
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";

/** The server's error envelope: {error: {code, message, fields}} */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly fields: Record<string, string>;

  constructor(status: number, code: string, message: string, fields: Record<string, string> = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export interface Page<T> {
  items: T[];
  /** Count of ALL matching rows. Use THIS for "total X" tiles — never items.length,
   *  which is only the current page. (Real bug from the last hackathon.) */
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface ListParams {
  page?: number;
  page_size?: number;
  sort?: string;
  q?: string;
  [key: string]: string | number | boolean | undefined;
}

function buildQuery(params: ListParams = {}): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
  } catch {
    // Network-level failure: the API isn't running, or CORS blocked it. Say so
    // plainly — a bare "Failed to fetch" in a toast tells the user nothing.
    throw new ApiError(0, "NETWORK_ERROR", "Cannot reach the server. Is the API running?");
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const body = text ? safeJson(text) : null;

  if (!response.ok) {
    const envelope = (body?.error ?? {}) as {
      code?: string;
      message?: string;
      fields?: Record<string, string>;
    };
    throw new ApiError(
      response.status,
      envelope.code ?? "UNKNOWN_ERROR",
      envelope.message ?? `Request failed (${response.status})`,
      envelope.fields ?? {},
    );
  }

  return body as T;
}

/** Parse a body that may not be JSON (a proxy error page, an empty response). */
function safeJson(text: string): Record<string, unknown> | null {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

const get = <T,>(path: string, params?: ListParams) => apiFetch<T>(path + buildQuery(params));
const post = <T,>(path: string, body?: unknown, init: RequestInit = {}) =>
  apiFetch<T>(path, { ...init, method: "POST", body: body ? JSON.stringify(body) : undefined });
const patch = <T,>(path: string, body: unknown) =>
  apiFetch<T>(path, { method: "PATCH", body: JSON.stringify(body) });
const del = <T,>(path: string) => apiFetch<T>(path, { method: "DELETE" });

/* ── Platform types (given) ────────────────────────────────────────────────── */

export interface Role {
  id: string;
  name: string;
  description: string | null;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  role: Role;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  entity_name: string;
  entity_id: string | null;
  status_code: number;
  created_at: string;
}

/* ── Domain types — docs/03_DATA_MODEL.md ──────────────────────────────────── */

export type ContactType = "CUSTOMER" | "VENDOR" | "BOTH";

export interface Contact {
  id: string;
  name: string;
  type: ContactType;
  email: string | null;
  mobile: string | null;
  address_street: string | null;
  address_city: string | null;
  address_state: string | null;
  address_country: string;
  address_pincode: string | null;
  image_url: string | null;
  receivable_account_id: string | null;
  payable_account_id: string | null;
  is_archived: boolean;
  created_at: string;
}
export type ContactCreate = Omit<Contact, "id" | "is_archived" | "created_at">;

export type ProductType = "GOODS" | "SERVICE" | "COMBO";

export interface ProductCategory {
  id: string;
  name: string;
  is_archived: boolean;
}

export interface Product {
  id: string;
  name: string;
  type: ProductType;
  sales_price: number;
  cost_price: number;
  category_id: string | null;
  category_name?: string;
  sales_tax_pct: number;
  income_account_id: string | null;
  expense_account_id: string | null;
  image_url?: string | null;
  is_archived: boolean;
}
export type ProductCreate = Omit<Product, "id" | "category_name" | "is_archived">;

export type AccountType =
  | "ASSET"
  | "BANK"
  | "CASH"
  | "LIABILITY"
  | "CAPITAL"
  | "INCOME"
  | "EXPENSE"
  | "OTHER_EXPENSE";

export interface Account {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  is_archived: boolean;
}
export type AccountCreate = Omit<Account, "id" | "is_archived">;

export type JournalType = "SALES" | "PURCHASE" | "BANK" | "CASH" | "MISC";

export interface Journal {
  id: string;
  name: string;
  type: JournalType;
  default_debit_account_id: string | null;
  default_credit_account_id: string | null;
  is_archived: boolean;
}
export type JournalCreate = Omit<Journal, "id" | "is_archived">;

export type AnalyticType = "INCOME" | "EXPENSE";

export interface AnalyticAccount {
  id: string;
  name: string;
  type: AnalyticType;
  is_archived: boolean;
}
export type AnalyticAccountCreate = Omit<AnalyticAccount, "id" | "is_archived">;

/** A document line as drawn on every order/bill/invoice screen. */
export interface DocumentLine {
  id?: string;
  product_id: string;
  product_name?: string;
  analytic_account_id?: string | null;
  account_id?: string;
  quantity: number;
  unit_price: number;
  tax_pct: number;
}

export type PurchaseOrderStatus = "DRAFT" | "CONFIRMED" | "BILLED" | "CANCELLED";
export type VendorBillStatus = "DRAFT" | "POSTED" | "PARTIAL" | "PAID" | "CANCELLED";
export type SalesOrderStatus = "DRAFT" | "CONFIRMED" | "INVOICED" | "CANCELLED";
export type CustomerInvoiceStatus = "DRAFT" | "POSTED" | "PARTIAL" | "PAID" | "CANCELLED";

interface DocumentHeader {
  id: string;
  number: string;
  reference: string | null;
}

export interface SalesOrder extends DocumentHeader {
  customer_id: string;
  customer_name?: string;
  order_date: string;
  status: SalesOrderStatus;
  untaxed_total: number;
  tax_total: number;
  total: number;
  lines: DocumentLine[];
}
export type SalesOrderCreate = Pick<SalesOrder, "reference" | "customer_id" | "order_date" | "lines">;
export type SalesOrderUpdate = Partial<SalesOrderCreate>;

export interface CustomerInvoice extends DocumentHeader {
  so_id: string | null;
  so_number?: string;
  customer_id: string;
  customer_name?: string;
  invoice_date: string;
  due_date: string | null;
  status: CustomerInvoiceStatus;
  untaxed_total: number;
  tax_total: number;
  total: number;
  amount_paid: number;
  journal_entry_id: string | null;
  lines: DocumentLine[];
}
export type CustomerInvoiceCreate = Pick<
  CustomerInvoice,
  "reference" | "customer_id" | "invoice_date" | "due_date" | "lines"
>;
export type CustomerInvoiceUpdate = Partial<CustomerInvoiceCreate>;

export interface PurchaseOrder extends DocumentHeader {
  vendor_id: string;
  vendor_name?: string;
  order_date: string;
  status: PurchaseOrderStatus;
  untaxed_total: number;
  tax_total: number;
  total: number;
  lines: DocumentLine[];
}
export type PurchaseOrderCreate = Pick<PurchaseOrder, "reference" | "vendor_id" | "order_date" | "lines">;
export type PurchaseOrderUpdate = Partial<PurchaseOrderCreate>;

export interface VendorBill extends DocumentHeader {
  po_id: string | null;
  po_number?: string;
  vendor_id: string;
  vendor_name?: string;
  bill_date: string;
  due_date: string | null;
  status: VendorBillStatus;
  untaxed_total: number;
  tax_total: number;
  total: number;
  amount_paid: number;
  journal_entry_id: string | null;
  lines: DocumentLine[];
}
export type VendorBillCreate = Pick<
  VendorBill,
  "reference" | "vendor_id" | "bill_date" | "due_date" | "lines"
>;
export type VendorBillUpdate = Partial<VendorBillCreate>;

export type PaymentDirection = "RECEIVE" | "SEND";

export interface Payment {
  id: string;
  number: string;
  contact_id: string;
  contact_name?: string;
  direction: PaymentDirection;
  journal_id: string;
  journal_name?: string;
  amount: number;
  payment_date: string;
  note: string | null;
  invoice_id: string | null;
  bill_id: string | null;
  document_number?: string;
}
export interface PaymentCreate {
  invoice_id?: string;
  bill_id?: string;
  direction: PaymentDirection;
  journal_id: string;
  amount: number;
  payment_date: string;
  note?: string;
}

export type BudgetState = "DRAFT" | "CONFIRMED" | "REVISED" | "CANCELLED";

export interface BudgetLine {
  id?: string;
  analytic_account_id: string;
  analytic_account_name?: string;
  type?: AnalyticType;
  committed_amount: number;
  /** Computed on read — never sent by the client. */
  achieved_amount?: number;
  achieved_pct?: number;
  amount_to_achieve?: number;
}

export interface Budget {
  id: string;
  name: string;
  period_start: string;
  period_end: string;
  responsible_id: string | null;
  responsible_name?: string;
  state: BudgetState;
  revision_of_id: string | null;
  revised_with_id: string | null;
  lines: BudgetLine[];
}
export type BudgetCreate = Pick<Budget, "name" | "period_start" | "period_end" | "responsible_id" | "lines">;
export type BudgetUpdate = Partial<BudgetCreate>;

export interface JournalEntryLine {
  id: string;
  account_id: string;
  account_code?: string;
  account_name?: string;
  analytic_account_id: string | null;
  partner_id: string | null;
  label: string | null;
  debit: number;
  credit: number;
}

export interface JournalEntry {
  id: string;
  entry_number: string;
  journal_id: string;
  journal_name?: string;
  entry_date: string;
  reference: string | null;
  state: "DRAFT" | "POSTED" | "REVERSED";
  source_type: string;
  source_id: string | null;
  reversal_of_id: string | null;
  lines: JournalEntryLine[];
}

/* ── Reports — docs/04_API_CONTRACT.md §3.8 ────────────────────────────────── */

export interface ReportAccountRow {
  account_id: string;
  account_code: string;
  account_name: string;
  balance: number;
}
export interface ReportGroup {
  label: string;
  rows: ReportAccountRow[];
  total: number;
}
export interface BalanceSheetReport {
  as_of: string;
  assets: ReportGroup;
  liabilities: ReportGroup;
  equity: ReportGroup;
  is_balanced: boolean;
}
export interface ProfitAndLossReport {
  date_from: string;
  date_to: string;
  income: ReportGroup;
  expenses: ReportGroup;
  other_expenses: ReportGroup;
  net_profit: number;
}
export interface DashboardKpisReport {
  receivables: number;
  payables: number;
  cash: number;
  net_profit: number;
  is_balanced: boolean;
  /** The accounts each figure came from, so a tile links to its own ledger. */
  receivable_account_ids: string[];
  payable_account_ids: string[];
  cash_account_ids: string[];
}
/* ── Analytics — mirrors backend/src/app/schemas/analytics.py ─────────────── */

export type ContactDirection = "customer" | "vendor";

export interface TrendPoint {
  month: string;
  /** Rendered server-side so the axis, tooltip and CSV never disagree. */
  label: string;
  income: number;
  expense: number;
  net_profit: number;
}
export interface TrendReport {
  points: TrendPoint[];
  total_income: number;
  total_expense: number;
  total_net_profit: number;
}
export interface BreakdownSlice {
  id: string;
  label: string;
  type: AnalyticType;
  amount: number;
}
export interface BreakdownReport {
  slices: BreakdownSlice[];
}
export interface RankedRow {
  id: string;
  label: string;
  amount: number;
}
export interface TopContactsReport {
  direction: ContactDirection;
  rows: RankedRow[];
}
export interface AgeingBucket {
  bucket: string;
  amount: number;
}
export interface AgeingReport {
  as_of: string;
  receivables: AgeingBucket[];
  payables: AgeingBucket[];
}

export interface TrialBalanceRow {
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
}
export interface TrialBalanceReport {
  as_of: string;
  rows: TrialBalanceRow[];
  total_debit: number;
  total_credit: number;
  difference: number;
  is_balanced: boolean;
}
export interface BudgetReportRow {
  analytic_account_id: string;
  analytic_account: string;
  type: AnalyticType;
  committed_amount: number;
  achieved_amount: number;
  achieved_pct: number;
  amount_to_achieve: number;
}
export interface BudgetReport {
  budget_id: string;
  budget_name: string;
  lines: BudgetReportRow[];
  total_committed: number;
  total_achieved: number;
  total_to_achieve: number;
}

/* ── The client ─────────────────────────────────────────────────────────────
   §3.1: all six master modules are "identical shape" per the contract, so one
   factory specifies the shape once instead of repeating CRUD six times. ── */

function masterResource<T, TCreate>(path: string) {
  return {
    list: (params?: ListParams) => get<Page<T>>(path, params),
    get: (id: string) => get<T>(`${path}/${id}`),
    create: (body: TCreate) => post<T>(path, body),
    update: (id: string, body: Partial<TCreate>) => patch<T>(`${path}/${id}`, body),
    archive: (id: string) => post<T>(`${path}/${id}/archive`),
  };
}

export const api = {
  health: () => get<{ status: string; database: string; version: string }>("/health"),

  auth: {
    login: (email: string, password: string) => post<User>("/auth/login", { email, password }),
    signup: (body: { login_id: string; email: string; full_name: string; password: string }) =>
      post<User>("/auth/signup", body),
    logout: () => post<{ ok: boolean }>("/auth/logout"),
    me: () => get<User>("/auth/me"),
  },

  notifications: {
    list: (params?: ListParams) => get<Page<Notification>>("/notifications", params),
    markAllRead: () => post<{ marked_read: number }>("/notifications/read-all"),
  },

  auditLogs: {
    list: (params?: ListParams) => get<Page<AuditLog>>("/audit-logs", params),
  },

  // ── Master data (04_API_CONTRACT.md §3.1) ────────────────────────────────
  contacts: masterResource<Contact, ContactCreate>("/contacts"),
  products: masterResource<Product, ProductCreate>("/products"),
  productCategories: {
    ...masterResource<ProductCategory, { name: string }>("/product-categories"),
    /** The product form's combobox creates one inline from a bare {name}. */
    createInline: (name: string) => post<ProductCategory>("/product-categories", { name }),
  },
  accounts: masterResource<Account, AccountCreate>("/accounts"),
  journals: masterResource<Journal, JournalCreate>("/journals"),
  analyticAccounts: masterResource<AnalyticAccount, AnalyticAccountCreate>("/analytic-accounts"),

  // ── Sales chain (§3.3) ────────────────────────────────────────────────────
  salesOrders: {
    list: (params?: ListParams) => get<Page<SalesOrder>>("/sales-orders", params),
    get: (id: string) => get<SalesOrder>(`/sales-orders/${id}`),
    create: (body: SalesOrderCreate) => post<SalesOrder>("/sales-orders", body),
    update: (id: string, body: SalesOrderUpdate) => patch<SalesOrder>(`/sales-orders/${id}`, body),
    confirm: (id: string) => post<SalesOrder>(`/sales-orders/${id}/confirm`),
    createInvoice: (id: string) => post<CustomerInvoice>(`/sales-orders/${id}/create-invoice`),
    cancel: (id: string) => post<SalesOrder>(`/sales-orders/${id}/cancel`),
  },
  customerInvoices: {
    list: (params?: ListParams) => get<Page<CustomerInvoice>>("/customer-invoices", params),
    get: (id: string) => get<CustomerInvoice>(`/customer-invoices/${id}`),
    create: (body: CustomerInvoiceCreate) => post<CustomerInvoice>("/customer-invoices", body),
    update: (id: string, body: CustomerInvoiceUpdate) => patch<CustomerInvoice>(`/customer-invoices/${id}`, body),
    post: (id: string) => post<CustomerInvoice>(`/customer-invoices/${id}/post`),
    cancel: (id: string) => post<CustomerInvoice>(`/customer-invoices/${id}/cancel`),
    send: (id: string) => post<{ queued: boolean; to: string }>(`/customer-invoices/${id}/send`),
    pdfUrl: (id: string) => `${API_BASE}/customer-invoices/${id}/pdf`,
  },

  // ── Purchase chain (§3.2) ─────────────────────────────────────────────────
  purchaseOrders: {
    list: (params?: ListParams) => get<Page<PurchaseOrder>>("/purchase-orders", params),
    get: (id: string) => get<PurchaseOrder>(`/purchase-orders/${id}`),
    create: (body: PurchaseOrderCreate) => post<PurchaseOrder>("/purchase-orders", body),
    update: (id: string, body: PurchaseOrderUpdate) => patch<PurchaseOrder>(`/purchase-orders/${id}`, body),
    confirm: (id: string) => post<PurchaseOrder>(`/purchase-orders/${id}/confirm`),
    createBill: (id: string) => post<VendorBill>(`/purchase-orders/${id}/create-bill`),
    cancel: (id: string) => post<PurchaseOrder>(`/purchase-orders/${id}/cancel`),
  },
  vendorBills: {
    list: (params?: ListParams) => get<Page<VendorBill>>("/vendor-bills", params),
    get: (id: string) => get<VendorBill>(`/vendor-bills/${id}`),
    create: (body: VendorBillCreate) => post<VendorBill>("/vendor-bills", body),
    update: (id: string, body: VendorBillUpdate) => patch<VendorBill>(`/vendor-bills/${id}`, body),
    post: (id: string) => post<VendorBill>(`/vendor-bills/${id}/post`),
    cancel: (id: string) => post<VendorBill>(`/vendor-bills/${id}/cancel`),
    send: (id: string) => post<{ queued: boolean; to: string }>(`/vendor-bills/${id}/send`),
    pdfUrl: (id: string) => `${API_BASE}/vendor-bills/${id}/pdf`,
  },

  // ── Payments (§3.4) ───────────────────────────────────────────────────────
  payments: {
    list: (params?: ListParams) => get<Page<Payment>>("/payments", params),
    create: (body: PaymentCreate, idempotencyKey: string) =>
      post<Payment>("/payments", body, { headers: { "Idempotency-Key": idempotencyKey } }),
  },

  // ── Budgets (§3.6) ────────────────────────────────────────────────────────
  budgets: {
    list: (params?: ListParams) => get<Page<Budget>>("/budgets", params),
    get: (id: string) => get<Budget>(`/budgets/${id}`),
    create: (body: BudgetCreate) => post<Budget>("/budgets", body),
    update: (id: string, body: BudgetUpdate) => patch<Budget>(`/budgets/${id}`, body),
    confirm: (id: string) => post<Budget>(`/budgets/${id}/confirm`),
    revise: (id: string) => post<Budget>(`/budgets/${id}/revise`),
    cancel: (id: string) => post<Budget>(`/budgets/${id}/cancel`),
    lineDocuments: (id: string, lineId: string, params?: ListParams) =>
      get<Page<CustomerInvoice | VendorBill>>(`/budgets/${id}/lines/${lineId}/documents`, params),
  },

  // ── The ledger — read only (§3.7) ─────────────────────────────────────────
  journalEntries: {
    list: (params?: ListParams) => get<Page<JournalEntry>>("/journal-entries", params),
    get: (id: string) => get<JournalEntry>(`/journal-entries/${id}`),
  },

  // ── Reports (§3.8) ────────────────────────────────────────────────────────
  reports: {
    balanceSheet: (asOf?: string) => get<BalanceSheetReport>("/reports/balance-sheet", { as_of: asOf }),
    profitAndLoss: (dateFrom?: string, dateTo?: string) =>
      get<ProfitAndLossReport>("/reports/profit-and-loss", { date_from: dateFrom, date_to: dateTo }),
    trialBalance: (asOf?: string) => get<TrialBalanceReport>("/reports/trial-balance", { as_of: asOf }),
    budget: (budgetId: string) => get<BudgetReport>("/reports/budget", { budget_id: budgetId }),
    kpis: () => get<DashboardKpisReport>("/reports/kpis"),
    exportUrl: (name: string, params?: ListParams) => `${API_BASE}/reports/${name}/export${buildQuery(params)}`,
    pdfUrl: (name: string, params?: ListParams) => `${API_BASE}/reports/${name}/pdf${buildQuery(params)}`,
  },

  // ── Analytics — the same ledger, reshaped for charts (§3.8) ───────────────
  analytics: {
    trend: (months = 12) => get<TrendReport>("/analytics/trend", { months }),
    breakdown: (dateFrom?: string, dateTo?: string) =>
      get<BreakdownReport>("/analytics/breakdown", { date_from: dateFrom, date_to: dateTo }),
    topContacts: (direction: ContactDirection, limit = 8) =>
      get<TopContactsReport>("/analytics/top-contacts", { direction, limit }),
    ageing: (asOf?: string) => get<AgeingReport>("/analytics/ageing", { as_of: asOf }),
  },

  // ── Customer portal — User role only (§3.9) ───────────────────────────────
  portal: {
    documents: {
      list: (params?: ListParams) =>
        get<Page<CustomerInvoice | VendorBill>>("/portal/documents", params),
      get: (id: string) => get<CustomerInvoice | VendorBill>(`/portal/documents/${id}`),
    },
    pay: (body: PaymentCreate, idempotencyKey: string) =>
      post<Payment>("/portal/payments", body, { headers: { "Idempotency-Key": idempotencyKey } }),
  },
};

export { get, post, patch, del, buildQuery, API_BASE };
