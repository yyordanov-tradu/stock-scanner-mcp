# Implementation Plan: Make stock-scanner-mcp Installable as a Claude Code Plugin

> Built from `docs/specs/2026-06-19-claude-code-plugin-install-design.md` via the expert-advised-planning workflow (7 advisers: architecture, test-strategy, security, performance, javascript-pro, typescript-pro, database-optimizer). One decision was escalated to a human and resolved: `marketplace.json` requires a top-level `owner` object (verified against the live schemastore schema + official Claude Code docs).

## Goal
Let anyone install this MCP server as a Claude Code plugin with two commands (`/plugin marketplace add yyordanov-tradu/stock-scanner-mcp` then `/plugin install stock-scanner@tradu-marketplace`), after which `/mcp` shows the `stock-scanner` server connected.

## Architecture
Three declarative manifest files form the plugin contract: `.claude-plugin/plugin.json` (plugin identity + version), `.claude-plugin/marketplace.json` (catalog entry so `/plugin marketplace add` works), and `.mcp.json` (how Claude Code launches the server). The server launches via `npx -y stock-scanner-mcp`, which fetches the already-public npm tarball — no committed `dist/`, no build hook. One vitest test reads all three files from disk and asserts the contract (version lockstep, name invariant, npx start mechanism, exact env key set) so it fails in CI on any future drift. This PR is config + manifests + one test + minimal docs only — zero runtime code changes and zero new dependencies.

## Tech Stack
TypeScript (ESM, `"type": "module"`, `module: Node16`), Node.js, vitest, tsup. Manifests are plain JSON.

---

## Important constants (use these exact strings everywhere)

- Plugin name (install key): `stock-scanner`
- npm package name (what npx fetches): `stock-scanner-mcp`
- MCP server key (in `.mcp.json`): `stock-scanner`
- Marketplace name: `tradu-marketplace`
- Owner name: `Yordan Yordanov`
- Marketplace `source`: `./` (exactly this — NOT `./.` and NOT `.`)

The plugin name, the marketplace plugin entry name, and the MCP server key are all `stock-scanner`. The npm package name `stock-scanner-mcp` is a deliberately separate namespace. Do not conflate them.

---

## TASK 0 — Pre-flight (MANDATORY before any code)

Multiple LLMs work this repo concurrently. The current branch `release/v1.17.0` must NOT be the base — branch from updated `main`.

### Step 0.1 — Check open PRs for conflicts
```bash
cd /Users/yyordanov/dev/repos/stock-scanner-mcp && gh pr list --state open --json number,title,headRefName
```
Expected: a list (possibly empty). Confirm no open PR already touches `.mcp.json`, `.claude-plugin/`, or `src/__tests__/plugin-manifests.test.ts`. If one does, STOP and report it.

### Step 0.2 — Switch to main and update it
```bash
cd /Users/yyordanov/dev/repos/stock-scanner-mcp && git checkout main && git pull origin main
```
Expected: `Switched to branch 'main'` and `Already up to date.` or a fast-forward summary.

### Step 0.3 — Confirm the untracked review doc is left alone
```bash
cd /Users/yyordanov/dev/repos/stock-scanner-mcp && git status --porcelain
```
Expected: at most `?? docs/reviews/2026-06-11-pr-212.md`. Do NOT add this file to the PR. If other tracked changes appear, STOP and report.

### Step 0.4 — Clean baseline: run the full test suite on updated main
```bash
cd /Users/yyordanov/dev/repos/stock-scanner-mcp && npm install && npm test
```
Expected: all tests pass (vitest exits 0, e.g. `Test Files  N passed`). If any test fails on clean main, STOP — the failure is pre-existing and must be reported, not blamed on this work.

### Step 0.5 — Create the feature branch from updated main
```bash
cd /Users/yyordanov/dev/repos/stock-scanner-mcp && git checkout -b feat/claude-code-plugin-install
```
Expected: `Switched to a new branch 'feat/claude-code-plugin-install'`.

