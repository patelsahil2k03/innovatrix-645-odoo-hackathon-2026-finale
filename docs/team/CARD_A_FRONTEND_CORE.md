# CARD A — Frontend Core

> **Branch:** `feature/frontend` · **Works in:** `frontend/` · **Merges:** → `dev` (via Card D review) → `main`
> **Keep open all day:** `../04_API_CONTRACT.md` and `../05_FRONTEND.md`

## Your mission in one line
**Every screen the demo walks through looks finished, works at three widths, and rejects bad input inline.**

## What you own
- The design system (tokens locked in hour 1, **never changed after**)
- The app shell: sidebar, topbar, navigation, responsive collapse
- The **primary CRUD screens** — the entity list pages and detail pages that are the core of the PS
- Client-side validation with inline error states
- Loading skeletons, empty states, error states on every screen

## What you do NOT own
- Dashboard / analytics / charts → **Card C**
- API implementation → **Card B** (you build against the contract, with mocks if needed)
- Merging your own work to `dev` → **Card D** reviews first

## Who blocks you / who you block
- **Blocked by:** Card B for real endpoints. **Never wait for them** — build against
  `04_API_CONTRACT.md` with a mocked fetch, flip to the real API when it lands.
- **You block:** Card C (they mount the dashboard inside your shell) and Card D (they can't QA
  screens that don't exist). Ship the shell early.

## First three tasks (in this order, do not reorder)
1. **Design tokens** — implement the palette/spacing/type scale from `05_FRONTEND.md` into
   `design-system.css`. One commit. **This is frozen after hour 1** — no palette changes at 20:00.
2. **App shell** — sidebar with role-filtered nav, topbar, active-state highlighting, responsive
   collapse. Login screen with role chips and error states.
3. **First entity list page** — table + server-side pagination + search + filter + "Add" modal
   with inline validation. This is the pattern you'll repeat for every other entity, so get it
   right once, then copy.

## Hard rules
- **Zero horizontal page scroll** at 360px. This is an explicit judging criterion — check it.
- Never use browser-default validation popups. Inline errors, always.
- Every mutation gets a visible result: toast, row update, or state change. Silent success feels broken.
- Use the shared UI primitives in `components/ui/` — they already handle accessibility
  (focus traps, `aria-sort`, `role="tab"`). **Don't hand-roll a second modal.**
- Reuse `<SearchInput>` and `useDebouncedValue` — do not re-implement per page. (Last round we
  shipped the same search box six times; see `../10_LESSONS.md`.)

## Definition of done
Every screen in the demo path is finished-looking at 360 / 768 / 1280 · every form rejects bad
input inline · menu placement and spacing feel deliberate · your commit stream shows steady
hourly progress.

## Prime your AI assistant with this
> I'm building the frontend for a [one-line app description] in a 24-hour hackathon. Stack:
> Next.js App Router + TypeScript + Tailwind v4, hand-rolled design tokens in
> `design-system.css`, typed API client in `src/lib/api.ts`. My API contract is
> [paste the relevant section of docs/04_API_CONTRACT.md]. Conventions: shared UI primitives in
> `components/ui/` (already accessible — use them, don't rewrite); validation via
> `src/lib/validation.ts`; RBAC gates via `src/lib/roles.ts` (UI-only, server is the real
> boundary). Responsive at 360/768/1280 with zero horizontal scroll. I commit my own code with
> conventional messages. Build [task] with me step by step, and explain anything I couldn't
> defend to an evaluator.
