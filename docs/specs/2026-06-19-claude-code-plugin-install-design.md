---
name: claude-code-plugin-install
status: draft
created: 2026-06-19T00:00:00Z
updated: 2026-06-19T00:00:00Z
---

# Spec: Make stock-scanner-mcp installable as a Claude Code plugin

## Goal

Let anyone install this server as a Claude Code plugin with two commands:

```
/plugin marketplace add yyordanov-tradu/stock-scanner-mcp
/plugin install stock-scanner@tradu-marketplace
```

After install, `/mcp` should show the `stock-scanner` server connected.

## The one real decision: how the server starts

The plugin tells Claude Code how to launch the Node server. Two paths exist:

| | npx | Commit `dist/` |
|---|---|---|
| Command | `npx -y stock-scanner-mcp` | `node ${CLAUDE_PLUGIN_ROOT}/dist/index.js` |
| Needs | Package public on npm | Build + force-add `dist/` every release |
| Version source | Single-sourced from npm | Must rebuild and recommit on every change |
| Works if private | No | Yes |
| Cold start | Slower (npm resolves the package) | Faster (local file) |

**Decision: npx.**

Reason: the package is already public on npm. Verified:

```
$ npm view stock-scanner-mcp version
1.17.0
```

`npm view` returns the version with no auth, so the package is public and resolvable by anyone. This is the cleaner path — no binary churn, no build hook, and the version stays single-sourced from npm. The existing `bin`, `prepublishOnly`, and `mcpName` setup in `package.json` already supports it.

This also fully resolves the "`dist/` problem" from the original plan. `dist/` is gitignored and has no build hook. With npx we never reference `dist/` from the plugin, so there is nothing to commit or force-add. The gitignore stays as-is.

## Current state vs target state

What exists today:

- `.claude-plugin/plugin.json` — present, but `version: "0.1.0"` (package.json is `1.17.0`).
- `.mcp.json` at repo root — present, but points at `node ${CLAUDE_PLUGIN_ROOT}/dist/index.js`, which only works if `dist/` is committed (it is not).
- `.claude-plugin/marketplace.json` — **missing**. This is the hard blocker; without it `/plugin marketplace add` has nothing to read.

What we change:

1. Add `.claude-plugin/marketplace.json`.
2. Rewrite `.mcp.json` to launch via `npx` instead of the local `dist/` path.
3. Bump `plugin.json` version `0.1.0` → `1.17.0` to match `package.json`.

## File changes (applyable)

### 1. New file: `.claude-plugin/marketplace.json`

The marketplace `name` is `tradu-marketplace` (so `install stock-scanner@tradu-marketplace` resolves). The plugin `name` is `stock-scanner` and its `source` is `./` — the plugin is this same repo, whose manifest is `.claude-plugin/plugin.json`.

The live schema (`https://json.schemastore.org/claude-code-marketplace.json`) and the official docs both require a top-level **`owner`** object with a `name` — leaving it out fails validation and `/plugin marketplace add` silently won't resolve. Required fields: top-level `name`, `owner.name`, `plugins`; per-plugin `name` and `source`. `version`, `description`, `category` are optional. `$schema` is ignored by Claude Code at load time (kept only for editor autocomplete).

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

Note: a marketplace top-level `version` is the *catalog* version, not the plugin version — keep the plugin version (1.17.0) only in `plugin.json`, not on the marketplace root.

### 2. Rewrite: `.mcp.json`

Switch the launch command from the local `dist/` path to npx. This drops the dependency on `${CLAUDE_PLUGIN_ROOT}` and on a committed `dist/`.

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

Note: `FRED_API_KEY` is added here. The current `.mcp.json` omits it, but `CLAUDE.md` lists it as the third secret (enables the FRED module). Passing it through means the FRED module works for plugin users who set the key. The keys are optional — modules with a missing key are skipped at startup, same as the npm install path.

### 3. Edit: `.claude-plugin/plugin.json`

Change one line:

```diff
-  "version": "0.1.0",
+  "version": "1.17.0",
```

## Open minor decisions (recommended defaults chosen)

These do not block the build. Defaults are picked; flag if you disagree.

1. **npx version pinning.** `npx -y stock-scanner-mcp` always pulls the latest published version. This matches the "version single-sourced from npm" goal and means plugin users auto-get new releases. The trade-off: a user's plugin pinned at plugin version 1.17.0 can still run a newer npm version. **Default: leave unpinned** (bare package name). Pin to `stock-scanner-mcp@1.17.0` only if you want the plugin and the server to move in lockstep.

2. **FRED_API_KEY passthrough.** Added (see above). **Default: include it.** Drop it only if you intend to keep FRED off for plugin users.

## Tests (mandatory)

These are config-only JSON changes, but the project rule still applies: every change ships a test. Add one vitest file (e.g. `src/__tests__/plugin-manifests.test.ts`) that reads the three manifests from disk and asserts:

- All three parse as valid JSON.
- `plugin.json.version === package.json.version` — sourced dynamically from `package.json`, **not** a hardcoded `1.17.0` literal (a literal would just re-introduce drift). This catches the current `0.1.0` gap and all future drift.
- Name invariant: `marketplace.json` plugins[].name === `plugin.json.name` === `stock-scanner`, and marketplace top-level `name` === `tradu-marketplace`.
- `marketplace.json` has `owner.name` (the required field this spec originally missed).
- `.mcp.json` `command` === `npx`, `args` include `stock-scanner-mcp` and do **not** include `${CLAUDE_PLUGIN_ROOT}/dist/index.js`.
- `.mcp.json` env keys are exactly `FINNHUB_API_KEY`, `ALPHA_VANTAGE_API_KEY`, `FRED_API_KEY`.

This is the single test that satisfies the rule for this PR. (A separate idea — a URL-key redaction test for FRED's `api_key=` — is not in scope: that path already exists and is already covered by `src/shared/__tests__/http.test.ts` in v1.17.0. Log it as a follow-up if wanted.)

## Test plan (manual, post-merge)

The install pulls from the repo's **default branch (`main`)**. So the three file changes must be merged to `main` before the install test passes. (To test from a branch first, use `/plugin marketplace add yyordanov-tradu/stock-scanner-mcp@<branch>`.)

After merge to `main`:

1. `/plugin marketplace add yyordanov-tradu/stock-scanner-mcp` — marketplace `tradu-marketplace` appears.
2. `/plugin install stock-scanner@tradu-marketplace` — installs without error.
3. `/mcp` — `stock-scanner` server shows as connected.
4. Run one tool (e.g. a TradingView scan, no key needed) to confirm the server responds.

## Out of scope

- Publishing skills as part of the plugin (the `skills/` dir ships via npm already).
- Any change to the server code, tools, or modules.
- Private/internal distribution (only relevant if the package were private — it is not).

## Risks

- **Empty env var strings.** `${FINNHUB_API_KEY}` etc. resolve to empty strings when unset. This is the same behavior as the current `.mcp.json`, so this change does not make it worse — but module auto-enable logic should treat an empty string as "not set." Pre-existing; noted, not addressed here.
- **Cold start.** First launch runs `npx` which may resolve/download the package. Slower than a local file on first run; cached afterward. Acceptable for the cleaner setup.

## Git workflow

Per `CLAUDE.md`: never commit to `main`. Create a branch (e.g. `feat/claude-code-plugin-install`), make the three changes, open a PR against `main`, merge, then run the test plan above.