### Step 0.6 — Confirm npm package is public (sanity check the npx anchor)
```bash
npm view stock-scanner-mcp version
```
Expected: `1.17.0` (no auth prompt). This confirms `npx -y stock-scanner-mcp` will resolve.

---

## TASK 1 — Write the failing manifest-validation test (TDD red)

We write the test FIRST. It will fail because `marketplace.json` does not exist, `plugin.json` is at `0.1.0`, and `.mcp.json` uses the `node dist/` path.

### Step 1.1 — Create the test file

Create `src/__tests__/plugin-manifests.test.ts` with this exact content:

```typescript
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

// Resolve the repo root from this test file (src/__tests__/ -> repo root is two levels up).
// Anchored to import.meta.url (NOT process.cwd()) so it is stable regardless of where vitest runs.
const __testDir = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__testDir, "..", "..");

function readJson(relPath: string): unknown {
  const abs = path.join(REPO_ROOT, relPath);
  return JSON.parse(fs.readFileSync(abs, "utf-8"));
}

interface PackageJson {
  name: string;
  version: string;
}
interface PluginJson {
  name: string;
  version: string;
}
interface McpServer {
  command: string;
  args: string[];
  env: Record<string, string>;
}
interface McpJson {
  mcpServers: Record<string, McpServer>;
}
interface MarketplacePlugin {
  name: string;
  source: string;
}
interface MarketplaceJson {
  name: string;
  owner: { name: string };
  plugins: MarketplacePlugin[];
}

describe("plugin manifests", () => {
  it("all three manifest files parse as JSON", () => {
    expect(() => readJson("package.json")).not.toThrow();
    expect(() => readJson(".claude-plugin/plugin.json")).not.toThrow();
    expect(() => readJson(".claude-plugin/marketplace.json")).not.toThrow();
    expect(() => readJson(".mcp.json")).not.toThrow();
  });

  it("plugin.json version is in lockstep with package.json version", () => {
    const pkg = readJson("package.json") as PackageJson;
    const plugin = readJson(".claude-plugin/plugin.json") as PluginJson;
    // Sourced dynamically from package.json — never hardcode a version string here.
    expect(typeof pkg.version).toBe("string");
    expect(plugin.version).toBe(pkg.version);
  });

  it("name invariant holds across plugin.json and marketplace.json", () => {
    const plugin = readJson(".claude-plugin/plugin.json") as PluginJson;
    const marketplace = readJson(".claude-plugin/marketplace.json") as MarketplaceJson;
    expect(plugin.name).toBe("stock-scanner");
    expect(marketplace.name).toBe("tradu-marketplace");
    expect(marketplace.plugins[0].name).toBe("stock-scanner");
    expect(marketplace.plugins[0].name).toBe(plugin.name);
  });

  it("marketplace.json has a required non-empty owner.name", () => {
    const marketplace = readJson(".claude-plugin/marketplace.json") as MarketplaceJson;
    expect(marketplace.owner).toBeDefined();
    expect(typeof marketplace.owner.name).toBe("string");
    expect(marketplace.owner.name.length).toBeGreaterThan(0);
  });

  it("marketplace.json plugin source is exactly './'", () => {
    const marketplace = readJson(".claude-plugin/marketplace.json") as MarketplaceJson;
    expect(marketplace.plugins[0].source).toBe("./");
  });

  it(".mcp.json starts the server via npx, not a committed dist path", () => {
    const mcp = readJson(".mcp.json") as McpJson;
    const server = mcp.mcpServers["stock-scanner"];
    expect(server).toBeDefined();
    expect(server.command).toBe("npx");
    expect(server.args).toContain("stock-scanner-mcp");
    expect(server.args).toContain("-y");
    // Negative assertion: the rejected dist/-commit path must never come back.
    expect(server.args).not.toContain("${CLAUDE_PLUGIN_ROOT}/dist/index.js");
    expect(server.args.some((a) => a.includes("dist/index.js"))).toBe(false);
  });

  it(".mcp.json env passthrough is exactly the three optional API keys", () => {
    const mcp = readJson(".mcp.json") as McpJson;
    const env = mcp.mcpServers["stock-scanner"].env;
    expect(new Set(Object.keys(env))).toEqual(
      new Set(["FINNHUB_API_KEY", "ALPHA_VANTAGE_API_KEY", "FRED_API_KEY"]),
    );
    // Each value must be the ${VAR} self-reference form — never a literal secret.
    expect(env.FINNHUB_API_KEY).toBe("${FINNHUB_API_KEY}");
    expect(env.ALPHA_VANTAGE_API_KEY).toBe("${ALPHA_VANTAGE_API_KEY}");
    expect(env.FRED_API_KEY).toBe("${FRED_API_KEY}");
  });
});
```

