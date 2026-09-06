# Frontend agent skills installed

### What
Two agent skills live under `frontend/.agents/skills/`, tracked via `frontend/skills-lock.json`:
- `tailwind-4-docs` (source: `lombiq/tailwind-agent-skills`) — synced Tailwind CSS v4 docs
  snapshot + migration/gotcha guidance. Needs its `references/docs/` snapshot initialized
  (git + Python 3 + internet) before it can answer from official docs.
- `web-design-guidelines` (source: `vercel-labs/agent-skills`) — reviews UI code against the
  Web Interface Guidelines (accessibility, UX, terse `file:line` findings).

### Why / how
Give any session doing FE design/build work authoritative Tailwind v4 reference and a UI/
accessibility audit checklist, instead of relying on training-data memory of Tailwind
conventions or ad-hoc a11y judgment.

### Verified
- `frontend/.agents/skills/tailwind-4-docs/SKILL.md` and
  `frontend/.agents/skills/web-design-guidelines/SKILL.md` exist
- `frontend/skills-lock.json` lists both with `source` + `computedHash`

### Touches
`frontend/.agents/skills/**`, `frontend/skills-lock.json`

### Use this when
- Any Tailwind v4 utility/variant/config/migration question on this frontend → check
  `tailwind-4-docs` first, over guessing from memory.
- Any FE design/UI/accessibility pass (new screen, component, or review of one) → run
  `web-design-guidelines` against the changed files before calling it done.
