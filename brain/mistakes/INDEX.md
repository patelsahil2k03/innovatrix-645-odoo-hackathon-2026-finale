# 🔴 Mistakes — index

> Read the table below, then open only the file(s) that match what you're about to touch —
> don't read every file in this folder top to bottom. Add a new file the moment a real
> mistake happens (see `../README.md` for the lifecycle); don't wait to batch them up.

| Date | Area | One-liner | File |
|---|---|---|---|
| 2026-09-05 | products API/UI | ✅ resolved same day — Products page "Category" column always blank; `ProductOut` never had a `category_name` field, `Product` model had no `category` relationship to populate it | [`2026-09-05-product-category-name-missing.md`](2026-09-05-product-category-name-missing.md) |
| 2026-09-05 | auth cookie / shared LAN backend | ✅ resolved same day (no code fix needed — convention was already documented, just not followed) — `/auth/me` (and any authed call) silently 401s when frontend is opened via `localhost:3000` against a backend on a different host; `SameSite=Lax` cookie is withheld cross-site, not a CORS issue | [`2026-09-05-samesite-cookie-cross-host-401.md`](2026-09-05-samesite-cookie-cross-host-401.md) |
| 2026-09-05 | FE/BE report endpoints | ✅ resolved same day — Balance Sheet + P&L pages crashed, Budget Report + dashboard KPIs silently wrong; FE and BE report shapes drifted apart, contract doc only had prose | [`2026-09-05-fe-be-report-contract-drift.md`](2026-09-05-fe-be-report-contract-drift.md) |
| 2026-09-05 | repo state vs. docs | ✅ resolved same day — docs described a built platform before `backend/`+`frontend/` existed; verify a doc's claim before trusting it | [`2026-09-05-docs-vs-repo-state-gap.md`](2026-09-05-docs-vs-repo-state-gap.md) |
| virtual round | multiple | 10 lessons already designed around in this boilerplate — don't reintroduce them once the code exists | [`carried-forward-virtual-round.md`](carried-forward-virtual-round.md) |

**New entry?** Create `YYYY-MM-DD-short-slug.md` in this folder using the template below,
then add its row above, newest first.

```
### What happened
### Why
### Fix
### Prevention (what now makes this structurally impossible, not just "we'll remember")
```
