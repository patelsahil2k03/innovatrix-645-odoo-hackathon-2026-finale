# 🧹 UNIVERSAL CLEANUP & REORGANIZATION RULES

> **Purpose**: Standard practices for auditing, cleaning up, reorganizing, renaming, and moving files/folders in ANY project — derived from a real multi-folder reorg session (backup/, docs/, data/, reports/, category-taxonomy/, mongodb-bootstrap/, archive/) where structural-only passes repeatedly missed real problems until content was actually inspected.
> **Version**: 1.2
> **Last Updated**: 2026-08-05 — added §2.6 (a "clean up the docs" request means both an
> intra-file pass AND a whole-document redundancy pass — doing one doesn't mean you've done
> the other), a Phase 1 note on anchoring delegated agents to precise pre-verified facts
> rather than a vague audit mandate, and a Phase 3 note on bounding/sampling live-evidence
> verification queries to avoid statement timeouts on large tables
> **Last Updated (previous)**: 2026-08-03 — added §2.5 (ambiguous standing rule driving an irreversible action)
> **Reusable**: YES - Copy this to any project

---

## 🎯 CORE PHILOSOPHY

A reorganization pass that only checks "does this file exist" and "is this filename referenced anywhere" is **not a cleanup — it's a filing exercise**. Real cleanup requires proving, with live evidence, whether content is *correct*, whether it's *used*, and whether touching it is *safe*. This document exists because a structural-only pass on this exact project missed: a script that would silently drop a live production collection, CSVs that were 5+ months stale relative to reality, and a 15-sheet workbook where only 1 sheet was relevant. All of these looked "fine" from directory listings and grep alone.

**When in doubt: inventory → classify → verify with live evidence → propose → wait for approval → execute → re-verify.** Never skip straight from "I found it" to "I moved/deleted it."

---

## 📋 PHASE 1 — INVENTORY (read everything, don't sample)

**RULE**: Before proposing any change, get a complete file listing for the target folder(s), including size, git-tracked status, and last-modified date for every file.

```bash
find <folder> -type f | sort
du -sh <folder>/*/ 2>/dev/null
git ls-files <folder>
git check-ignore -v <folder>/  # is this folder even tracked?
```

**Read every doc file in full.** Not the first 20 lines, not a summary — the whole thing. A stale doc's *own* internal claims (a table listing files, a "consumed by" note) are exactly what phase 2 needs to cross-check, and you can't cross-check what you haven't read.

**For large folders (dozens of files across subsystems), delegate the reading to a background agent** rather than doing 30+ sequential `Read` calls yourself — but only for genuinely unread territory. Don't delegate re-reading of things you already deeply know from earlier in the same session; that wastes a full agent round-trip on already-answered questions.

**When delegating, anchor the agent to specific, pre-verified facts — don't send it off with a vague "go audit this."** Give it the exact old value → exact new value for anything you already know changed, and explicitly instruct it to quote the exact old text in every edit rather than rewriting a section from memory. An agent working from a vague mandate ("check if this doc is up to date") will sometimes confidently "fix" something that wasn't actually wrong, or miss the specific thing that was — an agent handed precise facts and told to edit by exact-text-match does not have that failure mode. Have it report every edit as old→new with surrounding context so you can spot-check before trusting the result.

**DON'T:**
- ❌ Trust a folder's name or a doc's description of its own contents without checking
- ❌ Skip "boring" files (README, config.py) — these are exactly where stale path constants and stale claims hide
- ❌ Assume a quick `ls` is sufficient — you need sizes and dates to spot stale generated output

---

## 🔍 PHASE 2 — CLASSIFY (input vs. report vs. dead vs. dangerous)

Every file in scope falls into one of these buckets. **Determine the bucket by tracing actual code, not by folder location or by what a README claims.**

### 2.1 — Is it a real pipeline *input*, or is it a *report*?

A file "looks like a report" (CSV of stats, tracker-style columns) does not mean it's *only* a report. Trace every consumer:

```bash
grep -rn "<exact filename>" --include="*.py" .
grep -rn "<config constant that points to it>" --include="*.py" .
```

Then **read what the consumer actually does with each column** — don't stop at "yes, this file is imported somewhere." On this project, `Brand Scraping Stats.csv` looked like a status report, but a specific column (`Total Products Scraped English > 0`) is used as a **live filter** deciding which platforms get brand documents created. Refreshing "just the report numbers" on a file like that changes real automation behavior — that's an input, not a report, regardless of what it's named or where it lives.

