# 00 — THE PLAYBOOK

> **Owner:** Sahil (Team Lead) · **Read by:** everyone, once, before 10:00 on day 1
> **This is the master document.** Every other doc in `docs/` is a detail expansion of a
> section here. If a doc and this playbook disagree, this playbook wins and the other doc
> gets fixed.

---

## 1. THE FACTS

| | |
|---|---|
| **Event** | Odoo Hackathon 2026 — **Final Round**, 24 hours, on-site |
| **Team** | Innovatrix — **Team #645** |
| **Members** | Sahil Patel (lead), Devasya Joshi, Gaurav Rathva, Pranjal Shah |
| **Venue** | Odoo India Pvt Ltd, Gandhinagar 382007, Gujarat |
| **Evaluator** | Ronak Bharadiya — GitHub **`rmbh-odoo`** |
| **Qualified via** | Virtual round (TransitOps, 8h) — top-tier finish |

### Hard timeline (from the organizer portal — treat as immovable)

| Time | What | Owner | Slack |
|---|---|---|---|
| **05 Sep 09:00** | Problem statement announced | all | — |
| **05 Sep 10:00** | Coding starts | all | — |
| **05 Sep 11:00** | 🚨 **HARD: evaluator `rmbh-odoo` added as repo collaborator** | Sahil | **zero** |
| **06 Sep 10:00** | 🚨 **HARD: coding ends** — final push before this | all | zero |
| **06 Sep 10:30** | 🚨 **HARD: demo video link submitted** | Pitch owner | zero |
| **06 Sep 13:00** | **Live presentation & valedictory** | Pitch owner + all | — |

> ⚠️ **The 11:00 collaborator deadline is one hour after coding starts and is the single
> cheapest way to get disqualified.** It is not a coding task, it takes 60 seconds, and it is
> easy to forget while heads-down on the problem statement. **Do it at 10:05, not 10:55.**

> ⚠️ **This round has a live presentation the virtual round did not.** Coding ends 10:00,
> video due 10:30, and you present at 13:00 — that is a 3-hour window where the *only* thing
> that matters is how well you tell the story. Budget for it (§7).

---

## 2. WHAT CHANGED SINCE THE VIRTUAL ROUND

| | Virtual round | **Finale** | Consequence |
|---|---|---|---|
| Duration | 8 hours | **24 hours** | It's a marathon. Fatigue, not skill, is the main failure mode. **Sleep rotation is mandatory (§4).** |
| Location | Remote, own setup | **On-site, Odoo HQ** | Unknown network, unknown power, unfamiliar chairs. **Pre-cache everything (§3).** |
| Deliverable | Repo + video | Repo + video + **live presentation** | A person must own the narrative, not just the code. |
| Team split | 4 concerns (FE / BE / Data / Integration) | **2 FE, 1 BE, 1 QA** | Backend is now the bottleneck. Plan overflow explicitly. |
| Codebase | From scratch | **This boilerplate** | Hour 1 is domain modelling, not `npm install`. |

---

## 3. PRE-EVENT CHECKLIST (do this BEFORE you travel)

The organizers explicitly say *"plan for offline or local solutions; don't rely entirely on
internet connectivity."* Take that literally — venue wifi at a 2000-person event is a
coin flip.

- [ ] **Pre-warm dependency caches on every laptop.** Run `./scripts/dev.sh` end-to-end at
      home so `node_modules/` and the `uv` venv are fully populated. A cold `npm install` on
      bad wifi costs 20–40 minutes you will never get back.
- [ ] **Pull the Docker images you might use** (`postgres:18`) so you're not downloading
      images at 10:05.
- [ ] Every member: this repo cloned, `./scripts/dev.sh` verified running locally.
- [ ] Every member: signed into GitHub on their own machine, with push access confirmed.
- [ ] Every member: their AI assistant primed (§8) and skills installed (`docs/11_AI_TOOLING.md`).
- [ ] Chargers, extension board, mouse, headphones. A 24-hour sit is a physical event.
- [ ] Phone hotspot as network fallback — confirmed working, with data left on it.
- [ ] Sleep well the night *before*. You cannot bank sleep during.

