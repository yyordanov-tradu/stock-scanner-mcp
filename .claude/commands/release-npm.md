Release a new version to npm. Argument: version bump type ($ARGUMENTS — one of: patch, minor, major). Defaults to "patch" if not specified.

## Steps

1. **Pre-flight checks**
   - Ensure you are on `main` branch with no uncommitted changes
   - `git pull` to get latest
   - Run quality gates: `npm run lint && npm test && npm run build`
   - Stop and report if anything fails

2. **Bump version**
   - Run `npm version $ARGUMENTS --no-git-tag-version` (default: patch)
   - Read the new version from package.json

3. **Create release branch, commit, tag**
   - `git checkout -b release/v<version>`
   - `git add package.json && git commit -m "chore: release v<version>"`
   - `git tag -a v<version> -m "v<version>"`

4. **Push and create PR**
   - `git push -u origin release/v<version> && git push origin v<version>`
   - Create PR to main: `gh pr create --title "chore: release v<version>"`

5. **Merge**
   - Merge: `gh pr merge --squash --auto`
   - `git checkout main && git pull`
   - CI/CD will automatically publish to npm when the tag is pushed
