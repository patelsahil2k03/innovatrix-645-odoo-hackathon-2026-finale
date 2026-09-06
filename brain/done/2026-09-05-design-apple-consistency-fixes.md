### What
Fixed four concrete gaps found by sweeping the whole app (not just the 3-4 screens checked
in the previous two design entries) against `frontend/DESIGN.md`:

1. **Sidebar active-item selection used a left colour bar** (`border-left: 2px solid`) — a
   generic dashboard convention (Linear/Vercel/GitHub), not an Apple one. DESIGN.md's own
   selected-state pattern (`configurator-option-chip-selected`) is a full-shape upgrade —
   same shape, stronger fill, nothing bolted onto one edge. Replaced with a solid capsule:
   `--nav-active-text` (Sky Link Blue) as full background, `--nav-bg` (near-black) as text
   colour for contrast, `--radius-lg` instead of `--radius-sm` so the row reads as a rounded
   capsule rather than a rectangle — closer to macOS's own sidebar-selection language.
2. **Every `<select>` showed the native OS dropdown arrow** — the one place browser chrome
   broke the illusion on literally every form in the app (contact type, product category,
   bill picker, invoice line's product/analytical pickers, etc). Added a custom SVG chevron
   via `background-image` (`appearance: none` + a light/dark `--select-chevron` pair, since
   an SVG data-URI can't use `currentColor`).
3. **Native date-picker icon was invisible in dark mode** — Chromium's calendar glyph is a
   fixed dark icon regardless of page theme, unreadable on a dark input. Added
   `::-webkit-calendar-picker-indicator { filter: invert(1); }` under both dark-theme
   selectors.
4. **`/audit-log` was a dead link** — `sidebar.tsx` has always linked there (admin-only, via
   `roles.ts`), but no page ever existed at that route, so clicking it hit Next's raw
   unstyled 404. The backend API (`GET /audit-logs`, `routers/audit_logs.py`) already existed
   — only the frontend page was missing. Built `frontend/src/app/audit-log/page.tsx` (List
   pattern, mirrors `chart-of-accounts/page.tsx`) plus a typed `AuditLog` interface and
   `api.auditLogs.list` return type (was `Page<Record<string, unknown>>`, now `Page<AuditLog>`)
   in `src/lib/api.ts`. Also added a properly-styled `frontend/src/app/not-found.tsx` so any
   *other* dead route never falls back to Next's default unstyled page again.

### Why / how
User: "i think all ui is not as per latest apple design," then specifically "check side bar
it has not as per apple design.md file." Asked a scoping question first (screens not yet
touched vs. the current-vs-legacy-Apple-look distinction vs. specific elements) — user
picked "screens not touched" + "specific elements wrong." Swept every screen (reports,
budgets, kanban, journals, purchase, payments, forms, a modal) via a temporary isolated
Playwright + local SQLite backend instance (same throwaway-and-uninstall approach as the
earlier two design passes — never touched the team's shared `.env`/LAN backend, and never
touched the live `next dev` process already running on :3000, which points at the shared
LAN backend and is someone's active session).

### Verified
Screenshotted the sidebar before/after (solid capsule replaces the border-stripe), a form
with a `<select>` before/after (custom chevron visible), a dark-mode date+select field
(chevron and calendar icon both now legible against the dark input), the new `/audit-log`
page (renders, empty-state works), and a nonexistent route (styled 404 instead of Next's
default). `npm run build` and `npx tsc --noEmit` both clean throughout. Cleaned up afterward
exactly as before: killed the throwaway backend/frontend, `npm uninstall playwright`
(`package-lock.json` shows no diff), removed `app.db` and the `/tmp` frontend copy.

### Touches
`frontend/src/app/design-system.css`, `frontend/src/lib/api.ts`,
`frontend/src/app/audit-log/page.tsx` (new), `frontend/src/app/not-found.tsx` (new).

### Note — did not touch
`.env`, `frontend/package.json`'s new `clean` script, root `package.json`'s new `clean*`
scripts, and `scripts/clean-cache.sh` all changed on disk during this session from outside
this conversation (a teammate or the user, live) — left every one of them alone per the
harness's own guidance, including the `.env` comment documenting an SSH-tunnel workaround
for the SameSite cross-host cookie issue in
`mistakes/2026-09-05-samesite-cookie-cross-host-401.md`.