Conversely, a file can sit in an "inputs" folder and turn out to be pure reporting reference (`Country and Language of Brands.csv` was read only by a report *generator*, to enrich its output — never used to seed or filter anything). Don't assume location implies purpose.

### 2.2 — Is a "referenced" consumer itself live or archived?

Finding one grep hit is not the end of the investigation — check whether that hit is inside an `archive/`, `legacy/`, or otherwise clearly-retired script. A path constant can be "used" only by a script nobody runs. Confirm via the consumer's own README/docstring status label, and via its last-modified / last-log date if available.

### 2.3 — Is it a genuine duplicate?

Before calling two files "redundant," **open both and diff the actual content**, not just the filenames or row counts. On this project, a 2.2MB "coverage report" workbook had 15 sheets; only by opening each sheet and counting *non-empty* rows (Google Sheets pads with hundreds of blank rows) was it possible to confirm exactly one sheet duplicated a standalone CSV byte-for-byte in substance, while the other 14 sheets were unrelated general project-tracker content that didn't belong in the repo at all.

### 2.4 — 🚨 Special danger category: destructive-rebuild-seed files

Before touching ANY file that's read by a bootstrap/setup script, check whether that script can **drop and recreate a live collection/table from the file's contents**. Grep the consumer for `drop(`, `DROP TABLE`, `DELETE FROM`, `truncate`, or a "Collection already has N documents, overwrite?" -style confirmation prompt.

If such a script exists and is documented as something the team might legitimately re-run ("when X changes, run Phase N"), **a stale copy of that seed file is not just outdated documentation — it is a live landmine** that can silently destroy hours/days of work the next time someone answers "yes" to a normal-sounding prompt. This is categorically worse than ordinary staleness and must be flagged as its own line item, separate from routine "this doc is old" findings, e.g.:

> 🚨 **Most important: a live data-loss landmine, not just staleness.** `<file>` is wired into `<script>`, which the team's own docs describe as a normal re-run operation. That script offers to drop the entire live `<collection>` and rebuild it from this file. The file is missing/wrong for N current entries. If anyone answers yes to the re-run prompt, this destroys `<what>`.

