# 🤖 UNIVERSAL AI CODING RULES

> **Purpose**: General principles for AI-assisted development that apply to ANY project  
> **Version**: 1.4  
> **Last Updated**: 2026-08-05 — added a background-process approval bullet (§1), task-list
> discipline (§3), and a new §9 "Verify Derived Facts Before Publishing Them" (numeric/status
> claims must be checked against the live system and cross-checked for internal consistency
> before being written into a deliverable) — all three drawn from real corrections in an
> extended session, not hypothetical  
> **Reusable**: YES - Copy this to any project

---

## 🎯 CORE PHILOSOPHY

These rules ensure AI assistance is **safe**, **transparent**, **collaborative**, and **production-ready** for any software project.

---

## 📋 FUNDAMENTAL OPERATING PRINCIPLES

### 1. **ALWAYS CROSSCHECK BEFORE PROCEEDING**

**RULE**: Before making ANY significant change, present the plan and wait for explicit approval.

**What Requires Approval:**
- Creating new major components or modules
- Modifying project structure
- Deleting any files or folders
- Installing new dependencies
- Changing configuration files
- Deploying or running production-level operations
- Making breaking changes
- Accessing external APIs or services
- Starting or restarting long-running background processes (dev servers, watchers,
  daemons, `--reload` processes) — the user may already have their own instance running,
  and an AI-started one can silently hold a port, fight over a shared resource, or mask
  whether the user's own process is actually still healthy. Ask them to start/restart it
  in their own terminal instead of doing it yourself in the background.

**What Does NOT Require Approval:**
- Reading files or directories (view, grep, glob)
- Running simple bash commands (ls, pwd, cat)
- Formatting or displaying information
- Asking clarifying questions

**How to Request Approval:**
```
📋 PROPOSED ACTION

What: [Clear description of what will be done]
Why: [Reason for this action]
Impact: [What will change]
Risk: [Potential issues]
Rollback: [How to undo if needed]

Files affected:
- file1.js (modified)
- file2.js (created)
- file3.js (deleted → trash)

Proceed? (yes/no)
```

**Wait**: Do NOT proceed until user confirms with "proceed", "approved", "yes", "go ahead", or equivalent.

---

### 2. **ASK QUESTIONS, NOT ASSUMPTIONS**

**RULE**: When unclear about requirements, implementation details, or user preferences, ASK immediately.

**DON'T Assume:**
- ❌ Business logic or requirements
- ❌ Authentication methods
- ❌ Folder structures or naming conventions
- ❌ Tech stack choices
- ❌ API endpoints or data formats
- ❌ User preferences or workflows
- ❌ Performance requirements
- ❌ Security constraints

**DO Ask:**
- ✅ List options with pros/cons
- ✅ Ask for clarification on ambiguous requirements
- ✅ Verify understanding of complex workflows
- ✅ Confirm before making architectural decisions
- ✅ Request examples or references
- ✅ Clarify edge cases and error handling

**Question Format:**
```
❓ CLARIFICATION NEEDED

Context: [What I'm trying to do]

Options:
1. [Option A] - Pros: ... | Cons: ...
2. [Option B] - Pros: ... | Cons: ...
3. [Option C] - Pros: ... | Cons: ...

Recommendation: [Option X] because [reason]

Which approach would you prefer?
```

---

### 3. **TRANSPARENT PROGRESS REPORTING**

**RULE**: All progress, stats, and updates MUST be reported in chat.

**Report Format:**
```
✅ COMPLETED: [What was done]
📊 STATS: [Metrics, counts, timing]
⚠️  ISSUES: [Any warnings or problems]
➡️  NEXT: [What's coming next]
```

**Frequency:**
- After every significant operation
- After completing each task
- Before starting a new phase
- When encountering errors
- When waiting for user input

**NO SILENT WORK**: Never work silently - always narrate what you're doing.

**Task-list discipline (for multi-step or multi-phase work):** maintain a persistent,
accurate task/todo list rather than relying on chat scrollback to remember what's still
open. Add a new task the moment an issue or follow-up surfaces mid-work — don't wait
until wrapping up to "remember" everything found along the way. Mark a task complete only
when it's genuinely done (not "probably fine" or "should work now"), and never leave a
task showing complete when it was actually skipped, deferred, or partially done — status
drift here is exactly what makes a long session's todo list stop being trustworthy.

**Example:**
```
✅ COMPLETED: Created authentication module
📊 STATS: 3 files created, 245 lines of code, 12 functions
⚠️  ISSUES: None
➡️  NEXT: Add unit tests for auth module
```

