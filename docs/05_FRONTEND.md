# 05 — FRONTEND PLAYBOOK

> **Owner:** Frontend Core (+ Frontend/Pitch for dashboard & reports).

---

## 1. NON-NEGOTIABLES (these are literally scored)

| Criterion | What it means concretely |
|---|---|
| Consistent colour & layout | Every colour and space comes from `design-system.css`. **No hardcoded hex, no arbitrary px.** Re-theme by changing `--accent-h` only. |
| Responsive | Works at **360 / 768 / 1280**. Zero horizontal page scroll — wide tables scroll inside `.table-scroll`, never the body. |
| Robust validation | Inline errors via `<Field>`. Never browser-default popups. Client rules mirror server rules. |
| Intuitive navigation | Persistent sidebar, `aria-current` active state, generous spacing. |

---

## 2. USE THE PRIMITIVES — DON'T REBUILD THEM

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

## 3. THE PAGE PATTERN

```tsx
const [page, setPage] = useState(1);
const [search, setSearch] = useState("");
const [sort, setSort] = useState<string | null>("-created_at");

const debouncedSearch = useDebouncedValue(search, 300);   // ← always debounce

const orders = useFetch(
  () => api.orders.list({ page, q: debouncedSearch, sort: sort ?? undefined }),
  [page, debouncedSearch, sort],                          // ← debounced value in deps
);

useEventStream({ "order.activated": () => orders.reload() });
```

Then render through `<AsyncState>`, and put `<Pagination>` under the table using
`data.total` / `data.pages`.

**Two traps that cost us last time:**
1. Passing the raw (undebounced) search into deps → one API call per keystroke, plus
   out-of-order responses that flicker stale data back onto the screen.
2. Using `items.length` for a "Total X" tile → silently wrong past the first page.
   Use `data.total`.

---

## 4. FORMS

```tsx
const result = validate(orderSchema, formValues);
if (!result.ok) { setErrors(result.errors); return; }
try {
  await api.orders.create(result.data);
} catch (error) {
  setErrors(fieldErrorsFrom(error));      // server errors land in the SAME slots
  setFormError(formMessageFrom(error));
}
```
Because client and server errors are both `{field: message}`, one set of UI slots
renders both. Show a form-level `.alert-danger` for the message, inline `<Field>`
errors for the fields.

---

## 5. RESPONSIVE CHECKLIST (run before every merge)

- [ ] 360px: no horizontal scroll, nothing clipped, tap targets ≥ 40px
- [ ] 768px: sidebar collapses sensibly, tables scroll inside their container
- [ ] 1280px: content doesn't stretch into unreadable line lengths
- [ ] Dark **and** light both legible — check both, they're both shipped
- [ ] Tab through the page: focus is always visible, and never trapped outside a modal

---

## 6. NOT LOOKING TEMPLATED

The design system's neutrals are deliberately hue-biased toward the accent so the
greys read as chosen rather than default, and semantic colours are kept separate from
the accent. To make it yours in two minutes: change `--accent-h` (and `--accent-s`)
to something that fits the problem domain — logistics blue, finance green, safety
amber. Everything else re-derives.

Installed skills that help: `design-taste-frontend`, `web-design-guidelines`,
`emil-design-eng`. See `11_AI_TOOLING.md`.