---

## 4. THE 24-HOUR RHYTHM (with sleep rotation)

**The single biggest difference from an 8-hour sprint: you cannot run flat out.** A team
that codes 24 hours straight ships worse work than a team that rotates. Two people rest
while two work, in the low-value overnight window.

| Block | Time | Focus | `main` state |
|---|---|---|---|
| **Triage** | 09:00–10:00 | PS lands. Read it. §5 protocol. **No code.** | — |
| **Kickoff** | 10:00–11:00 | Repo up, **evaluator added (10:05!)**, domain model locked, contract v1 written, work split | scaffold pushed |
| **Sprint 1** | 11:00–14:00 | Everyone builds their slice. Mocks unblock frontend. | hourly pushes |
| **☑ Checkpoint 1** | 14:00 | **Vertical slice demo** — one screen, real API, real DB row | slice on `main` |
| **Sprint 2** | 14:00–18:00 | Core CRUD breadth, business rules, seed data | merges ≤60 min |
| **☑ Checkpoint 2** | 18:00 | **All core flows integrated.** Eat properly. Re-scope, write the cut list. | core on `main` |
| **Sprint 3** | 18:00–22:00 | Second feature wave, real-time, dashboard/analytics | — |
| **☑ Checkpoint 3** | 22:00 | **Feature-complete target.** Decide what's getting cut. | near-final |
| **🌙 Night A** | 22:00–02:00 | Pair 1 works (polish, bugs); Pair 2 **sleeps** | low-risk commits only |
| **🌙 Night B** | 02:00–06:00 | Pair 2 works; Pair 1 **sleeps** | low-risk commits only |
| **Convergence** | 06:00–08:00 | Everyone up. Bug scrub of the **demo path only**. | stabilising |
| **🔒 FREEZE** | **08:00** | **FEATURE FREEZE.** Nothing new merges. Demo-path fixes only. | frozen |
| **Polish** | 08:00–09:30 | Empty states, favicon, title, seed reset, README truth pass | polish commits |
| **Ship** | 09:30–10:00 | Final README, final push **by 09:55** | **FINAL** |
| **Video** | 10:00–10:30 | Record + upload + incognito-test + submit | — |
| **Presentation** | 10:30–13:00 | Rehearse the live pitch. Rest. Eat. | — |

**Night-shift rules (non-negotiable):**
- Nobody merges a risky refactor at 03:00 unsupervised. Overnight work is **polish, bugfixes,
  tests, docs, seed data** — not architecture.
- The person sleeping is genuinely off. No "just check this quickly."
- Anything that breaks `main` overnight gets **reverted, not debugged at 04:00**. Revert, sleep,
  fix in daylight.

---

## 5. PS-TRIAGE PROTOCOL — 09:00 to 10:00 (the highest-leverage hour of the event)

The problem statement drops at 09:00 but you cannot commit code until 10:00. **That hour is
free thinking time. Do not waste it staring at the clock — this is when the hackathon is won.**

Save the PS to `docs/PROBLEM_STATEMENT.md` the moment it lands, verbatim.

**09:00–09:15 — Read it three times. Alone, silently, all four of you.** No discussion yet;
first-impression groupthink is real. Each person writes down, privately:
- The **actors** (who logs in, what can each do?)
- The **core entities** (the nouns — these become your tables)
- The **core flows** (the verbs — these become your endpoints and screens)
- The **one demo moment** that would make a judge lean forward
- Anything that smells like a **trap** (needs a paid API? hardware? ML? a 3-day feature?)

**09:15–09:35 — Compare notes.** Where all four wrote the same entity, that's your core.
Where you disagree, that's ambiguity to resolve now, not at 15:00. Produce **one** agreed list.

**09:35–09:50 — Lock the scope.** Sort every feature into:
- 🟥 **MUST** — explicitly demanded by the PS. If it's in "mandatory deliverables", it is not
  negotiable. This is your grade floor.
- 🟨 **SHOULD** — strongly implied, or the PS's own "bonus" list. Build after MUST is green.
- 🟩 **WOW** — the one differentiator you'd demo first. Pick **exactly one**. Not three.
- ⬛ **CUT** — written down explicitly, and put in the README as "out of scope in 24h".