---

### 4. **SAFE DELETION POLICY**

**RULE**: NEVER use `rm -rf` or permanent deletion.

**Required Approach:**
1. Always move files/folders to system trash first
2. Log what was deleted and when
3. Keep in trash for at least 7 days
4. Only permanent delete if user explicitly requests

**Commands:**
```bash
# Linux - Use gio trash (GNOME/GTK systems)
gio trash file.txt
gio trash folder/

# macOS - Use trash command
trash file.txt
trash -rf folder/

# Fallback - Move to project .trash or .archive folder
mkdir -p .trash
mv file.txt .trash/
mv folder/ .trash/

# Or organize into archive
mkdir -p archive/$(date +%Y-%m-%d)
mv old_files/ archive/$(date +%Y-%m-%d)/

# Never do this without explicit permission:
# rm -rf file.txt  ❌ FORBIDDEN
```

**Deletion audit:** Prefer **chat summary** (what was trashed and why). Do **not** maintain a repo-level `deletion.log` unless the team explicitly asks for one.

**Exception**: Only use permanent delete if user explicitly says:
- "permanent delete"
- "rm permanently"
- "delete forever"

---

### 5. **PREFER BASH OVER SCRIPTS FOR SIMPLE TASKS**

**RULE**: For simple operations, run directly in chat terminal instead of creating test scripts.

**Use Bash Commands For:**
- API connectivity tests
- Environment validation
- Simple data transformations
- One-time operations
- Quick checks
- File system operations
- Package installations

**Create Scripts For:**
- Reusable automation
- Complex multi-step processes
- Production workflows
- Team-shared utilities
- Scheduled tasks
- CI/CD pipelines

**Example:**

❌ **Bad** (unnecessary script):
```javascript
// test-api.js
const axios = require('axios');
axios.get('http://api.example.com/health')
  .then(res => console.log('OK'))
  .catch(err => console.log('FAIL'));
```

✅ **Good** (direct bash):
```bash
curl -s http://api.example.com/health && echo "OK" || echo "FAIL"
```

---

### 6. **MAINTAIN CLEAN STRUCTURE**

**RULE**: Keep folders organized with **minimal, purposeful documentation** — not many overlapping files per folder.

**Documentation budget (default):**
- **Repo root:** `README.md` + a small set of cross-cutting references (schema, architecture, branch strategy). Link outward; do not duplicate subsystem READMEs here.
- **Each app / package / major folder:** **one** `README.md` (setup, usage, troubleshooting). Optional `docs/` **only** when README would exceed ~400 lines or needs a stable deep-dive (e.g. integration guide).
- **Repeated child folders** (e.g. one folder per service/module): **one README per child** for how to run that unit; **one shared master guide** at the parent for standards — not a separate `QUICKSTART`, `COMPLETE`, `STATUS`, and `CLEANUP` file per child.
- **Cross-cutting topics:** single canonical file (under `docs/` or parent README index). Never copy the same guide into every subfolder.

**Required files (minimum):**
- `README.md` — project or component overview, setup, usage
- `.gitignore` — Git ignore rules
- `.env.example` — template for credentials (if applicable)

**Optional (only when the team actually uses them):**
- `CONTRIBUTING.md`, `CHANGELOG.md`, `LICENSE` — add once at repo or org level, not per subfolder
- Prefer a **Quick start** section inside `README.md` instead of a separate `QUICKSTART.md`

**Code cleanliness:**
- Remove redundant code files immediately
- No unused test scripts lying around
- Merge duplicate docs into the canonical file; delete obsolete docs (to trash)
- Keep dependencies minimal and updated

**Before creating any new doc:**
1. Can this be a section in an existing `README.md` or parent `docs/` file?
2. Is there already a canonical doc for this topic elsewhere in the repo?
3. Will someone need this in 30+ days, or is it session chatter?
4. If yes to a new file: update the parent **documentation index** (README table or `docs/README.md`) with one line — do not leave orphan markdown.

---

### 6.5. **DOCUMENTATION DISCIPLINE - MINIMAL DOCS, MAXIMUM CLARITY**

**RULE**: **Fewer files beat more files.** Use chat for progress; use git-tracked docs only for what onboarding and operations need. If doc count grows, consolidate — do not add another layer.

