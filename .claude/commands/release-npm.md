Release a new version to npm. Argument: version bump type ($ARGUMENTS — one of: patch, minor, major). Defaults to "patch" if not specified.

## Steps

1. **Pre-flight checks**
   - Check current branch — if NOT on `main`, automatically switch: `git checkout main`
   - Ensure working tree is clean (no uncommitted changes). Untracked files are OK.
   - Sync with remote: `git pull` to get latest
   - Verify local `main` matches `origin/main` (no unpushed commits)
   - Run quality gates: `npm run lint && npm test && npm run build`
   - Stop and report if anything fails

2. **Bump version**
   - Run `npm version $ARGUMENTS --no-git-tag-version` (default: patch)
   - Read the new version from package.json

3. **Update version references across the project**
   - Update `CLAUDE.md` version string (e.g. `**Version:** X.Y.Z`)
   - Update `README.md` if it contains a hardcoded version reference
   - **Update `.claude-plugin/plugin.json` `version` to match `package.json`** — the Claude Code plugin manifest carries its own copy. `npm version` does not touch it, so it must be bumped here in lockstep. `src/__tests__/plugin-manifests.test.ts` fails CI if they drift, but updating both in the same commit avoids a red test mid-release.
   - Verify module/tool counts in `README.md` and `CLAUDE.md` still match reality

4. **Create release branch, commit, tag**
   - `git checkout -b release/v<version>`
   - `git add package.json CLAUDE.md README.md .claude-plugin/plugin.json && git commit -m "chore: release v<version>"`
   - `git tag -a v<version> -m "v<version>"`

5. **Push and create PR**
   - `git push -u origin release/v<version> && git push origin v<version>`
   - Create PR to main: `gh pr create --title "chore: release v<version>"`

6. **Merge**
   - Merge: `gh pr merge --squash --auto`
   - `git checkout main && git pull`
   - CI/CD will automatically publish to npm when the tag is pushed