Fix priority order for this category: (1) regenerate the seed file from live data immediately so a re-run would be harmless, (2) add a loud in-script warning at the confirmation prompt itself (don't rely on documentation alone — the person about to type "yes" is looking at the terminal, not the README), (3) document it.

### 2.5 — 🚨 Special danger category: an ambiguous standing rule driving an irreversible action

A standing project rule can be read more than one way. If the stricter reading would require
deleting or refusing data, and the looser reading would keep it, **do not silently pick the
stricter reading and act on it at scale** — surface the ambiguity as a question first, especially
when the action is a bulk/irreversible `DELETE` on production data. Verifying *how* a rule applies
(e.g. proving a mechanism via data analysis) is good work and should still happen — the mistake
category here is treating that verification as automatically settling *what to do* with the
result, instead of surfacing it as a decision when the reading is genuinely ambiguous.

**How to apply:**
1. Before executing, ask: is there a real chance the rule's author meant something narrower than
   my current interpretation? If yes, and the action is hard to reverse, ask before acting.
2. Don't silently generalize a prior narrow decision (a small, already-approved case) to a new,
   much larger-scale case without re-confirming — the earlier approval was scoped to what was
   actually shown at the time, not to every superficially-similar situation that follows.
3. **Independent of the above**: before any bulk `DELETE` on production data, export the exact rows
   first (a scoped copy to CSV, or a fresh backup if the project has backup scripts — use them),
   even when confident the data is bad. This turns a wrong judgment call into a cheap restore
   instead of a full rebuild.

### 2.6 — A "cleanup and update the docs" request is two different passes, not one

Fixing stale facts *inside* files (a wrong number, a duplicated heading, a dead
cross-reference) is a different question from whether an entire *file* still needs to
exist as its own document. Doing the first does not mean you've done the second — it's
easy to fix every stale sentence in a set of docs and still miss that two of those docs
now serve the same purpose and should be one.

**Do both, explicitly, whenever a cleanup request spans multiple documents:**
1. **Intra-file pass**: stale facts, duplicate sections, dead links, contradictions
   within a single file.
2. **Inter-file pass**: for every document in scope, ask "does this document's whole
   *purpose* now duplicate, overlap heavily with, or get fully superseded by another
   document's purpose?" — not "do these two files share a filename pattern," but "would
   maintaining both risk them drifting apart because they record the same facts twice."
   This requires reading each candidate document's *stated* purpose (its own intro/header)
   and comparing it against what it *actually* contains, then comparing that against every
   other document with a plausibly-overlapping stated purpose.

If a request only asks for the first and you find candidates for the second along the
way, say so and ask before broadening scope — but don't silently assume the first pass
alone satisfies a "clean up the docs" request that implied both.

---

## 🧪 PHASE 3 — VERIFY WITH LIVE EVIDENCE, NOT ASSUMPTION

**RULE**: "It's probably stale" is not a finding. Prove it against the live system.

- **For data files**: query the actual live database/API and compare numbers directly. A CSV claiming "35,615 products scraped" is refuted by one `SELECT COUNT(*)` against production showing 66,629 — cite the real number, not a vague "this seems low."
- **For code paths after an edit**: don't stop at a syntax check. Actually import the module / run the script's read-only or dry-run mode and confirm it resolves the new path and the target file exists:
  ```bash
  python3 -c "import config; print(config.SOME_PATH); print(os.path.exists(config.SOME_PATH))"
  ```
- **For a bug you just fixed**: run the actual script live (with a safe flag like `--dry-run`, or answering "no" at a write-confirmation prompt) and confirm it now completes without crashing, not just that it "should work now."
- **For duplicate/near-duplicate content claims**: sample real rows from both, don't infer from headers alone.
- **Bound the verification query itself.** An unscoped join/aggregate across a large live
  table (e.g. exploding a JSON array column across a full multi-million-row table to check
  a claim about its contents) can hit a statement timeout and produce nothing — that's not
  evidence either way, and re-running the same unbounded query again wastes another
  timeout. Sample instead: scope to a `LIMIT`-ed or recent-N-rows subset per group first,
  then aggregate within that bounded set. A 50-row-per-category sample that actually
  returns is worth more than an unbounded query that times out.

**DON'T** fabricate or estimate numbers you can't verify. If a column depends on a system you can't query from here (e.g. a vector-search index only reachable from a different service), say so explicitly and mark it "preserved from last known snapshot, needs separate refresh" rather than inventing a plausible-looking value.

---

## 📐 PHASE 4 — CLASSIFY THE *FOLDER*, NOT JUST THE FILE

Once individual files are classified, re-examine whether the **folder itself** still has a reason to exist:

- If every real-content file in a folder has moved out, **remove the folder — don't leave a stub README that only says "moved elsewhere."** An empty folder with a redirect-only doc is overhead with no value; delete it entirely and fix the one or two places that referenced its existence.
- If a folder mixes fundamentally different concerns (a real pipeline input sitting next to a pure human-readable report), question whether they should be co-located at all — but only propose the split once you've confirmed via Phase 2 which is which.

---

## 📋 PHASE 5 — PROPOSE, THEN WAIT

Once classified and verified, present findings as a structured decision, not a fait accompli — matching the project's standing approval-gate rule (see `UNIVERSAL_AI_RULES.md` §1). For reorganization specifically, the proposal should show:

- **What moves/changes, and where to** (old path → new path)
- **Every file that becomes a code change** (config constants, hardcoded paths) — enumerate them, don't say "a few places"
- **The git-tracking consequence** (see Phase 6) — will this file stay version-controlled or silently drop out of tracking?
- **What gets deleted** — via `gio trash` / `git rm`, never bare `rm -rf`, per the project's safe-deletion rule
- Explicit call-out of the danger-category items from §2.4 first, before routine staleness items

Wait for explicit approval before executing. If the user gives a broad "proceed with recommended" across multiple items, that authorizes the *specific* items just presented — it does not authorize skipping the propose-step on the *next* folder.

---

## 🔧 PHASE 6 — EXECUTE SAFELY

### 6.1 — Git tracking consequences of a move are not automatic

Before moving a **tracked** file into a directory, check whether the destination is gitignored:

```bash
git check-ignore -v <destination-path>
```

- If the destination is ignored and the file is currently tracked, the naive `mv` will make the file *look* untracked/deleted next time someone runs a broad `git add`, even though `git mv` itself will correctly show it as staged as long as you use `git mv`/`git rm` (git preserves tracking for files already in the index regardless of ignore rules going forward). Verify with `git status --porcelain` and `git ls-files <new-path>` immediately after the move — don't assume.
- If a folder is blanket-ignored specifically to keep unrelated *generated* files out of git (e.g. a `reports/` folder that should hold both tracked reference CSVs and untracked one-off snapshots), check whether a **narrower** ignore rule elsewhere already achieves the separation (e.g. a global `*.csv` rule) before adding new per-file exceptions — don't stack redundant ignore mechanisms when one already does the job.

### 6.2 — Use the right tool for tracked vs. untracked

- Tracked files → `git mv` (preserves history) / `git rm` (stages deletion properly, use `-f` if there are uncommitted local edits you intend to discard as part of the move)
- Untracked/local-only files → `gio trash` (or platform equivalent) — never bare `rm -rf`, per the project's safe-deletion rule
- After any bulk deletion/move, run `git status --porcelain` on the affected paths and read every line — don't assume the operation did only what you intended

### 6.3 — Batch execution once approved

Once a plan is approved, execute the full batch in one pass rather than re-confirming file-by-file — but do the cross-reference sweep (Phase 7) as part of that same pass, not as a separate follow-up the user has to ask for.

---

## 🔗 PHASE 7 — CROSS-REFERENCE SWEEP (before AND after — expect multiple rounds)

**RULE**: A single grep before the change is not enough. Do it again after, and expect to find more on the second pass than the first.

```bash
grep -rln "<old path or filename>" --include="*.py" --include="*.md" --include="*.sh" --include="*.gitignore" --include="*.json" . 2>/dev/null
```

On this project, fixing one reorganization required **five separate rounds** of this grep as each fix surfaced a new reference the previous pass hadn't caught (a hardcoded path in a completely separate script, a doc cross-link, a comment in a config file, a second doc's "related docs" table). Do not declare the sweep complete after one clean grep — re-run it after every edit until a fresh grep genuinely returns nothing, then state explicitly: *"re-ran the sweep, zero remaining references."*