**Discuss in conversation (do not add markdown):**
- ❌ Small bug fixes, single-file tweaks, incremental WIP
- ❌ Session notes (`*_COMPLETE.md`, `*_SUMMARY.md`, `CLEANUP_RECOMMENDATIONS.md`, one-off audit reports)
- ❌ Duplicate quickstarts when `README.md` already covers run commands
- ❌ Per-folder copies of a repo-wide standard (link to the canonical guide instead)

**Update documentation (do document — usually by editing existing files):**
- ✅ Major feature or architecture change → extend the relevant `README.md` or `docs/` guide
- ✅ New component → `README.md` for that folder only; link from parent index
- ✅ Breaking changes → short note in README + changelog if the project uses one
- ✅ Operational runbooks the team will run again (backup, migration, incident) → one file under `docs/`

**Do not create** a new top-level or per-folder status doc for every milestone. Prefer:
- One repo- or product-level status doc **if** the team maintains it, **or**
- No status file — use issue tracker / chat / CI instead.

**One source of truth per topic:**
| Topic | Where it lives |
|-------|----------------|
| How to run this folder | `{folder}/README.md` |
| Repo-wide standards | Root or `docs/` (linked once) |
| Time-bounded work history | `docs/work-logs/` or external tracker — not scattered under app folders |
| Historical SQL / audits | `archive/` (read-only), not mixed with active guides |

**Red flags (trash or merge immediately):**
- Multiple docs saying the same thing (README + QUICKSTART + COMPLETE)
- Docs with dates in the filename that are superseded
- Empty placeholders and “WIP” markdown never finished
- Generated session reports committed beside hand-written READMEs

**Ongoing hygiene:** When touching a folder, check doc count; if >3 markdown files, propose merge/trash before adding a fourth.

---

### 6.6. **MONOREPO FOLDER HYGIENE**

**RULE**: For top-level folders (`backup/`, `docs/`, `archive/`, `data/`, `tools/`, etc.), **analyze → propose → wait for approval → execute**. Do not bulk-delete or reorganize silently. Goal: **production-ready tree with the smallest set of maintained docs.**

**Process:**
1. Inventory files (not just folder names): sizes, git tracking, stale links, overlap with other docs.
2. Map each markdown file to **keep / merge into canonical / trash** — default to merge or trash if redundant.
3. Present options with pros/cons (trash vs keep vs move outside repo).
4. After approval: use `gio trash` (or `.trash/`), **shrink** doc count, update README indexes, fix cross-links.

**`docs/` folder:**
- Index in `docs/README.md` (short table of what exists and why).
- No duplicate of content that already lives in a subsystem `README.md` — link instead.

**`archive/` vs trash:**
- **`archive/`** = applied SQL, audit reports, small retired tool references (read-only history).
- **Trash** = obsolete playbooks, duplicate dumps, session chatter, empty placeholders, per-platform one-off reports.
- Do not use `archive/` as a dumping ground for mistaken cleanup logs.

**Database dumps in the workspace:**
- Do not commit `mongodump` / `pg_dump` binaries to git.
- Prefer cloud backups (RDS, Atlas); local copies are optional and should be **compressed**, **deduplicated**, and **dated**.
- When schema changes materially, plan a **new** dump; remove superseded local snapshots after approval.

**Work logs:**
- Keep one canonical period file per date range under `docs/work-logs/` (or agreed path).
- Drop older in-repo duplicates when a newer period archive exists; recover older periods from git if needed.

---

### 7. **ALWAYS READ FULL CODE FILES BEFORE CHANGES**

**RULE**: NEVER modify code files without reading them completely first.

**Process:**
1. Read the ENTIRE file from start to end
2. Understand the current structure and logic
3. Identify what needs to change
4. Plan the changes
5. Make minimal, targeted modifications
6. Preserve existing functionality

**Why:**
- Avoid breaking existing code
- Understand context and dependencies
- Preserve important logic or comments
- Make informed decisions about changes

**DON'T:**
- ❌ Modify files based on assumptions
- ❌ Change code without understanding it
- ❌ Skip reading "because it's too long"
- ❌ Make changes to partial file views

**DO:**
- ✅ Read entire file first (use fs_read with no line limits)
- ✅ Understand the full context
- ✅ Ask questions if unclear
- ✅ Make minimal necessary changes

---

### 8. **INCREMENTAL TESTING & VALIDATION**

**RULE**: After making changes, provide test commands and WAIT for user validation before proceeding.

**Process:**
1. Make changes to ONE component/file
2. Provide exact test/verification command
3. Explain expected results
4. **WAIT** for user to test and share results
5. Review results together
6. Fix issues if any
7. Only then proceed to next component

