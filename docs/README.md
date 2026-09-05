# Docs

Working documents for the hackathon. Read `00_PLAYBOOK.md` first — everything else
expands a section of it.

| Doc | Owner | Read it when |
|---|---|---|
| [00_PLAYBOOK.md](00_PLAYBOOK.md) | Lead | **First.** Timeline, roles, triage protocol, risks, definition of done |
| [01_STACK.md](01_STACK.md) | All | Locking technology decisions; known dependency landmines |
| [02_ARCHITECTURE.md](02_ARCHITECTURE.md) | All | Before writing your first module |
| [03_DATA_MODEL.md](03_DATA_MODEL.md) | Backend | Turning the statement into tables |
| [04_API_CONTRACT.md](04_API_CONTRACT.md) | Backend + Frontend | Continuously — the FE↔BE contract |
| [05_FRONTEND.md](05_FRONTEND.md) | Frontend ×2 | Before your first screen |
| [06_BACKEND.md](06_BACKEND.md) | Backend | Before your first router |
| [07_TESTING_AND_REVIEW.md](07_TESTING_AND_REVIEW.md) | QA | Continuously; everyone before a merge |
| [08_RUNBOOK.md](08_RUNBOOK.md) | All | When something won't start |
| [09_DEMO_AND_PRESENTATION.md](09_DEMO_AND_PRESENTATION.md) | Pitch | Video + live presentation prep |
| [10_LESSONS.md](10_LESSONS.md) | All | **Before writing any code** — mistakes already paid for |
| [11_AI_TOOLING.md](11_AI_TOOLING.md) | All | Setup, and when you need a capability you lack |
| [12_SESSION_CONTEXT.md](12_SESSION_CONTEXT.md) | All | Handing this project to a new AI session |
| [PROBLEM_STATEMENT.md](PROBLEM_STATEMENT.md) | Lead | Paste the statement here when it drops |
| [team/](team/) | Each member | Your own role card |

**Role cards:** [A — Frontend Core](team/CARD_A_FRONTEND_CORE.md) ·
[B — Backend Core](team/CARD_B_BACKEND_CORE.md) ·
[C — Frontend + Pitch](team/CARD_C_FRONTEND_PITCH.md) ·
[D — QA & Review](team/CARD_D_QA_REVIEW.md)

---

✅ **`docs/` is tracked in git**, deliberately. The virtual round ignored it, and two
committed READMEs then linked to files that were missing from a fresh clone
([`10_LESSONS.md`](10_LESSONS.md) §11). Tracking it keeps every link in the repo
resolvable, and means each teammate gets the playbook and their role card straight from
a clone rather than from a chat message.

The repository is private, so these stay internal to the team and the evaluator.

**Session chatter still doesn't belong here** — `*_COMPLETE.md`, one-off audit reports
and scratch notes are not documents. Add a file to this folder only if someone will
need it in 30 days, and add its row to the table above when you do.