### Step 1.2 — Run the test and confirm it FAILS

```bash
cd /Users/yyordanov/dev/repos/stock-scanner-mcp && npm test -- --run src/__tests__/plugin-manifests.test.ts
```
Expected: FAILURES. Specifically the "all three manifest files parse" test throws (`marketplace.json` does not exist, `ENOENT`), the version-lockstep test fails (`0.1.0` !== `1.17.0`), and the npx test fails (`command` is `node`). This red state confirms the test actually checks the contract.

---

## TASK 2 — Make the test pass: create and fix the manifests (TDD green)

### Step 2.1 — Create `.claude-plugin/marketplace.json`

Create `/Users/yyordanov/dev/repos/stock-scanner-mcp/.claude-plugin/marketplace.json` with this exact content:

```json
{
  "$schema": "https://json.schemastore.org/claude-code-marketplace.json",
  "name": "tradu-marketplace",
  "owner": {
    "name": "Yordan Yordanov"
  },
  "plugins": [
    {
      "name": "stock-scanner",
      "source": "./",
      "description": "Stock and crypto market data for Claude Code -- technical indicators, news, filings, fundamentals, and crypto metrics from free APIs",
      "category": "data"
    }
  ]
}
```

Note: no per-plugin `version` field here. The plugin version lives only in `plugin.json` so there is exactly one copy to keep in sync. The `$schema` field is ignored by Claude Code at load and exists only for editor autocomplete.

### Step 2.2 — Bump `plugin.json` version to match package.json

Edit `/Users/yyordanov/dev/repos/stock-scanner-mcp/.claude-plugin/plugin.json`. Change the version line:

Old:
```json
  "version": "0.1.0",
```
New:
```json
  "version": "1.17.0",
```

### Step 2.3 — Rewrite `.mcp.json` to use npx with all three keys

Replace the entire contents of `/Users/yyordanov/dev/repos/stock-scanner-mcp/.mcp.json` with:

```json
{
  "mcpServers": {
    "stock-scanner": {
      "command": "npx",
      "args": ["-y", "stock-scanner-mcp"],
      "env": {
        "FINNHUB_API_KEY": "${FINNHUB_API_KEY}",
        "ALPHA_VANTAGE_API_KEY": "${ALPHA_VANTAGE_API_KEY}",
        "FRED_API_KEY": "${FRED_API_KEY}"
      }
    }
  }
}
```

This drops the `node ${CLAUDE_PLUGIN_ROOT}/dist/index.js` launch (the dist/ dir is gitignored and never committed) and adds the previously-missing `FRED_API_KEY` passthrough. An unset `${FRED_API_KEY}` resolves to an empty string; `registry.ts` uses a truthy guard (`config.env.FRED_API_KEY ? createFredModule(...) : null`), so the FRED module is simply skipped — zero code change, zero risk.

### Step 2.4 — Run the test and confirm it PASSES

```bash
cd /Users/yyordanov/dev/repos/stock-scanner-mcp && npm test -- --run src/__tests__/plugin-manifests.test.ts
```
Expected: all tests pass (e.g. `Test Files  1 passed`, `Tests  7 passed`).

### Step 2.5 — Commit the manifests + test together