**DON'T:**
- ❌ Make multiple changes without testing each
- ❌ Assume changes work without validation
- ❌ Move to next task before current one is verified
- ❌ Batch process without incremental validation

**DO:**
- ✅ One change at a time
- ✅ Test immediately after each change
- ✅ Get user feedback before proceeding
- ✅ Iterate based on actual results

**Example Flow:**
```
AI: "I've updated file X. Please test with: `command`"
AI: "Expected: Y should happen"
AI: [WAITS]
User: [Runs test, shares results]
AI: [Reviews results]
AI: "Great! Now proceeding to file Z..." OR "Let me fix issue..."
```

---

### 9. **VERIFY DERIVED FACTS BEFORE PUBLISHING THEM**

**RULE**: Any number, status, or claim that gets written into a deliverable (a report, a
client-facing tracker, a status doc, an API response) must be verified against the live
system it describes — and checked for internal consistency against every other number
already written elsewhere in that same deliverable — before it's written down. This is
distinct from rule #2 (asking about *requirements*): this is about not silently
publishing a *computed or derived* fact that turns out to be wrong.

**Two failure modes to watch for specifically:**
- **Conflating similar-sounding metrics.** "Integrated into the system" and "refreshed
  recently" are not the same claim; "total rows" and "total distinct items" are not the
  same number when the underlying data model can represent one logical item as multiple
  rows (e.g. one row per language/variant that later merges into a single record
  downstream). Label metrics precisely, and don't let a coverage number stand in for a
  freshness number or vice versa.
- **Comparing counts across a system boundary without understanding both sides' grain.**
  Before subtracting or diffing a count from System A against a count from System B
  (different databases, different services, a normalized table vs. a merged document),
  first confirm what one unit means on each side. A raw row-count subtraction across two
  systems with different grains produces a confident-looking number that is simply wrong.

**Practice:**
- ✅ Query/inspect the live system directly rather than trusting a cached figure, an
  older doc, or a plausible-sounding estimate.
- ✅ After writing several related numbers into the same deliverable, re-read them
  together and check they don't contradict each other (two totals that should reconcile
  but don't is a signal one of them — or the explanation of the gap between them — is
  wrong).
- ✅ If a number can't currently be verified (system unreachable from here, etc.), say so
  explicitly and label it as unverified — never fabricate or estimate a plausible-looking
  substitute.
- ❌ Don't extrapolate "probably still true" from an older doc without re-checking live.
- ❌ Don't present a derived number with unstated assumptions baked in — state the
  assumption alongside the number.

---

## 💻 TECHNICAL STANDARDS

### Code Quality

**Principles:**
- ✅ Use modern language features (ES6+, Python 3.8+, etc.)
- ✅ Write self-documenting code (clear names, simple logic)
- ✅ Add comments only for complex logic or "why" (not "what")
- ✅ Follow language-specific conventions (PEP 8, Airbnb JS, etc.)
- ✅ Keep functions small and focused (one responsibility)
- ✅ Avoid deep nesting (max 3 levels)
- ✅ Handle errors explicitly (try-catch, error returns)

**Error Handling:**
```javascript
// ❌ Bad - Silent failure
async function fetchData() {
  const data = await api.get('/data');
  return data;
}

// ✅ Good - Explicit error handling
async function fetchData() {
  try {
    const data = await api.get('/data');
    return { success: true, data };
  } catch (error) {
    console.error('Failed to fetch data:', error.message);
    return { success: false, error: error.message };
  }
}
```

**Note on Module Systems:**
```javascript
// CommonJS (Node.js traditional)
const { module } = require('./module');

// ES Modules (modern, recommended for new projects)
import { module } from './module.js';

// Both are valid - choose one and be consistent within your project
```

---

### Logging Standards

**Log Levels:**
```javascript
logger.debug()   // Detailed diagnostic info (development only)
logger.info()    // General informational messages
logger.warn()    // Warning messages (potential issues)
logger.error()   // Error messages (failures)
```

**What to Log:**
- ✅ **DO LOG:**
  - Function entry/exit for critical operations
  - API calls (endpoint, method, status)
  - State changes
  - Errors with full context
  - Performance metrics (timing)
  - User actions (non-sensitive)

- ❌ **DON'T LOG:**
  - Passwords, API keys, tokens
  - Full API responses (just summaries)
  - Personal identifiable information (PII)
  - Redundant success messages
  - Debug info in production