> **Honesty scores better than bluff.** The virtual round README carried an explicit
> out-of-scope list and it did not hurt us. Judges have seen a thousand overclaiming demos.

**09:50–10:00 — Agree and stage.** Read the four working lanes in
[`team/LANES.md`](team/LANES.md) and agree out loud who is picking up what first — they are
reference, not assignments, and nobody owns a lane. Write the domain model on a
whiteboard/paper. Everyone knows their first three tasks before the clock starts.

**Then at 10:00 — first commit, and at 10:05 — add `rmbh-odoo` as collaborator.**

### Reusable triage questions
- What is the **one sentence** this product exists for? (This becomes your video's first line.)
- What is the **state machine**? Almost every Odoo-style PS has one entity that moves through
  statuses with rules attached. That state machine *is* the app. Find it, build it first.
- What is **dynamic** here? Criterion #1 is "real-time or dynamic data, no static JSON." Decide
  in this hour how data will visibly *move* during the demo.
- What would make this look **enterprise** rather than a CRUD toy? (Audit trail, RBAC,
  validation that actually blocks, reports that compute.)

---

## 6. JUDGING CRITERIA → CONCRETE BUILD DECISIONS

The organizers published exactly what they score. Build directly against it.

| Their words | What we actually do — **for this build specifically** |
|---|---|
| *"Real-time or dynamic data, avoid static JSON"* | The simulator posts a real customer payment on a timer. One event moves three things at once: the invoice status, the cash and receivables KPIs, and the trial-balance badge. In the video, **say the words** "this is live from our database." |
| *"Responsive, clean UI, consistent color scheme and layout"* | Design tokens locked early, **never changed after**. Dense data-grid aesthetic — right-aligned tabular numerals, debit and credit as two columns. Test at 360 / 768 / 1280, zero horizontal scroll. |
| *"Validate user input robustly"* | **Double layer**, and this domain gives us unusually good demos: an invoice with no lines rejects inline; editing a posted document is refused; over-allocating a payment returns `OVERALLOCATED_PAYMENT`. Demo one **on purpose** in the video. |
| *"Intuitive navigation, proper menu placement and spacing"* | Sidebar grouped by mental model — Master Data / Purchases / Sales / Accounting / Reports — not by table list. Breadcrumbs on the drill-down, which is three levels deep. |
| *"Use Git properly; one member managing the repo is not enough"* | **Four healthy commit streams**, conventional messages, everyone pushing under their own account. Per-member contribution is scored. |
| *"Backend APIs, data modeling, local DB"* (nice-to-have) | This is our strongest criterion. A real relational schema with CHECK constraints enforcing accounting rules at the database level, migrations, and a ledger that reports are computed from. |
| *"Understand AI snippets, don't blindly copy-paste"* | **Every member must be able to defend any line they committed.** Our intelligence features are deterministic and cite their own rows precisely so nothing is a black box — see `PROBLEM_STATEMENT.md` §3.1. |
| *"Plan for offline/local, don't rely on cloud"* | Local Postgres in Docker, local everything, zero cloud signups, pre-cached deps. No model API call anywhere. Email is the one networked feature, and it is kept off the demo path — [`01_STACK.md`](01_STACK.md) §3.2. |

**Where this build is strongest is data modelling.** Every report is computed from an
immutable ledger rather than from stored document balances, and the drill-down from a report
figure to its source document is the visible consequence of that. It is worth making sure
that path works end to end, because it is the clearest evidence that the accounting
underneath is real.

---

## 7. THE TWO DELIVERABLES THAT AREN'T CODE

### 7.1 The video (due 10:30, ~5 min)
Full script template in `docs/09_DEMO_AND_PRESENTATION.md`. Record the **browser, not the
IDE** — they asked for functional flow. Rehearse once. Upload by 10:15 to leave margin, and
**test the link in an incognito window** before submitting.

### 7.2 The live presentation (13:00)
This is new for the finale and it is worth real preparation. The pitch owner drives, but all
four should be able to answer a direct technical question about their own area. Assume you
will be asked: *"what was the hardest part?"* and *"what would you do with another week?"* —
have real answers, not modest deflections.

---

## 8. WORKING AGREEMENT

**With each other:**
- **Blocked >30 minutes → say so out loud.** Silent stalling is the most expensive failure
  mode in a timeboxed build. Someone else has probably already solved it.
- **Push at least hourly, under your own GitHub account.** Per-member contribution is scored.
- Conventional commits, scoped, no AI trailers: `feat(trips): reject cargo above capacity`
- The QA owner's review is not a formality — see `docs/07_TESTING_AND_REVIEW.md`.
- Timebox debugging to ~20 minutes, then ask / stub / cut.

**With your AI assistant:**
- The three rulebooks in `ai_guidelines/` govern. Read them once before the event.
- Plan → one approval → autonomous execution. Don't micro-approve every file at 03:00.
- **Never commit a line you cannot explain.** The organizers call this out explicitly, and a
  judge asking "what does this do?" is a realistic scenario in the 13:00 presentation.
- Verify before claiming done: run the test, curl the endpoint, look at the screen.

---

## 9. RISK TABLE

| Risk | Likelihood | Mitigation |
|---|---|---|
| **Forgot the 11:00 collaborator deadline** | Low, catastrophic | Do it at 10:05. Sahil owns it. Set a phone alarm. |
| Venue wifi is bad | **High** | Everything pre-cached (§3). Local DB. Phone hotspot ready. |
| Backend is the bottleneck (only 1 owner) | **High** | Seed data + analytics queries shift to QA/floater. BE-core stays on the critical path only. |
| Integration hell at 18:00 | Medium | API contract frozen by 11:00; mocks match it exactly; checkpoint at 14:00 catches drift early. |
| Someone burns out overnight | Medium | Enforced sleep rotation (§4). Non-negotiable. |
| Scope creep after 18:00 | **High** | Cut list written at Checkpoint 2. New ideas go to README "future work", not to code. |
| Demo path breaks near the end | Medium | Freeze at 08:00. Screenshots captured at 08:30 as insurance. |
| Video upload fails / is slow | Medium | Start upload 10:15. Drive as backup target. Test incognito. |
| `main` broken overnight | Medium | Revert, don't debug at 04:00. |
| Merge silently drops a feature | Medium | QA owner reviews every `dev` merge — this exact bug hit us in the virtual round (`docs/10_LESSONS.md`). |

---

## 10. DEFINITION OF DONE (team-level)

The submission is done when:
- [ ] A stranger can clone `main` and run it **from the README alone** — re-tested from scratch, not from memory
- [ ] Every mandatory deliverable in the PS is demonstrably working
- [ ] Invalid input is visibly rejected, client and server
- [ ] Data visibly changes during the demo without a page refresh
- [ ] The UI holds at 360 / 768 / 1280 with zero horizontal scroll
- [ ] All four commit streams are healthy and readable
- [ ] README is truthful: what works, what's out of scope, how to run it
- [ ] Video submitted and link-tested in incognito
- [ ] Every member can defend every part of their own code

---

## 11. DOC MAP

| Doc | Read it when |
|---|---|
| `01_STACK.md` | 09:35, when locking technology decisions |
| `02_ARCHITECTURE.md` | Before writing the first module |
| `03_DATA_MODEL.md` | 09:35–10:30, turning the PS into tables |
| `04_API_CONTRACT.md` | Continuously — it is the FE↔BE contract |
| `05_FRONTEND.md` | Frontend pair, before their first screen |
| `06_BACKEND.md` | Backend owner, before their first router |
| `07_TESTING_AND_REVIEW.md` | QA owner continuously; everyone before a PR |
| `08_RUNBOOK.md` | When something won't start |
| `09_DEMO_AND_PRESENTATION.md` | Pitch owner from 18:00 onward |
| `10_LESSONS.md` | **Before you write any code** — mistakes we already paid for |
| `11_AI_TOOLING.md` | During setup, and when you need a capability you don't have |
| `team/LANES.md` | The four working lanes — reference, not assignments |
| `PROBLEM_STATEMENT.md` | **Constantly** — the statement, the rules, the scope cut |
