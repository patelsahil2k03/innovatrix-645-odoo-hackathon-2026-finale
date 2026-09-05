### What
Exposed every design token (the plain-CSS system in `design-system.css`, itself aligned to
`frontend/DESIGN.md`'s Apple language — see the two earlier design entries) as real Tailwind
v4 utilities via a `@theme` block, so new markup can use `bg-accent`, `rounded-lg`,
`shadow-lg`, `text-2xl`, `font-mono`, `text-nav-active-text`, etc. directly instead of only
through the hand-written component classes (`.btn`, `.card`, ...).

### Why / how
User: "add this design.md file and all design related changes on my tailwind css on web
app." Tailwind was already installed (`@tailwindcss/postcss`, `@import "tailwindcss";` in
`globals.css`) but nothing in the app used Tailwind utility classes — every screen is built
from the custom `design-system.css` classes. Rather than rewrite all existing markup to
utilities (large, risky, no clear ask for it — see `.agents/skills/tailwind-4-docs`'s
engineering playbook: "prefer the project's existing design language over inventing a new
one"), wired the *tokens* into Tailwind's theme layer so both approaches share one source of
truth and either can be used going forward.

Mechanics worth remembering if this file is touched again:
- Colors, `--t-*` text sizes, and `--surface-translucent` are plain `var()` aliases inside
  `@theme` (`--color-accent: var(--accent);` etc.) — safe because the Tailwind-facing name
  and our internal name differ. This is also what makes dark mode free for the new
  utilities: the alias never changes, only the value it points at (reassigned in the
  existing dark-theme blocks further down the file).
- Radius, font, and shadow are the one landmine: Tailwind's own theme namespace for those
  reuses our *exact* generic names (`--radius-sm`, `--font-sans`, `--shadow-lg`), so
  `--radius-sm: var(--radius-sm);` inside `@theme` would self-reference and silently break.
  Their literal values now live directly in `@theme` (the single source of truth for those
  three — removed the old duplicate declarations from the plain `:root` block). The bare
  `--radius` and `--radius-full` stay as plain `:root` aliases (`--radius: var(--radius-md);`)
  since those bare names don't match Tailwind's dash-suffixed scan pattern and two existing
  call sites (`.table-wrap`, `.t-account`) still reference `var(--radius)` directly.
- The old bare `--shadow` (no suffix) tier was renamed `--shadow-md` throughout (light theme
  + both dark-theme blocks) to fit Tailwind's real `shadow-sm/md/lg` utility names. Nothing
  in the codebase referenced bare `var(--shadow)` before the rename (checked via grep).

### Verified
- `npm run build` green throughout.
- Confirmed `@theme` didn't produce a circular reference: inspected the compiled CSS chunk
  for `--font-sans` and `--radius-sm` — both emitted our literal values, not empty/invalid.
- Proved the Tailwind JIT path end-to-end: temporarily added
  `rounded-full bg-accent text-nav-active-text shadow-lg font-mono text-2xl` to a throwaway
  element, rebuilt, confirmed the compiled CSS generated each utility correctly wired to our
  custom properties (e.g. `.bg-accent{background-color:var(--color-accent)}`), then reverted
  the file (`git diff` on it is clean).
- No existing markup uses Tailwind utility classes yet (grepped `src/**/*.tsx` for
  `flex|grid|gap-|p-|rounded-` as class names — all hits were our own custom classes like
  `.grid-2`, not Tailwind's), so this change is additive — nothing to regress visually. The
  full-page screenshots from the previous design pass remain accurate.

### Touches
`frontend/src/app/design-system.css` only.
