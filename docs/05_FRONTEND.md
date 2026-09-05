# 05 — FRONTEND PLAYBOOK

> **Owner:** Frontend Core (+ Frontend/Pitch for dashboard, reports & the portal).
> **The product is an accounting system.** It should feel precise, dense and trustworthy —
> not airy and marketing-shaped. Numbers are the content.

---

## 1. NON-NEGOTIABLES (these are literally scored)

| Criterion | What it means concretely |
|---|---|
| Consistent colour & layout | Every colour and space comes from `design-system.css`. **No hardcoded hex, no arbitrary px.** Re-theme by changing `--accent-h` only. |
| Responsive | Works at **360 / 768 / 1280**. Zero horizontal page scroll — wide tables scroll inside `.table-scroll`, never the body. |
| Robust validation | Inline errors via `<Field>`. Never browser-default popups. Client rules mirror server rules. |
| Intuitive navigation | Persistent sidebar, `aria-current` active state, generous spacing. |

---

## 2. THE SCREEN INVENTORY

Sidebar grouping mirrors the mental model of the domain, not the table list:

```
Dashboard
Master Data ──── Contacts · Products · Chart of Accounts
                 Journals · Analytic Accounts
Purchases ────── Purchase Orders · Vendor Bills
Sales ────────── Sales Orders · Customer Invoices
Payments
Accounting ───── Journal Entries (ledger explorer)
Reports ──────── Balance Sheet · Profit & Loss · Budget · Trial Balance
Budgets
```

The **Contact portal is a separate shell** — its own layout, its own two routes
(`My Documents`, `Pay`), no sidebar into the internal app. A contact must never see an
internal nav item, even disabled.

**Build order.** One list + one form + one detail, done properly, becomes the template for
the other eight. Get Customer Invoices right first — it is the demo path — then copy.

---

## 3. USE THE PRIMITIVES — DON'T REBUILD THEM

`components/ui/` already handles the accessibility details that are easy to miss:

| Component | Already handles |
|---|---|
| `<Modal>` | focus trap, Escape, `role="dialog"`, focus restore, scroll lock |
| `<Field>` | `<label for>`, `aria-invalid`, `aria-describedby`, `role="alert"` |
| `<SortableTh>` | `aria-sort` (screen readers can't see the ▲ glyph) |
| `<Tabs>` | `role="tablist"/"tab"`, arrow keys, roving tabindex |
| `<SearchInput>` | a real accessible label (a placeholder is not a label) |
| `<AsyncState>` | loading / error / empty / content — no blank boxes on failure |
| `<StatusBadge>` | colour **plus** a dot **plus** text, never colour alone |
| `<Pagination>` | uses `total`, not `items.length` |

Hand-rolling a second modal is how half your dialogs end up inaccessible.

---

## 4. MONEY, THE HOUSE RULES

This is an accounting UI. Getting numbers wrong on screen is the most visible failure mode
available to us.

- **Right-align every currency and quantity column.** Left-aligned money is unreadable.
- **`font-variant-numeric: tabular-nums`** on every numeric cell, so digits form columns.
- **Always two decimals**, always the ₹ symbol, always grouped (`₹1,25,000.00`). Use the
  shared helper in `lib/format.ts` — never `toFixed()` inline.
- **Never do money arithmetic in JavaScript.** Totals, tax and balances arrive computed
  from the server. Floating-point drift in a browser is how a demo shows `₹999.9999999`.
- **Debits and credits sit in two separate columns**, never one signed column. That is how
  accountants read a ledger, and it makes an unbalanced entry obvious at a glance.
- **Negative or over-budget figures** use the semantic danger token *and* a sign — colour
  alone fails for colour-blind viewers and in print.

---

## 5. THE PAGE PATTERN

```tsx
const [page, setPage] = useState(1);
const [search, setSearch] = useState("");
const [sort, setSort] = useState<string | null>("-invoice_date");

const debouncedSearch = useDebouncedValue(search, 300);   // ← always debounce

const invoices = useFetch(
  () => api.customerInvoices.list({ page, q: debouncedSearch, sort: sort ?? undefined }),
  [page, debouncedSearch, sort],                          // ← debounced value in deps
);

useEventStream({
  "document.posted":     () => invoices.reload(),
  "payment.registered":  () => invoices.reload(),
});
```

Then render through `<AsyncState>`, and put `<Pagination>` under the table using
`data.total` / `data.pages`.

**Two traps that cost us last time:**
1. Passing the raw (undebounced) search into deps → one API call per keystroke, plus
   out-of-order responses that flicker stale data back onto the screen.
2. Using `items.length` for a "Total X" tile → silently wrong past the first page.
   Use `data.total`.

---

## 6. THE DRILL-DOWN — our one "wow", so it has to feel instant

Every figure on a report is a link:

```
Balance Sheet  →  Debtors ₹2,50,000
                     ↓ click
                  Account 1100 — the journal lines that make it up
                     ↓ click a line
                  Customer Invoice INV/2026/00042
```

Rules that make it feel real rather than bolted on:
- The trail is **breadcrumbed**, and every level is a real URL you can reload and share.
- The line you arrived from is **highlighted** on the destination screen.
- Back always returns to the same scroll position.
- The **`Trial balance 0.00 ✓`** badge lives in the app shell, visible on every screen, and
  updates over SSE on `ledger.changed`. If it ever goes red, something real is wrong —
  do not hide it, and never fake it green.

---

## 7. FORMS

```tsx
const result = validate(invoiceSchema, formValues);
if (!result.ok) { setErrors(result.errors); return; }
try {
  await api.customerInvoices.create(result.data);
} catch (error) {
  setErrors(fieldErrorsFrom(error));      // server errors land in the SAME slots
  setFormError(formMessageFrom(error));
}
```

Because client and server errors are both `{field: message}`, one set of UI slots renders
both. Show a form-level `.alert-danger` for the message, inline `<Field>` errors for the
fields.

**Document line editors** (invoice/bill/order lines) are the hardest form in this app:
- Adding a line must not lose focus or reset the row above it.
- Quantity and price changes recompute the **display** total immediately, but the
  authoritative total comes back from the server on save.
- Deleting the last line is allowed; saving with zero lines is not — that is a
  client-side rule mirroring the server's.

**Posting is destructive-ish and irreversible** — a posted document cannot be edited. Put
it behind a confirm dialog that says what will happen, in those words.

---

## 8. RESPONSIVE CHECKLIST (run before every merge)

- [ ] 360px: no horizontal scroll, nothing clipped, tap targets ≥ 40px
- [ ] 768px: sidebar collapses sensibly, tables scroll inside their container
- [ ] 1280px: content doesn't stretch into unreadable line lengths
- [ ] Dark **and** light both legible — check both, they're both shipped
- [ ] Tab through the page: focus is always visible, and never trapped outside a modal
- [ ] Wide report tables scroll inside `.table-scroll`, and the totals row stays readable

---

## 9. NOT LOOKING TEMPLATED

The design system's neutrals are deliberately hue-biased toward the accent so the greys
read as chosen rather than default, and semantic colours are kept separate from the accent.

**For this domain**, set `--accent-h` to something with financial gravity — a deep ledger
green or an ink blue — and keep the accent off the numbers. Semantic red/green belong to
*variance and status*, not to the brand; if the accent is also green, an over-budget figure
stops reading as a warning.

Installed skills that help: `design-taste-frontend`, `web-design-guidelines`,
`emil-design-eng`. See [`11_AI_TOOLING.md`](11_AI_TOOLING.md).