```bash
cd /Users/yyordanov/dev/repos/stock-scanner-mcp && git add .claude-plugin/marketplace.json .claude-plugin/plugin.json .mcp.json src/__tests__/plugin-manifests.test.ts && git commit -m "feat: make installable as a Claude Code plugin via npx"
```
Expected: a commit summary listing 4 files changed.

---

## TASK 3 — Run full quality gates

This is a config-only change, but the gates are the project's merge requirement and the new test file participates in build/typecheck.

### Step 3.1 — Type-check
```bash
cd /Users/yyordanov/dev/repos/stock-scanner-mcp && npm run lint
```
Expected: `tsc --noEmit` exits 0 with no output (no type errors). If `unknown`-narrowing errors appear in the test, they indicate a typo — the casts in Task 1 already handle the parsed JSON types.

### Step 3.2 — Full test suite
```bash
cd /Users/yyordanov/dev/repos/stock-scanner-mcp && npm test
```
Expected: all tests pass, including the new `plugin-manifests.test.ts`.

### Step 3.3 — Tool description validation
```bash
cd /Users/yyordanov/dev/repos/stock-scanner-mcp && npm run validate-tools
```
Expected: passes (no tool descriptions changed, so this is unaffected — confirm it exits 0).

### Step 3.4 — Build
```bash
cd /Users/yyordanov/dev/repos/stock-scanner-mcp && npm run build
```
Expected: tsup builds successfully to `dist/` and exits 0. (`dist/` stays gitignored; we are only confirming the build is not broken.)

---

## TASK 4 — Minimal docs

Keep edits tight. Do NOT reconcile unrelated module-count drift (the README/CLAUDE.md module counts are out of scope here).

### Step 4.1 — Add the plugin install path to README

Read the README to find the install/usage section.
```bash
cd /Users/yyordanov/dev/repos/stock-scanner-mcp && grep -n -i "install\|npx\|## " README.md | head -40
```
Expected: a list of section headings and existing install instructions.

Then add a short "Install as a Claude Code plugin" subsection immediately after the existing primary install section. Insert this exact markdown (adjust the anchor line in the Edit to match the real heading you found above):

````markdown
### Install as a Claude Code plugin

If you use Claude Code, install this server as a plugin with two commands:

```
/plugin marketplace add yyordanov-tradu/stock-scanner-mcp
/plugin install stock-scanner@tradu-marketplace
```

Then run `/mcp` — you should see the `stock-scanner` server listed as connected. The plugin launches the server via `npx -y stock-scanner-mcp`, so the first launch downloads the package once (then it is cached). Optional API keys (`FINNHUB_API_KEY`, `ALPHA_VANTAGE_API_KEY`, `FRED_API_KEY`) are passed through from your environment; modules without a key are skipped automatically.
````

### Step 4.2 — Add `.claude-plugin/` to the CLAUDE.md project structure

Read the project-structure block in CLAUDE.md.
```bash
cd /Users/yyordanov/dev/repos/stock-scanner-mcp && grep -n "Project Structure\|├──\|└──" CLAUDE.md | head -20
```
Expected: the ASCII tree under "## Project Structure".

Add a `.claude-plugin/` entry to that tree. Insert this line into the tree (placed near the top-level entries, e.g. just after the `src/` block, matching the existing indentation style):

```
├── .claude-plugin/           # Claude Code plugin manifests (plugin.json, marketplace.json)
├── .mcp.json                 # MCP server launch config for the plugin (npx)
```

### Step 4.3 — Re-run the quality gates after doc edits

```bash
cd /Users/yyordanov/dev/repos/stock-scanner-mcp && npm run lint && npm test
```
Expected: both pass (docs are markdown — no code impact, but re-confirm nothing regressed).

### Step 4.4 — Commit docs

```bash
cd /Users/yyordanov/dev/repos/stock-scanner-mcp && git add README.md CLAUDE.md && git commit -m "docs: document Claude Code plugin install path"
```
Expected: a commit summary listing README.md and CLAUDE.md.

---

## TASK 5 — Add the version-lockstep note to the release process

