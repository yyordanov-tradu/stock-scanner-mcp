# CI/CD Pipeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Set up GitHub Actions with three workflows: CI on push/PR, weekly dependency audit, and automated npm publish on version tags. Merging to main does NOT publish — only explicit `v*` tags trigger a release.

**Architecture:** Three workflows — (1) CI on every push to main and every PR (type-check, test, build across Node 18 + 22), (2) weekly dependency security audit, (3) npm publish triggered exclusively by `v*` tags (runs full checks then publishes).

**Tech Stack:** GitHub Actions, npm, Node.js 18/22, vitest, tsup, TypeScript

---

### Task 1: CI Workflow

**Files:**
- Create: `.github/workflows/ci.yml`

**Step 1: Create the CI workflow file**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

permissions:
  contents: read

jobs:
  ci:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18, 22]
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: npm

      - run: npm ci

      - name: Type check
        run: npm run lint

      - name: Test
        run: npm test

      - name: Build
        run: npm run build

      - name: Verify dist exists
        run: test -f dist/index.js
```

**Step 2: Verify workflow syntax**

Run: `head -5 .github/workflows/ci.yml`
Expected: `name: CI` visible at top

**Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add CI workflow with lint, test, build on Node 18/22"
```

---

### Task 2: Dependency Audit Workflow

**Files:**
- Create: `.github/workflows/audit.yml`

**Step 1: Create the audit workflow file**

```yaml
name: Security Audit

on:
  schedule:
    - cron: "0 8 * * 1"  # Every Monday at 08:00 UTC
  workflow_dispatch: {}

permissions:
  contents: read

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci

      - name: Audit dependencies
        run: npm audit --omit=dev
```

**Step 2: Commit**

```bash
git add .github/workflows/audit.yml
git commit -m "ci: add weekly dependency security audit"
```

---

### Task 3: Publish Workflow

**Files:**
- Create: `.github/workflows/publish.yml`

**Step 1: Create the publish workflow file**

```yaml
name: Publish to npm

on:
  push:
    tags:
      - "v*"

permissions:
  contents: read

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          registry-url: https://registry.npmjs.org

      - run: npm ci

      - name: Type check
        run: npm run lint

      - name: Test
        run: npm test

      - name: Build
        run: npm run build

      - name: Verify dist exists
        run: test -f dist/index.js

      - name: Publish
        run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

**Step 2: Commit**

```bash
git add .github/workflows/publish.yml
git commit -m "ci: add npm publish workflow triggered by version tags"
```

---

### Task 4: Add CI Badge to README

**Files:**
- Modify: `README.md` (line 2, after the heading)

**Step 1: Add badge to README**

Insert this line between the heading and the description (after line 1, before line 3):

```markdown
[![CI](https://github.com/yyordanov-tradu/stock-scanner-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/yyordanov-tradu/stock-scanner-mcp/actions/workflows/ci.yml)
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add CI status badge to README"
```

---

### Task 5: Push and Verify

**Step 1: Push to GitHub**

```bash
git push origin main
```

**Step 2: Check CI run started**

```bash
gh run list --limit 1
```

Expected: A CI run in progress or completed.

**Step 3: Watch the run**

```bash
gh run watch --exit-status
```

Expected: All jobs pass (type-check, test, build on Node 18 and 22).

---

## Setup Notes (for the human)

### NPM_TOKEN secret

Before the first tagged release, add an npm token as a GitHub repository secret:

1. Generate a token at https://www.npmjs.com/settings/~/tokens — use **Automation** type
2. Go to repo **Settings > Secrets and variables > Actions**
3. Add secret named `NPM_TOKEN` with the token value

### Release process

```bash
npm version patch   # or minor / major — bumps package.json, creates v* tag
git push origin main --tags
# Publish workflow runs automatically on the tag
```

Merging to `main` runs CI only. Publishing happens exclusively via tags.
