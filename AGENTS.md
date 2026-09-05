# AGENTS.md

Cross-tool entry point (Codex, Cursor, Copilot, any agent that isn't Claude Code). Claude
Code reads `CLAUDE.md` instead — same rules, same project. Full memory system:
`brain/README.md`. Full spec: `docs/00_PLAYBOOK.md`.

## Project
Urban Furniture — Accounting System. Double-entry ledger. FastAPI + SQLAlchemy 2.0 backend
(`backend/`), Next.js + TypeScript + Tailwind v4 frontend (`frontend/`).

## Setup / run
```
cp .env.example .env
./scripts/dev.sh          # API on :8000, web on :3000, SQLite, no Docker
```

## Test / build
```
cd backend  && uv run pytest        # backend tests
cd frontend && npm run build        # frontend build — must stay green
cd frontend && npm run lint         # separate step, Next 16 removed `next lint`
```

## Code style
- Money: `Numeric(12,2)`, never a float. Dates: UTC, always.
- Business rules live in `services/`, never in routers.
- `services/posting.py` is the only writer of `journal_lines`. Ever.

## Commit / PR rules
- Conventional commits, scoped, imperative mood.
- No AI trailers, no tool mentions, anywhere in the message.
- Never commit or push without being asked first.
- `docs/04_API_CONTRACT.md` changes before the code, never after.

## Security
- JWT in an httpOnly cookie. RBAC enforced server-side (`require_roles`). Reads open,
  writes gated.
- Never commit `.env`, secrets, or `node_modules`.

Full rule set: [`brain/RULES.md`](brain/RULES.md). Mistakes to avoid:
[`brain/mistakes/INDEX.md`](brain/mistakes/INDEX.md).