The drift from `0.1.0` to `1.17.0` happened because the release flow bumps `package.json` only. The test now catches drift in CI, but add a human-process note so the bump is not forgotten mid-release.

### Step 5.1 — Locate the release-npm skill file

```bash
cd /Users/yyordanov/dev/repos/stock-scanner-mcp && find . -path ./node_modules -prune -o -iname "release-npm*" -print 2>/dev/null; ls .claude/skills/release-npm/ 2>/dev/null; ls .claude/commands 2>/dev/null
```
Expected: the path to the release-npm skill markdown (likely `.claude/skills/release-npm/SKILL.md` or similar). If the skill is global (not in-repo), instead add the note to `docs/development-standards.md` under the release section — find it with:
```bash
cd /Users/yyordanov/dev/repos/stock-scanner-mcp && grep -n -i "release\|version" docs/development-standards.md | head -20
```

### Step 5.2 — Add the lockstep note

In whichever file Step 5.1 identified (release-npm skill if in-repo, else `docs/development-standards.md` release section), Read it first, then add this exact note at the version-bump step:

```markdown
> **Plugin version lockstep:** When bumping the version, also update `version` in `.claude-plugin/plugin.json` to the same value as `package.json`. The release flow bumps `package.json` only; `plugin.json` is a separate copy. The `plugin-manifests.test.ts` check fails CI if they drift, but updating both in the same commit avoids a red test mid-release.
```

If the only release-npm definition is global/outside the repo (Step 5.1 found nothing in-repo), put the note in `docs/development-standards.md` instead — that file IS in the repo and is the documented source of truth.

### Step 5.3 — Commit the process note

```bash
cd /Users/yyordanov/dev/repos/stock-scanner-mcp && git add -A && git commit -m "docs: note plugin.json version lockstep in release process"
```
Expected: a commit summary listing the edited file. (If Step 5.1 found no in-repo file to edit and you placed the note in `docs/development-standards.md`, that is the file committed here.)

---

## TASK 6 — Pre-PR expert review loop (MANDATORY)

Per project rules, after quality gates pass but before pushing/creating the PR, run the iterative 4-expert review.

### Step 6.1 — Capture the diff for review
```bash
cd /Users/yyordanov/dev/repos/stock-scanner-mcp && git diff main...HEAD --stat && git diff main...HEAD
```
Expected: the full diff (marketplace.json added, plugin.json version, .mcp.json rewrite, new test, README/CLAUDE.md/release-note edits).

### Step 6.2 — Run the expert panel
Spawn the 4 review agents in parallel (TypeScript Expert, Security Reviewer, Architecture Reviewer, QA Automation) on the diff. Each classifies findings CRITICAL / MAJOR / MINOR.

- If any CRITICAL or MAJOR: fix it, re-run Task 3 quality gates, then run a new review round. Loop, max 3 rounds, until all four approve with zero critical and zero major.
- MINOR findings: log them in the PR description; they do not block.

Expected outcome: all four agents approve (zero critical + zero major).

---

## TASK 7 — Push and open the PR

### Step 7.1 — Verify the remote is correct (not a template)
```bash
cd /Users/yyordanov/dev/repos/stock-scanner-mcp && git remote get-url origin
```
Expected: a `yyordanov-tradu/stock-scanner-mcp` GitHub URL (not an `automazeio/ccpm` template). If it is the template, STOP.

### Step 7.2 — Push the branch
```bash
cd /Users/yyordanov/dev/repos/stock-scanner-mcp && git push -u origin feat/claude-code-plugin-install
```
Expected: branch pushed, upstream set, and a "create a pull request" link printed.

### Step 7.3 — Create the PR with the security + test-plan notes baked into the body

