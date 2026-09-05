# 11 — AI TOOLING

> Skills installed and verified for this project, why each one is here, and what we
> deliberately left out.

---

## 1. INSTALLED (globally, on the lead's machine)

Selected by install count **and** verified against the source repo's GitHub stars and
last-push date — install count alone is not trust.

### Design — "don't let it look AI-generated"
| Skill | Source | ⭐ | Use it for |
|---|---|---|---|
| `design-taste-frontend` | leonxlnx/taste-skill | 84K | Anti-slop direction; stops templated-looking layouts |
| `web-design-guidelines` | vercel-labs/agent-skills | 31K | UI/accessibility review pass before merging a screen |
| `emil-design-eng` | emilkowalski/skills | 35K | Polish and interaction detail from a working design engineer |
| `frontend-design` | anthropics (plugin) | 174K | General visual design guidance |

### Web access — "web fetch must not fail"
| Skill | Source | ⭐ | Use it for |
|---|---|---|---|
| `agent-browser` | vercel-labs/agent-browser | 42K | Real headless browser: SPAs, logins, JS-rendered pages |
| firecrawl (plugin) | official marketplace | — | Scrape / search / crawl / map |

Three independent paths (agent-browser, firecrawl, `ctx_fetch_and_index`) so a single
failure never blocks research.

### The build workflow
| Skill | Source | ⭐ | Use it for |
|---|---|---|---|
| `to-spec` | mattpocock/skills | 250K | **Problem statement → written spec.** Highest-value skill in the list. |
| `domain-modeling` | mattpocock/skills | 250K | Spec → entities, terminology, relationships |
| `to-tickets` | mattpocock/skills | 250K | Spec → parallel work streams, one per person |
| `code-review` | mattpocock/skills | 250K | Structured diff review |
| `resolving-merge-conflicts` | mattpocock/skills | 250K | **The QA role's core tool** — see `10_LESSONS.md` §1 |
| `vercel-react-best-practices` | vercel-labs | 31K | React/Next correctness and performance |

### Deliverables
| Skill | Source | ⭐ | Use it for |
|---|---|---|---|
| `pptx` | anthropics/skills | 174K | The live presentation deck |
| `webapp-testing` | anthropics/skills | 174K | Drive a real browser to verify the UI works |

### Also available (pre-installed plugins)
`superpowers` (brainstorming, TDD, systematic-debugging, writing-plans, worktrees),
`context-mode`, `figma`, `skill-creator`, `dataviz`.

---

## 2. INSTALL THESE YOURSELF — nothing is vendored

`.claude/` is **gitignored**. Skills are installed per-developer rather than committed,
for two reasons: they are third-party content this team does not own the right to
redistribute, and `tailwind-4-docs` in particular ships a docs snapshot its own author
marks *source-available but not open-source*, explicitly not to be bundled.

So each person installs their own. The registry resolves the exact package slug:

```bash
npx skills find <name>                    # resolve the slug for a skill
npx skills add <owner/repo@skill> -g -y   # install it globally
```

**The short list worth having before you start**, with the source repo to confirm you're
installing the right one (full rationale in §1):

| Skill | Source repo | Why you want it |
|---|---|---|
| `to-spec` | `mattpocock/skills` | Problem statement → written spec. The highest-value one here. |
| `domain-modeling` | `mattpocock/skills` | Spec → entities, terminology, relationships |
| `resolving-merge-conflicts` | `mattpocock/skills` | The failure in `10_LESSONS.md` §1, directly |
| `code-review` | `mattpocock/skills` | Structured diff review |
| `design-taste-frontend` | `leonxlnx/taste-skill` | Anti-slop design direction |
| `web-design-guidelines` | `vercel-labs/agent-skills` | UI and accessibility review before a merge |
| `tailwind-4-docs` | see `npx skills find` | v4 differs enough from v3 that models routinely emit v3 syntax |
| `webapp-testing` | `anthropics/skills` | Drives a real browser to verify the UI works |

Verify what a skill actually is before trusting it — §3 is a worked example of why
install counts are not evidence.

---

## 3. DELIBERATELY NOT INSTALLED

| Skill | Installs | Why not |
|---|---|---|
| `anti-ui-slop` | 664K | **Unverifiable provenance** — source is a bare domain (`uizze.com`) with no GitHub repo to check, and its listing page renders empty. High installs are not a substitute for a source you can inspect. `design-taste-frontend` covers the same need with a real ⭐84K repo. |
| `prisma/*` | ~250K each | ⭐55 repo, and we use SQLAlchemy |
| `just-scrape` | 245K | ⭐56 repo; firecrawl already covers scraping |
| `ui-ux-pro-max` | 344K | Marketing-heavy naming; covered by the two design skills above |
| `git-guardrails` | 316K | Would **conflict** with `ai_guidelines/UNIVERSAL_GIT_RULES.md`, which is stricter. Two competing git rulebooks is worse than one. |
| `tdd`, `diagnosing-bugs` | 838K / 541K | Overlap with `superpowers` equivalents already installed. More skills ≠ better; a crowded list makes selection slower and noisier. |

---

## 4. HOW TO USE THEM WELL

- **Invoke deliberately.** `to-spec` right after the problem statement lands is worth
  more than any amount of fast typing later.
- **The organizers explicitly warn against un-understood AI code.** If you can't
  explain it, don't commit it — you may be asked directly at the presentation.
- **Verify before believing.** Every claim ships with evidence: run the test, curl the
  endpoint, look at the screen.

```bash
npx skills find <topic>                 # search the registry
npx skills add <owner/repo@skill> -g -y # install globally
```
