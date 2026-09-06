### What
Re-themed `frontend/src/app/design-system.css` tokens to align with `frontend/DESIGN.md`
(an Apple-marketing-site design analysis) — colors, radius scale, primary-button shape,
heading tracking, press micro-interaction only. Did not touch layout, density, tables,
sidebar, KPI grid, or forms.

### Why / how
User pointed at `frontend/DESIGN.md` as "the design guideline to follow." `DESIGN.md`
describes a photography-first, low-density marketing language (edge-to-edge tiles, 80px
section padding, 56px hero type) that directly conflicts with `docs/05_FRONTEND.md`'s
explicit brief: *"precise, dense and trustworthy — not airy and marketing-shaped."*
`design-system.css` also carries its own "LOCK THIS EARLY AND DO NOT CHANGE IT AFTERWARDS"
comment. Asked the user to scope it (AskUserQuestion) — they chose **tokens only**:
- `--accent-h`/`--accent-s`: 217/76% → 210/86% (Apple's Action Blue #0066cc hue)
- `--radius-sm/--radius/--radius-lg`: 6/10/14px → 8/11/18px (DESIGN.md's sm/md/lg steps);
  added `--radius-xs: 5px`; `--radius-full` 999px → 9999px
- `.btn-primary` gets the signature full-pill shape (`border-radius: var(--radius-full)`);
  every other button keeps the existing compact-rect utility grammar
- `h1–h4` letter-spacing: -0.011em → -0.017em (Apple's "tight" heading cadence, toned down
  from DESIGN.md's -0.28px at 56px since our headings are much smaller)
- `.btn:active` gets `transform: scale(0.97)` (DESIGN.md's universal press feedback)

Layout, spacing scale, card/table/kanban structure, and all component markup are
untouched — those come from `docs/05_FRONTEND.md`, which wins over `DESIGN.md` wherever
the two disagree on density.

### Verified
`npm run build` in `frontend/` — green, no new warnings, all routes still compile.

### Touches
`frontend/src/app/design-system.css` only.