```bash
cd /Users/yyordanov/dev/repos/stock-scanner-mcp && gh pr create --base main --title "feat: make installable as a Claude Code plugin via npx" --body "$(cat <<'EOF'
## What
Make stock-scanner-mcp installable as a Claude Code plugin:
- `/plugin marketplace add yyordanov-tradu/stock-scanner-mcp`
- `/plugin install stock-scanner@tradu-marketplace`
- `/mcp` then shows the `stock-scanner` server connected.

## Changes
- New `.claude-plugin/marketplace.json` (catalog entry with required `owner.name`; `source: ./`; no per-plugin version).
- `.claude-plugin/plugin.json` version `0.1.0` -> `1.17.0` (lockstep with package.json).
- `.mcp.json` rewritten: launches via `npx -y stock-scanner-mcp` (was the broken `node ${CLAUDE_PLUGIN_ROOT}/dist/index.js` path); adds missing `FRED_API_KEY` passthrough.
- New `src/__tests__/plugin-manifests.test.ts`: validates all three manifests (parse, dynamic version lockstep, name invariant, npx start mechanism with no dist path, exact env key set, owner.name present, source `./`).
- README: documented the two-command plugin install path.
- CLAUDE.md: added `.claude-plugin/` to project structure.
- Release process: added a plugin.json version-lockstep note.

## Why npx
The package is already PUBLIC on npm (`npm view stock-scanner-mcp version` -> 1.17.0, no auth). npx single-sources the version from npm, needs no committed `dist/` (which is gitignored) and no build hook.

## Security notes
- **Supply-chain trust anchor:** bare `npx -y stock-scanner-mcp` fetches and runs the latest public npm tarball at install and on cold start, unpinned, with no prompt. The npm publish account is the sole trust anchor — recommend 2FA + a granular automation token scoped to this package.
- **No secrets in manifests:** the `.mcp.json` env block uses `${VAR}` passthrough only; no literal keys. The test asserts the placeholder shape so a real key can never be pasted in.
- **Empty FRED key is safe:** an unset `${FRED_API_KEY}` resolves to empty; registry.ts truthy guard skips the FRED module — zero code change, no failed call.
- **URL-key redaction unchanged:** FRED/Alpha-Vantage keys travel in query strings and are already redacted by shared/http.ts (existing, tested in v1.17.0). Out of scope here; must stay intact.

## Cold-start note
First `/mcp` launch downloads the ~473KB / 33-file / 4-dep tarball via npx, then caches. A slow first connect is expected, not a failure. `npx` must be on the plugin host PATH (true on a normal macOS login shell); if a user reports ENOENT, that is the cause.

## Manual acceptance test plan (two passes)
`/plugin marketplace add` resolves from the repo DEFAULT branch (main), so test the branch first, then re-test after merge.

**Pass 1 — branch (before merge):**
1. `/plugin marketplace add yyordanov-tradu/stock-scanner-mcp@feat/claude-code-plugin-install` -> succeeds
2. `/plugin install stock-scanner@tradu-marketplace` -> succeeds
3. `/mcp` -> shows `stock-scanner` **connected** (not failed)
4. Call `tradingview_scan` (no-key smoke tool) -> returns non-error JSON

**Pass 2 — main (after merge):** repeat steps 1-4 with `/plugin marketplace add yyordanov-tradu/stock-scanner-mcp` (no `@branch`).

## MINOR review findings
(Logged from the pre-PR expert review loop — none block merge.)
EOF
)"
```
Expected: a PR URL is printed.

---

## TASK 8 — Manual acceptance (Pass 1: branch) — BLOCKING Definition of Done

No automated test can prove the real acceptance criterion (npx resolve + MCP handshake + network). This manual pass is required, not optional.

### Step 8.1 — Run the four-step branch check in Claude Code
In a Claude Code session, run:
1. `/plugin marketplace add yyordanov-tradu/stock-scanner-mcp@feat/claude-code-plugin-install`
2. `/plugin install stock-scanner@tradu-marketplace`
3. `/mcp` — confirm `stock-scanner` shows **connected**
4. Call `tradingview_scan` — confirm it returns non-error JSON

Expected: step 3 shows connected; step 4 returns a real JSON payload (capture the snippet as evidence-of-done). The first connect may be slow (npx cold-start download) — wait for it, do not read slowness as failure.