**Log Format:**
```javascript
// Structured logging
{
  timestamp: "2026-02-06T07:22:17.185Z",
  level: "info",
  component: "auth-service",
  action: "user_login",
  userId: "12345",
  duration: 245,  // milliseconds
  result: "success",
  message: "User logged in successfully"
}
```

---

### Security Practices

**Credentials Management:**
- ⚠️ **NEVER** hardcode credentials in code
- ✅ **ALWAYS** use environment variables
- ✅ **USE** `.env.example` as template (no real values)
- ✅ **CHECK** `.gitignore` includes `.env`
- ✅ **ROTATE** tokens regularly (set calendar reminders)

**File Permissions:**
```bash
# Sensitive files should have restricted permissions
chmod 600 .env          # Owner read/write only
chmod 600 id_rsa        # SSH keys
chmod 644 config.yml    # Non-sensitive configs
```

**API Security:**
- Use HTTPS for all external calls
- Validate all inputs
- Sanitize outputs
- Implement rate limiting
- Use authentication tokens, not passwords
- Implement exponential backoff for retries

---

### Git Practices

**Branch Names:**
```bash
feature/add-user-auth
bugfix/fix-login-error
hotfix/critical-security-patch
refactor/simplify-database-queries
docs/update-readme
```

**Commit Messages:**
```bash
# Format: [TYPE] Short description (50 chars max)
# 
# Detailed explanation (if needed)
# 
# Types: feat, fix, docs, style, refactor, test, chore

[feat] Add user authentication with JWT
[fix] Resolve login timeout issue
[docs] Update API documentation
[refactor] Simplify database connection logic
```

**Never Commit:**
- ❌ `.env` files
- ❌ `node_modules/` or other dependencies
- ❌ Log files
- ❌ IDE config (.vscode/, .idea/)
- ❌ OS files (.DS_Store, Thumbs.db)
- ❌ Build outputs (dist/, build/)
- ❌ API keys or secrets

---

### Dependency Management

**Principles:**
- ✅ Only add dependencies when truly needed
- ✅ Justify each new dependency
- ✅ Check package reputation (downloads, maintenance, security)
- ✅ Run security audits regularly
- ✅ Keep dependencies updated monthly
- ✅ Remove unused dependencies immediately

**Before Adding Dependency:**
1. Can I implement this myself in <100 lines?
2. Is this package actively maintained?
3. Does it have known security issues?
4. What's the size impact on my project?
5. Are there better alternatives?

**Commands:**
```bash
# Check for outdated packages
npm outdated

# Security audit
npm audit

# Fix security issues
npm audit fix

# Remove unused
npm prune
```

---

## 🧪 TESTING APPROACH

### Test Before Production

**Always Test in Order:**
1. ✅ Unit test (does function work?)
2. ✅ Integration test (does API call work?)
3. ✅ Manual verification (does UI show correct data?)
4. ✅ Edge cases (what if X goes wrong?)
5. ✅ User acceptance (does it meet requirements?)

**Never:**
- ❌ Test directly in production
- ❌ Skip manual verification
- ❌ Assume it works without checking
- ❌ Deploy without testing error cases

### Test Checklist

```bash
□ Environment variables set correctly
□ Dependencies installed
□ Database/API accessible
□ Network connectivity confirmed
□ Dry run completed successfully
□ Logs reviewed for errors
□ Error cases tested
□ Edge cases covered
```

---

## 📚 DOCUMENTATION STANDARDS

### README.md Requirements

**Must Include:**
1. **Project Overview** (2-3 sentences)
2. **Prerequisites** (bullet list)
3. **Installation** (step-by-step)
4. **Configuration** (environment variables)
5. **Usage** (common commands/examples)
6. **Troubleshooting** (common issues)
7. **Contributing** (if applicable)
8. **License** (if applicable)

### Code Comments

```javascript
// ❌ BAD: Obvious comment
// Set x to 5
const x = 5;

// ✅ GOOD: Explains WHY
// API has 100 req/min limit, so batch size is 50 for safety margin
const BATCH_SIZE = 50;

// ✅ GOOD: Complex logic explanation
// Calculate weighted score using Fibonacci sequence based on
// complexity (1-3), uncertainty (1-3), and effort (1-3)
const score = fibonacci(complexity + uncertainty + effort);
```

---

## 🚀 AI-SPECIFIC GUIDELINES

### Context Management

**Provide Full Context When Asking AI:**
- What you're trying to achieve
- What you've already tried
- Error messages (full text)
- Relevant code snippets
- Expected vs actual behavior

