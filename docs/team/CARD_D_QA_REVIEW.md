# CARD D — QA · Code Review · Merge Gatekeeper

> **Branch:** `feature/tests` for your own work · **plus merge authority into `dev`**
> **Keep open all day:** `../07_TESTING_AND_REVIEW.md`

## Your mission in one line
**Nothing reaches `dev` that breaks, silently removes, or quietly regresses a feature that already worked.**

You are the only person whose full-time job is that `main` stays green and complete. Everyone
else is optimising for shipping their own slice; you're optimising for the whole thing still
working at 09:55 tomorrow.

## ⚠️ The specific failure this card exists to prevent
In the virtual round, a merge **silently deleted a function header** in the seed script. The
file still parsed — Python quietly attached the orphaned body to the previous function — so
nothing errored at merge time. The documented first-run setup path was broken and **nobody
noticed until a full audit weeks later.**

That is your enemy: **changes that don't fail loudly.** A merge conflict resolved by
"keep both" or "take theirs" can drop a whole feature branch's logic without a single red mark.

## What you own
1. **Reviewing every feature-branch → `dev` merge.** Nothing merges without your eyes on it.
2. **Guarding feature integrity across merges** — the core of this card (checklist below).
3. **Tests** — the business rules, the validation matrix, the demo path.
4. **Git hygiene** — conventional commits, four healthy commit streams, hourly push reminders.
5. **Backend overflow** — you're the second-most backend-capable slot; take analytics queries
   or seed work off Card B when they're the bottleneck.

## The merge review checklist (run this on EVERY merge into `dev`)

**Before merging:**
- [ ] `git diff dev...feature/x --stat` — does the change scope match what they said they built?
- [ ] Any file with **large deletions** you didn't expect → open it and ask why
- [ ] Any **conflict resolution** in the diff → re-read the resolved region in full. This is
      where features die.

**After merging, before pushing `dev`:**
- [ ] Backend tests pass: `cd backend && uv run pytest`
- [ ] Frontend builds: `cd frontend && npm run build`
- [ ] **The app actually starts** — not just "it compiled"
- [ ] **Walk the demo path by hand.** Login → core flow → the wow moment. Every time.
- [ ] Nothing that worked an hour ago is now gone

**Weekly-habit equivalent, run every ~4 hours:**
- [ ] Does the README's setup still work from a *fresh* clone? (Not from your warm one.)
- [ ] Is every mandatory PS deliverable still present and working?

## Testing priorities (hackathon mode — don't test everything)
Test in this order, stop when time runs out:
1. **The business rules** — each rule in the PS gets a reject case AND an accept case. This is
   what the judges probe.
2. **The error envelope** — bad input returns enveloped 4xx, never a 500.
3. **The demo path** — an end-to-end walk, automated if time allows, by hand if not.
4. **Anything with money/date math** — off-by-one errors here are embarrassing on screen.

**Do not** chase coverage percentages. Do not test the framework. Do not test the boilerplate's
auth (it's already tested).

## Hard rules
- **Revert beats debug after midnight.** If `dev` breaks at 03:00, revert the merge and let the
  author fix it in daylight. Do not try to repair someone else's half-finished work at 4am.
- If a merge looks risky and the author is asleep, **hold it** — `dev` staying green is worth
  more than one extra feature landing four hours early.
- You have veto power on merges. Use it. Being liked at 04:00 is worth less than a working demo
  at 10:00.

## Definition of done
`main` green at every checkpoint · every business rule has a test · the demo path verified by
hand within the last hour before freeze · four healthy commit streams · no feature silently
lost in a merge.

## Prime your AI assistant with this
> I'm the QA and code-review owner for a 24-hour hackathon team. Stack: FastAPI backend
> (pytest) + Next.js frontend. My job is reviewing every feature-branch merge into `dev` and
> making sure nothing silently breaks or removes working features — especially via
> conflict resolutions that "keep both" or "take theirs" and quietly drop logic. Help me
> review this diff: [paste]. Flag anything removed, any conflict resolution that looks lossy,
> and any business rule that lost its enforcement. Also help me write pytest cases for
> [business rule], with both a rejecting and an accepting case.
