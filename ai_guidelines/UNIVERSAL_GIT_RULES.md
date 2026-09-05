# 🔀 UNIVERSAL GIT COMMIT RULES

> **Purpose**: Standard practices for Git commits and version control that apply to ANY project  
> **Version**: 1.4  
> **Last Updated**: 2026-08-05 — added §13 "Flag Git State Proactively" (mention when a new
> durable file isn't actually tracked, and flag a session's total uncommitted scope before
> ending — informational only, doesn't change the always-ask-before-committing rule)  
> **Reusable**: YES - Copy this to any project

---

## 🎯 CORE PHILOSOPHY

These rules ensure Git commits are **safe**, **traceable**, **professional**, and **collaborative**.

---

## 📋 FUNDAMENTAL OPERATING PRINCIPLES

### 1. **ALWAYS PROPOSE BEFORE COMMITTING**

**RULE**: Before making ANY commit, present the plan and wait for explicit approval.

**What Requires Approval:**
- Initial repository setup
- Any commit (single or batch)
- Branch creation or deletion
- Merge operations
- Force push operations
- Tag creation
- Remote operations that change state (push, pull, merge)
- .gitignore changes
- Submodule operations

**What Does NOT Require Approval:**
- Viewing git status (`git status`)
- Viewing git log (`git log`)
- Viewing diffs (`git diff`)
- Checking branches (`git branch`)
- `git fetch` — updates remote-tracking refs only, touches no local
  branch or working-tree state; treat it like `git status`

**Batch / Standing Approval:**
A single explicit instruction can authorize an entire multi-commit
batch (e.g. "commit and push everything, in proper phases, proceed")
— this does not require re-confirming before each individual commit
within that batch. It does NOT carry over to later, unrelated work in
a future session; a new batch of changes still needs its own proposal
and approval.

**How to Request Approval:**

If this project's `CLAUDE.md` (or equivalent) already defines a `📋 PROPOSED ACTION`
format, use that one — don't maintain a second, slightly different template for git
specifically; that just invites the two to drift apart. Fill its `What`/`Why`/`Files
affected`/`Rollback` fields with the git-specific detail below.

If no such format exists in this project, use this one:
```
📋 PROPOSED GIT OPERATION

Operation: [commit/push/merge/branch/tag]
Branch: [branch name]
Files affected: [count]

Changes:
- file1.py (modified, +50 -20 lines)
- file2.js (created, +100 lines)
- file3.md (deleted)

Commit message:
---
feat(scrapers): add ounass marketplace scraper

- Implements API-based scraping for Ounass platform
- Supports EN and AR languages
- Includes variant structure for color variants

Closes #123
---

Proceed? (yes/no)
```

**Wait**: Do NOT proceed until user confirms with "proceed", "approved", "yes", "commit", or equivalent.

---

### 2. **COMMIT MESSAGE STANDARDS**

**RULE**: All commits MUST follow Conventional Commits specification.

**Format:**
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types (Required):**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only changes
- `style`: Code style (formatting, semicolons, no logic change)
- `refactor`: Code refactoring (no feature change)
- `perf`: Performance improvement
- `test`: Adding or updating tests
- `chore`: Maintenance (dependencies, config, build)
- `ci`: CI/CD pipeline changes
- `revert`: Revert previous commit

**Scope (Optional but Recommended):**
- Component/module name: `scrapers`, `api`, `dashboard`, `migration`
- Platform name: `ounass`, `namshi`, `levelshoes`
- System name: `postgres`, `mongodb`, `r2`

**Subject (Required):**
- Lowercase, no period at end
- Imperative mood ("add" not "added" or "adds")
- Max 50 characters
- Clear and concise

**Body (Optional but Recommended):**
- Explain WHAT and WHY (not HOW)
- Wrap at 72 characters
- Bullet points for multiple changes
- Reference issues/tickets

**Footer (Optional):**
- `Closes #123` - Closes issue
- `Fixes #456` - Fixes bug
- `Related: #789` - Related issue
- `BREAKING CHANGE:` - Breaking changes

**Trailer Policy (Required):**
- ❌ Do **NOT** add commit trailers such as:
  - `Co-authored-by: ...`
  - `Signed-off-by: ...`
  - `Reviewed-by: ...`
  - `Tested-by: ...`
- ✅ Only keep standard issue/breaking-change footers shown above.
- ✅ If a repository explicitly enforces trailers via hooks/policy, follow repo policy and document the exception in the PR/MR.

This explicitly includes AI coding assistants: even if a tool's default template
appends something like `Co-Authored-By: <assistant name> <noreply@...>`, drop it
before committing in this project. Example of what NOT to do:
```
feat(scrapers): add ounass marketplace scraper

Co-Authored-By: Some AI Assistant <noreply@example.com>   ❌ remove this line
```

**External Dependency Mention Policy (Commit Message):**
- ❌ Do **NOT** reference external AI tools, assistants, vendors, or third-party dependency attributions in commit subject/body/footer.
- ✅ Keep commit text focused on code changes and business/technical intent only.
- ✅ Mention dependency names only when technically necessary for the change itself (e.g., `chore(deps): upgrade fastapi to 0.115.x`).

**Examples:**

✅ **Good:**
```
feat(scrapers): add ounass marketplace scraper

- Implements API-based scraping for Ounass platform
- Supports EN and AR languages with bilingual structure
- Includes variant structure for color variants
- Batch saving with 15-day skip logic

Closes #123
```

```
fix(migration): handle null product_id in postgres migration

Previously, products with null product_id would fail migration.
Now uses SKU as fallback identifier.

Fixes #456
```

```
docs: update README with setup instructions

- Add prerequisites section
- Add step-by-step installation guide
- Add troubleshooting section
```

```
chore: add gitignore for Python and Node projects

- Excludes venv, __pycache__, node_modules
- Excludes backup/, data/, logs/ folders
- Excludes .env files
```

❌ **Bad:**
```
Update files
```

```
Fixed bug
```

```
WIP
```

```
asdfasdf
```

---

### 3. **ATOMIC COMMITS**

**RULE**: Each commit should represent ONE logical change.

**DO:**
- ✅ One feature per commit
- ✅ One bug fix per commit
- ✅ Related changes together (e.g., function + tests)
- ✅ Small, focused commits

**DON'T:**
- ❌ Multiple unrelated changes in one commit
- ❌ Mixing features and bug fixes
- ❌ Massive commits with 50+ files
- ❌ "WIP" or "misc changes" commits

**Example:**

✅ **Good (Atomic):**
```
Commit 1: feat(scrapers): add ounass scraper
Commit 2: feat(scrapers): add namshi scraper
Commit 3: docs: update scraper documentation
```

❌ **Bad (Non-Atomic):**
```
Commit 1: Add ounass, namshi, fix bug in levelshoes, update docs, refactor database
```

---

### 4. **BRANCH STRATEGY**

**RULE**: Use branches for features, fixes, and experiments.

**Branch Naming:**
```
<type>/<short-description>

Examples:
- feature/add-ounass-scraper
- fix/migration-null-handling
- docs/update-readme
- refactor/database-connection
- hotfix/critical-security-patch
```

**Main Branches:**
- `main` - Production-ready code
- `develop` - Integration branch (optional)

**Feature Branches:**
- Branch from `main` or `develop`
- Merge back via Pull Request
- Delete after merge

**Workflow:**
```bash
# Create feature branch
git checkout -b feature/add-ounass-scraper

# Make changes and commit
git add .
git commit -m "feat(scrapers): add ounass scraper"

# Push to remote
git push origin feature/add-ounass-scraper

# Create Pull Request on GitLab/GitHub
# After review and approval, merge to main
# Delete feature branch
```

---

### 5. **STAGING DISCIPLINE**

**RULE**: Stage files intentionally, not blindly.

**DO:**
- ✅ Review changes before staging: `git diff`
- ✅ Stage specific files: `git add file1.py file2.js`
- ✅ Stage by hunks: `git add -p` (interactive)
- ✅ Verify staged changes: `git diff --staged`

**DON'T:**
- ❌ `git add .` without reviewing
- ❌ `git add *` blindly
- ❌ Stage unrelated files
- ❌ Stage generated files (build artifacts, logs)

**Workflow:**
```bash
# 1. Check status
git status

# 2. Review changes
git diff

# 3. Stage specific files
git add marketplace-scraper/ounass/local_scraper.py
git add marketplace-scraper/ounass/config.json

# 4. Verify staged changes
git diff --staged

# 5. Commit
git commit -m "feat(scrapers): add ounass scraper"
```

---

### 6. **NEVER COMMIT SENSITIVE DATA**

**RULE**: NEVER commit credentials, secrets, or sensitive data.

**Never Commit:**
- ❌ `.env` files with real credentials
- ❌ API keys, tokens, passwords
- ❌ Private keys (SSH, SSL, JWT)
- ❌ Database credentials
- ❌ AWS access keys
- ❌ Personal information (PII)

**Always Commit:**
- ✅ `.env.example` (template without real values)
- ✅ `.gitignore` (to prevent accidental commits)
- ✅ Documentation about required environment variables

**If Accidentally Committed:**
1. **DO NOT** just delete and commit again (still in history!)
2. Rotate/revoke the exposed credentials immediately
3. Use `git filter-branch` or `BFG Repo-Cleaner` to remove from history
4. Force push (with team coordination)

---

### 7. **GITIGNORE DISCIPLINE**

**RULE**: Maintain comprehensive .gitignore from day one.

**Always Ignore:**
```gitignore
# Environment & Secrets
.env
.env.local
*.key
*.pem

# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
.venv/
venv/
ENV/
env/
*.egg-info/

# Node
node_modules/
dist/
build/
.cache/

# Runtime Data
backup/
data/
logs/
*.log
archive/
.trash/

# IDE
.vscode/
.idea/
.kiro/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Database
*.dump
*.sql.gz
*.bson

# Large files
*.zip
*.tar.gz
```

**Project-Specific:**
- Add patterns for your specific project
- Document why certain patterns are ignored
- Review .gitignore regularly

---

### 8. **COMMIT FREQUENCY**

**RULE**: Commit often, but meaningfully.

**Good Frequency:**
- ✅ After completing a logical unit of work
- ✅ After fixing a bug
- ✅ After adding a feature
- ✅ Before switching tasks
- ✅ At end of work session

**Bad Frequency:**
- ❌ Every 5 minutes (too frequent, meaningless)
- ❌ Once a week (too infrequent, massive commits)
- ❌ "WIP" commits every hour

**Rule of Thumb:**
- If you can't write a clear commit message, it's not ready to commit
- If commit message is >5 bullet points, split into multiple commits

---

### 9. **PUSH DISCIPLINE**

**RULE**: Push regularly, but verify first.

**Before Pushing:**
1. ✅ Run tests (if available)
2. ✅ Verify code compiles/runs
3. ✅ Review commit history: `git log`
4. ✅ Check remote status: `git fetch`
5. ✅ Pull latest changes: `git pull --rebase`

**Push Frequency:**
- ✅ At least once per day (if working on shared branch)
- ✅ After completing a feature
- ✅ Before leaving for the day
- ✅ Before switching branches

**Never:**
- ❌ Force push to `main` without team coordination
- ❌ Push broken code
- ❌ Push without pulling first (on shared branches)

---

### 10. **MERGE STRATEGY**

**RULE**: Use Pull Requests for feature branches; direct push for integration branches.

#### **When to Use Direct Push (No MR Needed):**

**Working on `dev` or `develop` branch:**
```bash
git checkout dev
git pull origin dev
# Make changes
git add <files>
git commit -m "message"
git push origin dev  # ✅ Direct push is fine
```

**This is CORRECT because:**
- ✅ `dev` is the integration branch (not protected)
- ✅ Direct commits to `dev` are allowed for team members
- ✅ No merge request needed for `dev` → `dev`
- ✅ Faster workflow for ongoing development

**Note:** GitLab/GitHub may show "Create merge request" message after push - this is just a suggestion to merge `dev` into another branch (like `staging` or `main`). You can ignore it.

#### **When to Use Merge Request (MR/PR Required):**

**Scenario 1: Feature Branch → dev**
```bash
git checkout -b feature/add-ounass-scraper
# Make changes
git commit -m "feat(scrapers): add ounass scraper"
git push origin feature/add-ounass-scraper
# Create MR: feature/add-ounass-scraper → dev ✅
```

**Scenario 2: dev → staging**
```bash
# After testing on dev
# Create MR: dev → staging ✅
# Requires approval before merge
```

**Scenario 3: staging → main**
```bash
# After QA on staging
# Create MR: staging → main ✅
# Requires approval before production deployment
```

**Scenario 4: Hotfix → main + dev**
```bash
git checkout -b hotfix/critical-bug
# Fix the bug
git commit -m "hotfix: fix critical security issue"
git push origin hotfix/critical-bug
# Create MR: hotfix/critical-bug → main ✅
# After merge to main, also merge to dev
```

#### **Branch Protection Levels:**

| Branch | Direct Push | Requires MR | Protection Level |
|--------|-------------|-------------|------------------|
| `main` / `master` | ❌ Never | ✅ Always | High (production) |
| `staging` / `preprod` | ❌ Never | ✅ Always | Medium (pre-prod) |
| `dev` / `develop` | ✅ Allowed | ❌ Not needed | Low (integration) |
| `feature/*` | ✅ Own branch | ✅ To merge | None (personal) |
| `fix/*` | ✅ Own branch | ✅ To merge | None (personal) |
| `hotfix/*` | ✅ Own branch | ✅ To merge | High (urgent) |

**Note:** Branch names may vary by project (`main` vs `master`, `dev` vs `develop`). Adjust based on your project's conventions.

#### **Merge Methods:**
- **Merge commit** - Preserves full history (default)
- **Squash and merge** - Combines commits into one (clean history)
- **Rebase and merge** - Linear history (advanced)

**Choose based on:**
- Team preference
- Project complexity
- History readability needs

---

### 11. **REVERT, DON'T DELETE**

**RULE**: If a commit causes issues, revert it (don't delete from history).

**Revert a Commit:**
```bash
# Revert specific commit
git revert <commit-hash>

# Revert creates a NEW commit that undoes changes
# History is preserved
```

**DON'T:**
```bash
# Don't force delete commits (unless absolutely necessary)
git reset --hard HEAD~1  # ❌ Dangerous on shared branches
git push --force         # ❌ Breaks others' work
```

**When to Force Push:**
- Only on personal feature branches
- Only before others have pulled
- With team coordination

---

### 12. **COMMIT VERIFICATION**

**RULE**: Always verify commits before pushing.

**Verification Checklist:**
```bash
# 1. Check status
git status

# 2. View commit history
git log --oneline -5

# 3. View last commit details
git show

# 4. Check diff of last commit
git diff HEAD~1

# 5. Verify remote
git remote -v

# 6. Check branch
git branch -a
```

---

### 13. **FLAG GIT STATE PROACTIVELY — DON'T ACT ON IT WITHOUT ASKING**

**RULE**: "Never commit without asking" (rule #1) is about *acting*. It does not mean stay
silent about git state the user would want to know — noticing and mentioning is not the
same as committing.

**After creating a file meant to persist** (a durable doc, not session chatter): check
whether it's actually tracked (`git status` / `git ls-files <path>`) and say so if it
isn't. Selective staging discipline (rule #5) means files don't get swept into git by a
blind `git add .` — which also means a genuinely important new file can sit untracked
indefinitely with nobody noticing, because nobody ever explicitly staged it. "I created
the file" is not the same claim as "it's safely in version control" — don't let the two
blur together in how you report completion.

**Before ending a session with a substantial amount of uncommitted work**: mention the
scope (roughly how many files, which areas) so the user knows how much is sitting only in
the working tree. Uncommitted changes are more fragile than committed ones — lost more
easily to an accidental `checkout`/`reset`, a disk issue, or simply forgetting what's
pending days later. This is a one-line heads-up, not a recommendation to commit — the
decision of when to commit stays exactly where rule #1 already puts it.

---

## 🚀 INITIAL REPOSITORY SETUP

### Step-by-Step Process

**1. Create .gitignore FIRST**
```bash
# Create comprehensive .gitignore before git init
# See section 7 for template
```

**2. Initialize Repository**
```bash
git init
git remote add origin <remote-url>
```

**3. Initial Commit Strategy**

**Option A: Single Initial Commit (Quick)**
```bash
git add .
git commit -m "chore: initial project setup"
git push -u origin main
```

**Option B: Logical Commits (Professional)**
```bash
# Commit 1: Documentation
git add README.md LICENSE .gitignore
git commit -m "docs: add project documentation and gitignore"

# Commit 2: Core infrastructure
git add src/ requirements.txt
git commit -m "feat: add core project infrastructure"

# Commit 3: Configuration
git add config/ .env.example
git commit -m "chore: add configuration files"

# Push all
git push -u origin main
```

**Recommendation:** Option B for professional projects

---

## 📊 COMMIT STATISTICS

**Good Commit Metrics:**
- Average commit size: 50-200 lines changed
- Commit frequency: 3-10 commits per day
- Commit message length: 50-200 characters (subject + body)
- Files per commit: 1-10 files

**Red Flags:**
- ❌ Commits with 1000+ lines changed
- ❌ Commits with 50+ files
- ❌ Commit messages <10 characters
- ❌ "WIP", "fix", "update" messages

**Exception — mechanical refactors/renames:** these thresholds target commits
mixing unrelated *logical* changes, not raw size. A single `git mv`-chain
restructuring (e.g. consolidating a folder tree, renaming a package across
dozens of files) is still one atomic logical change even at 50+ files or
tens of thousands of changed lines — splitting it artificially would require
re-doing the moves in stages that were never separately committed, adding
risk for no traceability benefit. Judge atomicity by "is this one coherent
change," not by file/line count alone.

---

## 🔍 CODE REVIEW CHECKLIST

**Before Creating PR:**
- [ ] All commits follow message standards
- [ ] Each commit is atomic
- [ ] No sensitive data committed
- [ ] Tests pass (if applicable)
- [ ] Code is formatted
- [ ] Documentation updated
- [ ] .gitignore is comprehensive

**During Review:**
- [ ] Code quality
- [ ] Test coverage
- [ ] Documentation clarity
- [ ] Commit message quality
- [ ] No merge conflicts

---

## 🚨 EMERGENCY PROCEDURES

### Committed Sensitive Data

```bash
# 1. Rotate credentials IMMEDIATELY
# 2. Remove from history (use BFG Repo-Cleaner)
bfg --delete-files .env
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# 3. Force push (coordinate with team)
git push --force
```

### Accidentally Committed to Wrong Branch

```bash
# 1. Create new branch from current state
git branch feature/correct-branch

# 2. Reset current branch
git reset --hard origin/main

# 3. Switch to correct branch
git checkout feature/correct-branch
```

### Need to Undo Last Commit (Not Pushed)

```bash
# Keep changes, undo commit
git reset --soft HEAD~1

# Discard changes, undo commit
git reset --hard HEAD~1
```

---

## 📝 QUICK REFERENCE

### Daily Workflow

```bash
# Morning: Pull latest
git pull --rebase

# Work: Make changes
# ... edit files ...

# Check status
git status

# Review changes
git diff

# Stage files
git add file1.py file2.js

# Commit
git commit -m "feat(module): add new feature"

# Push
git push

# Evening: Push remaining work
git push
```

### Common Commands

```bash
# Status
git status
git log --oneline -10

# Staging
git add <file>
git add -p  # Interactive staging

# Committing
git commit -m "message"
git commit --amend  # Fix last commit

# Branching
git branch
git checkout -b feature/new-feature
git merge feature/new-feature

# Remote
git fetch
git pull
git push
git remote -v

# Undoing
git reset --soft HEAD~1  # Undo commit, keep changes
git revert <commit>      # Revert commit (safe)
```

---

## ✅ DEFINITION OF DONE (Git)

**A commit is "done" when:**
- [ ] Follows commit message standards
- [ ] Is atomic (one logical change)
- [ ] No sensitive data included
- [ ] Passes tests (if applicable)
- [ ] Reviewed and approved (for PRs)
- [ ] Pushed to remote
- [ ] Documented (if needed)

---

## 🎯 SUCCESS CRITERIA

**Project has good Git hygiene when:**
1. ✅ All commits follow standards
2. ✅ Commit history is readable
3. ✅ No sensitive data in history
4. ✅ .gitignore is comprehensive
5. ✅ Branches are organized
6. ✅ PRs are used for code review
7. ✅ No force pushes to main
8. ✅ Regular, meaningful commits

---

## 🏁 REMEMBER

**These rules exist to ensure:**
- ✅ Safety (no accidental data loss or exposure)
- ✅ Traceability (clear history of changes)
- ✅ Collaboration (easy for team to understand)
- ✅ Professionalism (industry-standard practices)
- ✅ Maintainability (easy to debug and rollback)

**When in doubt:**
1. **Stop**
2. **Propose the commit plan**
3. **Wait for approval**
4. **Then commit with confidence**

---

<div align="center">

**These are UNIVERSAL rules - use them in ANY project!** 🚀

Copy this file to every project and follow religiously.

**Version**: 1.4 | **Updated**: 2026-08-05 | **Status**: Active

</div>
