# 07 — TESTING & CODE REVIEW

> **Owner:** QA / Review. **Everyone reads §3 before opening a merge.**

---

## 1. WHAT TO TEST (and what to skip)

You will not have time to test everything, and you shouldn't try. Test in this order
and stop when you run out of time:

1. **Business rules** — every "must"/"cannot" in the problem statement gets a
   **reject** case *and* an **accept** case. This is what judges probe, and it's the
   highest-value test you can write.
2. **The error envelope** — bad input returns an enveloped 4xx, never a 500.
3. **The demo path** — the exact sequence you'll walk through, end to end.
4. **Money / date maths** — off-by-one and rounding errors are humiliating on screen.

**Do not** chase coverage numbers, test the framework, or re-test the boilerplate's
auth (already covered by 32 passing tests).

```python
def test_cannot_activate_when_quantity_exceeds_capacity(db, seeded_order):
    with pytest.raises(AppError) as exc:
        rules.activate_order(db, seeded_order.id, actor_id=admin.id)
    assert exc.value.code == "EXCEEDS_CAPACITY"

def test_can_activate_a_valid_order(db, valid_order):
    result = rules.activate_order(db, valid_order.id, actor_id=admin.id)
    assert result.status is OrderStatus.ACTIVE
```

---

## 2. THE MERGE REVIEW CHECKLIST

Run this on **every** feature branch merging into `dev`.

**Read the diff:**
- [ ] `git diff dev...feature/x --stat` — does the scope match what they said they built?
- [ ] **Unexpected large deletions** → open the file and ask why
- [ ] **Any conflict resolution** → re-read the whole resolved region

> 🚨 **This is the specific failure this role exists to catch.** In the previous
> project a merge silently deleted a function's `def` header. The file still parsed —
> Python attached the orphaned body to the function above it — so nothing failed
> loudly, and a documented setup command stayed broken for weeks. Conflict
> resolutions that "keep both" or "take theirs" can delete a whole feature without a
> single red mark anywhere.

**Then prove it still runs:**
- [ ] `cd backend && uv run pytest` — green
- [ ] `cd frontend && npm run build` — green
- [ ] The app actually **starts** (compiling is not running)
- [ ] **Walk the demo path by hand.** Login → core flow → the wow moment.
- [ ] Nothing that worked before is gone now

**Every few hours:**
- [ ] Does the README's setup still work from a **fresh clone**? (Not your warm one.)
- [ ] Is every mandatory deliverable still present and working?

---

## 3. BEFORE YOU OPEN A MERGE (everyone)

- [ ] Tests pass locally
- [ ] `npm run build` passes if you touched the frontend
- [ ] Conventional commit messages, scoped, no AI trailers
- [ ] You can **explain every line you wrote** — the organizers explicitly warn against
      un-understood AI code, and a judge may ask
- [ ] You updated `04_API_CONTRACT.md` if you changed an endpoint
- [ ] No secrets, no `.env`, no `node_modules`

---

## 4. AUTHORITY

The reviewer can **hold or reject** any merge. `dev` staying green is worth more than
one extra feature landing early.

**Revert beats debug when you're tired.** If `dev` breaks and the author is asleep,
revert the merge and let them fix it when they're up. Do not try to repair someone
else's half-finished work while exhausted — that is how a working demo becomes a
broken one.

---

## 5. USEFUL SKILLS

- `code-review` — structured review of a diff
- `resolving-merge-conflicts` — for exactly the failure described above
- `webapp-testing` — drives a real browser to verify the UI actually works

See `11_AI_TOOLING.md`.
