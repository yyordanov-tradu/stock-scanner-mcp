# Pre-Flight Checklist

**MANDATORY before starting ANY new feature, bug fix, or creating a worktree/branch.**

## Steps (in order)

1. **Check open PRs:**
   ```bash
   gh pr list --state open
   ```
   If any should merge first, flag to the user before proceeding.

2. **Pull latest main:**
   ```bash
   git checkout main && git pull origin main
   ```

3. **Read activity log and check for Gemini activity** (dual-LLM coordination):
   - Read `docs/duo-planning/activity-log.md` — this is the primary communication channel
   - Review open PRs from Gemini that may conflict with planned work
   - Check `docs/duo-planning/` for in-progress assignments
   - After completing work, append your entry to the activity log

4. **Verify clean baseline:**
   ```bash
   npm test
   ```
   If tests fail on main, fix them before starting new work.

5. **Only then** create your feature branch or worktree.

## Why

Multiple LLMs work on this repo concurrently. Skipping these steps has caused:
- Stale test expectations (tests passing locally but failing on main)
- Merge conflicts from building on outdated code
- Duplicated work when two LLMs pick up the same task
- Push rejections because remote had commits we didn't pull
