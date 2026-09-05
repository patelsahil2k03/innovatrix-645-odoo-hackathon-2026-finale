# Frontend

Next.js 16 (App Router) · React 19 · TypeScript 5 · Tailwind v4 · Zod
Hand-rolled design tokens in `src/app/design-system.css`.

## Run

```bash
npm install
npm run dev          # http://localhost:3000
```

The backend must be running and seeded first, or every screen shows its error state —
this app only ever talks to the real API, never to mock data.

```bash
npm run build        # must stay green before merging
npm run lint         # separate step: Next 16 removed `next lint` and the eslint config key
npm run typecheck
```

## Environment

`frontend/.env.local` (generated from the root `.env` by `scripts/dev.sh`):

```
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

## Layout

```
src/
├── app/
│   ├── design-system.css   ★ every colour, space and size. Lock it early.
│   ├── layout.tsx          AuthProvider + pre-paint theme script
│   ├── page.tsx            dashboard  ← ★ replace with your KPIs
│   └── login/page.tsx
├── components/
│   ├── shell/              sidebar + topbar
│   └── ui/                 accessible primitives — use these, don't rewrite them
└── lib/
    ├── api.ts              typed client; unwraps the error envelope into ApiError
    ├── auth-context.tsx    session + route gating
    ├── use-fetch.ts        loading/error/data for a page's main call
    ├── use-debounced-value.ts   ← use for EVERY search input
    ├── use-event-stream.ts SSE subscription (live updates)
    ├── use-paged-rows.ts   client-side paging for small in-memory lists
    ├── validation.ts       Zod schemas; errors keyed like the API's
    ├── roles.ts            UI-only permission helpers
    ├── format.ts           money / date / number formatting
    └── theme.ts            light + dark, no flash on load
```

## Conventions

- **Tokens only.** No hardcoded colours or arbitrary pixel values — everything comes
  from `design-system.css`. Re-theme by changing `--accent-h`.
- **Use `components/ui/`.** Those primitives already handle focus traps, `aria-sort`,
  tab roles and error wiring. Hand-rolling a second modal loses all of it.
- **Debounce every search box** (`useDebouncedValue`) and pass the *debounced* value
  into the fetch dependencies.
- **Totals come from `data.total`**, never `items.length` — `items` is one page.
- **RBAC here is UI convenience only.** The server is the real boundary.
- Responsive at **360 / 768 / 1280**, with zero horizontal page scroll.

See `docs/05_FRONTEND.md` for the full page pattern.