Also check for **relative-path breakage** when a file moves to a different directory depth (e.g. `../../ai_guidelines/` needs to become `../ai_guidelines/` if the file moved up one level) — grep for `../../` inside anything that moved.

---

## ✅ PHASE 8 — FINAL VERIFICATION

Before declaring a reorganization complete:

1. Re-run the cross-reference grep (Phase 7) — must return zero hits on the old path.
2. Syntax-check every edited script: `python3 -c "import ast; ast.parse(open(f).read())"`.
3. Live-test every changed path constant by importing/resolving it and checking the file exists at the new location.
4. `git status --porcelain` on the full affected scope — confirm every change is either a clean rename/move (`R`), a staged deletion (`D`), or an intended content modification (`M`), with nothing unexpected.
5. Summarize plainly: what moved, what was deleted (and how, trash vs. permanent), what code/docs were updated, and — critically — **name anything you could not fully verify** (e.g. a column sourced from a system you can't query from here) rather than implying full confidence.

---

## 🚫 ANTI-PATTERNS OBSERVED (do not repeat)

- **Treating "not referenced by my grep" as final** without also checking whether the one consumer found is itself dead/archived, and without checking config-constant indirection (a file can be referenced only via a variable name, not its literal filename).
- **Calling files "redundant" from row counts or filenames alone** instead of opening and diffing actual content.
- **Refreshing report numbers without checking whether those same numbers double as a live automation filter.**
- **Leaving a stale placeholder README** in a folder that lost all its real content, instead of asking "does this folder need to exist at all now?"
- **Doing one grep sweep and stopping** — real repos have more cross-references than the first pass finds.
- **Assuming a move's git-tracking outcome instead of checking `git status`/`git ls-files` immediately after.**
- **Fabricating "refreshed" values for a column you can't actually verify** — say plainly that it's unverified instead.

---

## 🏁 REMEMBER

Structural cleanliness (no duplicate filenames, no dead links) is necessary but not sufficient. The real goal is: **every file that remains is either demonstrably correct against live system state, or clearly labeled as unverified** — and nothing that remains can silently destroy production data if someone runs it in six months without reading this file first.

**When in doubt:**
1. **Read the whole file, not a sample**
2. **Trace real code consumption, not folder names or doc claims**
3. **Verify against live data before calling something stale or dead**
4. **Flag destructive-rebuild-seed risk above ordinary staleness**
5. **Propose, wait, execute in one clean batch, then re-sweep for stragglers**

---

<div align="center">

**These are UNIVERSAL rules - use them in ANY project!** 🚀

Copy this file to every project and customize as needed.

**Version**: 1.2 | **Updated**: 2026-08-05 | **Status**: Active

</div>
