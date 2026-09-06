# Documentation & planning

### What
The full spec — problem statement triage, data model, API contract, backend and frontend
playbooks, testing plan, design FAQ, stack decisions, session handoff — all written and
tracked in `docs/`.

### Why / how
Written before coding started, per `docs/00_PLAYBOOK.md` §5's triage protocol; deliberately
kept in git (not `.gitignore`d) so every teammate and any AI session gets it straight from a
clone rather than from a chat message.

### Verified
`git log --oneline` on this branch shows 17 `docs:`/`chore:` commits building up exactly
these files; `git ls-tree -d --name-only` on `main`/`dev`/`dev-feature`/`feature/fe-design`
confirms `docs/` and `ai_guidelines/` are the only two tracked top-level folders so far.

### Touches
`docs/*`, `ai_guidelines/*`, root `README.md`.
