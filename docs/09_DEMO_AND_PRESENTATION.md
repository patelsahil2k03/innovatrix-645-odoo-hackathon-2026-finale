# 09 — DEMO, VIDEO & PRESENTATION

> **Owner:** Frontend/Pitch. **This is a graded deliverable, not an afterthought.**

The finale has **two** narrative deliverables the virtual round didn't: a video *and*
a live presentation. Code that nobody understands scores worse than slightly less code
that is explained well.

---

## 1. THE VIDEO (~5 minutes, hard deadline)

**Production:** record the **browser, not the IDE** — they asked for functional flow,
not a code tour. One narrator (the clearest speaker). App pre-seeded and pre-warmed.
Upload unlisted, then **test the link in an incognito window before submitting.**

**Structure:**

| Segment | Length | Content |
|---|---|---|
| Hook + problem | 0:25 | "This is [X]. [The real-world pain in one sentence]. Built in 24 hours." |
| The star flow | 0:35 | Your single most impressive end-to-end path, told as a user story |
| Core features | 1:30 | 3–4 features max. For each: do it, then say what just happened. |
| **Live data moment** | 0:20 | Show the dashboard changing **without a refresh**. Say: *"this is live from our database — nothing here is hardcoded."* |
| **Robustness** | 0:45 | Submit invalid input on purpose → clean inline error. Then resize to mobile → responsive layout. Hits two criteria in 45 seconds. |
| Under the hood | 0:30 | Architecture diagram. Stack in one line. Point at the contributor graph. |
| Close | 0:15 | Team name, thanks. |

**Two segments people skip and shouldn't:** the live-data moment and the deliberate
invalid submission. Both map directly onto published judging criteria, and both take
under a minute.

---

## 2. THE LIVE PRESENTATION

The pitch owner drives, but **every member must be able to answer for their own area.**

**Structure (adapt to the time given):**
1. The problem, in one sentence — no preamble
2. What we built — the demo, live if the setup allows, recorded as a fallback
3. How it works — architecture in ~60 seconds, no code
4. What we'd do next — shows judgement, and pre-empts "what's missing?"

**Prepare real answers for:**
- *"What was the hardest part?"* — a genuine technical answer. The concurrency
  handling in the rule engine is a strong one if you built it.
- *"What would you do with another week?"* — proves you know your own gaps.
- *"Why this stack?"* — have a reason beyond "we know it."
- *"Did you use AI? Do you understand this code?"* — answer honestly and then
  **demonstrate** understanding by explaining a specific piece. This is exactly what
  the organizers' "don't blindly copy-paste" note is about.

**Have a fallback.** If live demo setup fails, play the recorded video. Never spend
presentation minutes debugging in front of judges.

---

## 3. INSURANCE

- Screenshots of every screen, captured before the freeze
- The recorded video, downloaded locally as well as uploaded
- A one-page architecture diagram, exported as an image
- The demo database in a known-good, reset state

---

## 4. WRITING THE SCRIPT

Write it once the app actually exists — not from the plan. Rehearse it **out loud,
with the app open**, at least once. Reading it silently hides every awkward transition
and every screen that takes four seconds to load.

Trim the middle, never the close.