### Step 8.2 — Record the result on the PR
Paste the `tradingview_scan` output snippet and a "Pass 1 (branch) verified" note as a PR comment.

---

## TASK 9 — Merge and Pass 2 (post-merge acceptance)

### Step 9.1 — Merge after approvals + green CI
Once the expert loop approved, CI is green, and Pass 1 is verified, merge the PR (squash or per repo convention) to `main`.

### Step 9.2 — Manual acceptance (Pass 2: main)
Because `/plugin marketplace add` reads from the default branch (main), re-run the steps from main to prove the merged state actually works.

**Run Pass 2 from a directory OUTSIDE this repo** (e.g. `cd ~` or any empty folder). The repo's own `skills/` and `.mcp.json`, plus any skills previously copied into `~/.claude/skills/` by the `stock-scanner-install-skills` npm command, will shadow the plugin's bundled copies and make namespaced activation impossible to verify from inside the repo. If `~/.claude/skills/` holds old unprefixed copies (analyze-stock, compare, etc.), move them aside first so the `stock-scanner:` namespace is unambiguous.

1. `/plugin marketplace add yyordanov-tradu/stock-scanner-mcp` (no `@branch`)
2. `/plugin install stock-scanner@tradu-marketplace`
3. `/mcp` — confirm `stock-scanner` **connected**
4. Call `tradingview_scan` — confirm non-error JSON
5. **Skills namespace check** — run `/reload-plugins`, then confirm the bundled skills surface under the plugin namespace: `stock-scanner:analyze-stock`, `stock-scanner:compare`, `stock-scanner:swing-setup`, etc. appear in the skill list, and the command `/stock-scanner:scan` is available. Invoke one, e.g. `/stock-scanner:analyze-stock AAPL`, and confirm it runs. This proves plugin skill/command auto-discovery (the `skills/` and `commands/` dirs) works for a real user, not just the local-repo developer.

Expected: all five pass from main. This closes the Definition of Done. If a user installed an older marketplace entry, they may need `/plugin marketplace update` to pick up main — note this if Pass 2 shows stale data.

> Note on skills distribution: bundled skills need NO separate install via the plugin path — `/plugin install` auto-discovers `skills/` and `commands/` and registers them as `stock-scanner:<name>`. The npm `stock-scanner-install-skills` bin is the separate, pre-plugin path that copies skills into `~/.claude/skills/` (unprefixed) for users who only add the MCP server. The two paths can coexist and will collide on names; that is expected, not a bug.

---

## Done criteria checklist
- [ ] `marketplace.json` exists with `owner.name`, `source: "./"`, plugin name `stock-scanner`.
- [ ] `plugin.json` version `1.17.0` (equals package.json, asserted dynamically).
- [ ] `.mcp.json` uses `npx -y stock-scanner-mcp`; no `dist/index.js` path; env = exactly the 3 keys.
- [ ] `plugin-manifests.test.ts` passes (all 7 cases) and is part of `npm test`.
- [ ] `npm run lint`, `npm test`, `npm run validate-tools`, `npm run build` all green.
- [ ] README documents the two-command install; CLAUDE.md lists `.claude-plugin/`.
- [ ] Release process has the version-lockstep note.
- [ ] Expert review loop: zero critical + zero major.
- [ ] Pass 1 (branch) and Pass 2 (main) manual acceptance both verified, with `tradingview_scan` output captured.
- [ ] Pass 2 skills-namespace check: bundled skills appear as `stock-scanner:<name>` and `/stock-scanner:scan` works, verified from OUTSIDE the repo with old `~/.claude/skills/` copies cleared.

---

## Key files this plan creates/modifies
- Create: `.claude-plugin/marketplace.json`
- Create: `src/__tests__/plugin-manifests.test.ts`
- Modify: `.claude-plugin/plugin.json`
- Modify: `.mcp.json`
- Modify: `README.md`
- Modify: `CLAUDE.md`
- Modify: release-npm skill or `docs/development-standards.md` (whichever exists in-repo)
