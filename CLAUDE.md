# stock-scanner-mcp

## Status

**Phase:** Design & planning complete. Implementation not started.

- Brainstorm: `docs/2026-03-12-brainstorm-session.md`
- Architecture: `docs/architecture.md`
- Implementation plan: `docs/plans/2026-03-12-stock-scanner-plugin.md`
- Task files (15): `docs/plans/tasks/task-01-scaffolding.md` through `task-15-readme.md`

**To start implementation:** Use `superpowers:executing-plans` or `superpowers:subagent-driven-development` skill with the plan.

## Project Overview

A modular, open-source MCP (Model Context Protocol) server that provides Claude Code with stock and crypto market data. Users install it via npm and configure which data modules to enable based on available API keys.

## Tech Stack

- **Language:** TypeScript
- **Runtime:** Node.js
- **Protocol:** MCP over stdio (JSON-RPC)
- **SDK:** `@modelcontextprotocol/sdk`
- **Build:** tsc (TypeScript compiler)
- **Test:** vitest
- **Schema:** zod
- **Distribution:** npm (`npx stock-scanner-mcp`)

## Planned Project Structure

> **Note:** Not yet scaffolded. See `docs/plans/tasks/task-01-scaffolding.md` for setup.

```
stock-scanner-mcp/
├── src/
│   ├── index.ts              # MCP server entry point
│   ├── config.ts             # Env var + arg parsing
│   ├── registry.ts           # Module registry
│   ├── modules/
│   │   ├── tradingview/      # TradingView stock scanner (no key)
│   │   ├── tradingview-crypto/ # TradingView crypto scanner (no key)
│   │   ├── sec-edgar/        # SEC EDGAR filings (no key)
│   │   ├── finnhub/          # News + earnings (FINNHUB_API_KEY)
│   │   ├── alpha-vantage/    # Prices + fundamentals (ALPHA_VANTAGE_API_KEY)
│   │   └── coingecko/        # Crypto market data (no key)
│   └── shared/
│       ├── http.ts           # HTTP client with timeouts
│       ├── cache.ts          # In-memory TTL cache
│       └── types.ts          # Shared types
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## Key Commands

> **Note:** These commands will work after task-01 (scaffolding) is complete.

```bash
npm install
npm run build
node dist/index.js
node dist/index.js --modules tradingview,finnhub
npm test
```

## Configuration

### Environment Variables (secrets)
- `FINNHUB_API_KEY` -- enables Finnhub module (news, earnings)
- `ALPHA_VANTAGE_API_KEY` -- enables Alpha Vantage module (quotes, fundamentals)

### CLI Arguments (preferences)
- `--modules` -- comma-separated list of modules to enable (default: all available)
- `--default-exchange` -- default exchange for symbol resolution (default: NASDAQ)

## Module System

- Modules auto-enable when required env vars are present (or no key needed)
- Modules with missing keys are skipped with a startup log message
- Tool names prefixed with module name: `{module}_{action}`
- Each module is self-contained in its own directory

### Module Status by API Key
| Module | Required Env Var | Auto-enabled |
|--------|-----------------|--------------|
| tradingview | (none) | Always |
| tradingview-crypto | (none) | Always |
| sec-edgar | (none) | Always |
| coingecko | (none) | Always |
| finnhub | FINNHUB_API_KEY | When key set |
| alpha-vantage | ALPHA_VANTAGE_API_KEY | When key set |

## Dual-LLM Development

This project uses two LLMs to ensure best quality:

- **Claude (Anthropic)** — Reviews Gemini's work; also implements features independently.
- **Gemini (Google)** — Reviews Claude's work; also implements features independently.

Each reviews the other's PRs and code to catch issues a single LLM might miss.

### Coordination

- Planned work is coordinated via markdown files in `docs/duo-planning/`.
- Before starting any planned work, always check `docs/duo-planning/` for existing plans or assignments.
- Both LLMs communicate through these files — update them as work progresses.

## Development Rules

- All HTTP calls must have explicit timeouts (5s connect, 10s read)
- All tool handlers catch exceptions and return error JSON (never throw)
- Response payloads truncated to control token usage
- In-memory TTL cache for rate-limited APIs
- Tool descriptions must be clear enough for the LLM to know when to use them

## Pre-Flight Checklist (MANDATORY)

**Before starting ANY new feature, bug fix, or creating a worktree, you MUST complete ALL of these steps in order. No exceptions.**

1. **Check for open PRs and merge/review status:**
   ```bash
   gh pr list --state open
   ```
   If there are open PRs that should be merged first, flag them to the user before proceeding.

2. **Pull latest main:**
   ```bash
   git checkout main && git pull origin main
   ```

3. **Check for Gemini PRs/comments** (dual-LLM coordination):
   - Review any open PRs from Gemini that may conflict with your planned work
   - Check `docs/duo-planning/` for in-progress assignments

4. **Run tests on main to confirm clean baseline:**
   ```bash
   npm test
   ```
   If tests fail on main, fix them before starting new work.

5. **Only then** create your feature branch or worktree.

**Why:** Multiple LLMs work on this repo concurrently. Skipping these steps leads to merge conflicts, duplicated work, and building on stale code. This has happened before.
