# Docs

Working documents for the hackathon. Read `00_PLAYBOOK.md` first — everything else
expands a section of it.

**The problem statement is decided:** [Urban Furniture — Accounting System](PROBLEM_STATEMENT.md).

| Doc | Read it when |
|---|---|
| [00_PLAYBOOK.md](00_PLAYBOOK.md) | **First.** Roles, triage protocol, risks, definition of done |
| [PROBLEM_STATEMENT.md](PROBLEM_STATEMENT.md) | **Second.** The statement, the triage, the rules, the scope cut |
| [01_STACK.md](01_STACK.md) | Technology decisions and the dependency landmines we verified |
| [02_ARCHITECTURE.md](02_ARCHITECTURE.md) | Before writing your first module |
| [03_DATA_MODEL.md](03_DATA_MODEL.md) | The schema, the constraints, **the four posting rules** |
| [04_API_CONTRACT.md](04_API_CONTRACT.md) | Continuously — the FE↔BE contract and the error registry |
| [05_FRONTEND.md](05_FRONTEND.md) | Before your first screen — screens, money formatting, drill-down |
| [06_BACKEND.md](06_BACKEND.md) | Before your first router — **the posting engine** |
| [07_TESTING_AND_REVIEW.md](07_TESTING_AND_REVIEW.md) | Continuously; everyone before a merge |
| [08_RUNBOOK.md](08_RUNBOOK.md) | When something won't start |
| [09_DEMO_AND_PRESENTATION.md](09_DEMO_AND_PRESENTATION.md) | Video and live presentation prep |
| [10_LESSONS.md](10_LESSONS.md) | **Before writing any code** — mistakes already paid for |
| [11_AI_TOOLING.md](11_AI_TOOLING.md) | Setup, and when you need a capability you lack |
| [12_SESSION_CONTEXT.md](12_SESSION_CONTEXT.md) | Handing this project to a new AI session |
| [13_DESIGN_FAQ.md](13_DESIGN_FAQ.md) | **Four worked walkthroughs with real numbers**, then 30 questions on the reasoning. Read to refresh, not memorise. |
| [team/LANES.md](team/LANES.md) | The four working lanes — reference, not assignments |
| `technicals/` *(local, not tracked)* | Design explorations and decision records — gitignored, not present in a fresh clone |

---

✅ **`docs/` is tracked in git**, deliberately. The virtual round ignored it, and two
committed READMEs then linked to files that were missing from a fresh clone
([`10_LESSONS.md`](10_LESSONS.md) §11). Tracking it keeps every link in the repo
resolvable, and means each teammate gets the playbook straight from a clone rather than
from a chat message.

The repository is private, so these stay internal to the team and the evaluator.

**Session chatter still doesn't belong here** — `*_COMPLETE.md`, one-off audit reports and
scratch notes are not documents. Add a file to this folder only if someone will need it in
30 days, and add its row to the table above when you do.
