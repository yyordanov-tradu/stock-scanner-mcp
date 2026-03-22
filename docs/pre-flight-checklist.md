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

3. **Review open PRs:**
   - Check if any open PRs might conflict with planned work
   - Review any pending review comments

4. **Verify clean baseline:**
   ```bash
   npm test
   ```
   If tests fail on main, fix them before starting new work.

5. **Check for untracked files:**
   ```bash
   git status
   ```
   If there are untracked files that shouldn't be committed (IDE config, local drafts), add them to `.gitignore` before creating your branch.

6. **Only then** create your feature branch or worktree.

## Why

Skipping these steps has caused:
- Stale test expectations (tests passing locally but failing on main)
- Merge conflicts from building on outdated code
- Push rejections because remote had commits we didn't pull