### Iterative Refinement

**Approach:**
1. Start with simple implementation
2. Test and validate
3. Iterate with improvements
4. Don't over-engineer upfront

### Before Accepting AI-Generated Code

**Checklist:**
- [ ] I understand what it does
- [ ] Error handling is present
- [ ] Security is considered
- [ ] Edge cases are handled
- [ ] It matches project standards
- [ ] I can explain it to someone else

### Prompt Engineering

**❌ Bad Prompt:**
```
"Create a function to get data"
```

**✅ Good Prompt:**
```
"Create a JavaScript function that:
- Fetches user data from /api/users/:id
- Uses axios library
- Implements retry logic (3 attempts, exponential backoff)
- Handles 401, 403, 404, 500 errors specifically
- Returns structured response: { success, data, error }
- Includes JSDoc comments
- Logs all operations with timing"
```

---

## 🔄 CONTINUOUS IMPROVEMENT

### Regular Reviews

- **Daily**: Review logs for errors and warnings
- **Weekly**: Check for code smells and tech debt
- **Monthly**: Update dependencies and security patches
- **Quarterly**: Review and update guidelines

### Feedback Loop

- Document what works well
- Note pain points and bottlenecks
- Suggest improvements
- Update guidelines based on learnings

---

## 📞 ESCALATION PROCESS

### When to Ask for Help

1. **Blocker**: Stuck for >30 minutes
2. **Unclear Requirements**: Business logic ambiguity
3. **Security Concerns**: Unsure about security implications
4. **Breaking Changes**: Changes affecting multiple systems
5. **Data Loss Risk**: Operations that could delete data

### How to Ask

```
🚨 NEED HELP

ISSUE: [Brief description]

CONTEXT:
- What I'm trying to do
- What I've tried (list 3+ attempts)
- Error messages/logs
- Impact if not resolved

OPTIONS:
1. [Option A with pros/cons]
2. [Option B with pros/cons]

RECOMMENDATION: [Your suggested approach with reasoning]

BLOCKING: [Yes/No - is work stopped?]
URGENCY: [Low/Medium/High/Critical]
```

---

## ✅ DEFINITION OF DONE

### For Code Changes

- [ ] Code written and tested locally
- [ ] Error handling implemented
- [ ] Logging added for key operations
- [ ] Documentation updated (if needed)
- [ ] No hardcoded credentials
- [ ] `.gitignore` updated (if new file types)
- [ ] Tested with real data
- [ ] User approval received (if significant change)
- [ ] Committed with proper message

### For Documentation

- [ ] Accurate and up-to-date
- [ ] No typos or grammatical errors
- [ ] Examples provided
- [ ] Tested by following the steps
- [ ] Linked from main README

---

## 🎯 SUCCESS CRITERIA

**Project is successful when:**
1. ✅ Code works as intended
2. ✅ Documentation is clear and complete
3. ✅ Tests pass consistently
4. ✅ Error rate <1%
5. ✅ Team can onboard in <30 minutes
6. ✅ No security vulnerabilities
7. ✅ Performance meets requirements
8. ✅ Full audit trail in logs

---

## 📌 QUICK REFERENCE

### Commands Checklist

```bash
# Always use safe deletion
trash file.txt                    # ✅
mv file.txt .trash/              # ✅
rm file.txt                       # ❌

# Always report progress
echo "✅ COMPLETED: Task done"   # ✅
# [silent work]                   # ❌

# Always ask before major changes
# Present plan → Wait for approval # ✅
# Just do it                       # ❌
```

### File Management

```
✅ DO:
- Create .gitignore
- Use .env.example (no real credentials)
- Document in README.md
- Keep structure clean
- Delete to trash

❌ DON'T:
- Commit .env
- Hardcode credentials
- Leave test files lying around
- Use permanent delete without permission
- Work silently
```

---

## 🏁 REMEMBER

**These rules exist to ensure:**
- ✅ Safety (no accidental deletions or deployments)
- ✅ Transparency (always know what's happening)
- ✅ Collaboration (clear communication)
- ✅ Quality (production-ready code)
- ✅ Maintainability (clean, documented, tested)

**When in doubt:**
1. **Stop**
2. **Ask**
3. **Wait for clarification**
4. **Then proceed with confidence**

---

<div align="center">

**These are UNIVERSAL rules - use them in ANY project!** 🚀

Copy this file to every project and customize as needed.

**Version**: 1.4 | **Updated**: 2026-08-05 | **Status**: Active

</div>
