### What
Escalated the earlier tokens-only Apple re-theme (`2026-09-05-design-tokens-apple-alignment.md`)
to a full aesthetic pass across the shared chrome and component grammar, per explicit user
request ("i need full design as per apple"). Verified visually with a temporary Playwright
install (removed afterward) against a local SQLite backend instance.

### Why / how
User wanted `frontend/DESIGN.md`'s Apple language applied fully, not just as color/radius
tokens. Kept the density non-negotiable from `docs/05_FRONTEND.md` (tables, forms, KPI
numbers unchanged) and applied the Apple language everywhere else:
- **Sidebar** is now fixed dark chrome (`--nav-*` tokens, `#1d1d1f`, NOT theme-derived —
  mirrors Apple's global-nav always being black regardless of site theme). Active nav item
  uses Sky Link Blue (`#2997ff`) per DESIGN.md's own rule that Action Blue disappears on a
  dark surface.
- **Topbar** is now a frosted translucent bar (`--surface-translucent` + `backdrop-filter:
  blur(20px) saturate(180%)`) — Apple's sub-nav-frosted. Same treatment applied to
  `.portal-topbar`.
- **Every button is pill-shaped** (`.btn` base radius is now `--radius-full`, not just
  `.btn-primary`) — icon-only buttons (theme toggle, modal close, pagination arrows) got a
  new `.btn-icon` circular treatment instead.
- **No shadows on cards/kanban/kpi/view-toggle** — hairline border only, per DESIGN.md's
  "exactly one shadow, reserved for product imagery" rule. Modal keeps its shadow (overlay
  needs the elevation cue; DESIGN.md doesn't document overlay patterns at all).
- **Font-weight ladder normalized** to 300/400/600/700 everywhere (was scattered 550/650).
- **`h1` bumped to 40px** (`--t-2xl`, Apple's display-lg) for page headlines and the login/
  signup hero — those two pages got a centered hero treatment (large headline, lead
  paragraph, pill CTA, pearl-style demo-account chips).
- Card/KPI radius bumped to `--radius-lg` (18px) and padding to `--s-5` (24px).

### Verified
Installed Playwright + Chromium as a temporary devDependency (asked the user first — repo
rule requires approval before installing anything), started the backend against a local
throwaway SQLite DB (the tracked `.env`/`backend/.env` point at a teammate's LAN Postgres
instance — did NOT touch those files) and the frontend against it, logged in as the seeded
Admin, and screenshotted: login, dashboard (light + dark theme), a dense list screen
(Contacts, 21 rows), and a full-page form (New Contact). All render correctly — dark
sidebar, frosted topbar, pill buttons, tight dense tables intact, dark theme flips cleanly.
Cleaned up afterward: killed both dev servers, `npm uninstall playwright` (package.json/
lock show no diff), removed the local `app.db` and scratch driver scripts.

### Touches
`frontend/src/app/design-system.css` (main), `frontend/src/app/login/page.tsx`,
`frontend/src/app/signup/page.tsx`, `frontend/src/components/shell/app-shell.tsx`,
`frontend/src/components/ui/modal.tsx`, `frontend/src/components/ui/pagination.tsx`.

### Note — brain staleness discovered mid-task
`backend/README.md` and `git log` show a full backend already merged in
(`services/posting.py`, all routers, `feat: implement core accounting, sales, and purchase
modules...`) — this directly contradicts `pending/INDEX.md`'s claim that `posting.py`
"does not exist yet." `pending/INDEX.md` needs a re-verification pass before anyone trusts
it for what's actually built — this is the same class of gap as
`mistakes/2026-09-05-docs-vs-repo-state-gap.md`. Did not fix `pending/INDEX.md` in this
session — flagging so the next session that touches backend work re-checks the real state
first (`git log`, `ls backend/src/app/{services,routers}`) rather than trusting the board.
