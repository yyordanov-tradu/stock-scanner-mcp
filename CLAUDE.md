# stock-scanner-mcp

## Status

**Version:** 1.14.0 — Published on npm as `stock-scanner-mcp`
**Modules:** 11 implemented (54 tools total)

Planning docs (historical): `docs/architecture.md`, `docs/plans/` — reference only, not actively maintained

## Project Overview

A modular, open-source MCP (Model Context Protocol) server that provides Claude Code with stock and crypto market data. Users install it via npm and configure which data modules to enable based on available API keys.

## Tech Stack

- **Language:** TypeScript
- **Runtime:** Node.js
- **Protocol:** MCP over stdio (JSON-RPC)
- **SDK:** `@modelcontextprotocol/sdk`
- **Build:** tsup (bundles to ESM)
- **Test:** vitest
- **Schema:** zod
- **Distribution:** npm (`npx stock-scanner-mcp`)

## Project Structure

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
│   │   ├── coingecko/        # Crypto market data (no key)
│   │   ├── options/          # Options chains, Greeks, unusual activity (no key)
│   │   ├── options-cboe/     # CBOE put/call ratio sentiment (no key)
│   │   ├── fred/             # US economic data — calendar, indicators (FRED_API_KEY)
│   │   ├── sentiment/        # Market & crypto Fear & Greed sentiment (no key)
│   │   └── frankfurter/      # Forex exchange rates — ECB daily rates (no key)
│   ├── sidecar/
│   │   ├── index.ts          # HTTP sidecar entry point (port 3100)
│   │   └── server.ts         # HTTP request handler (55 endpoints)
│   └── shared/
│       ├── http.ts           # HTTP client with timeouts
│       ├── cache.ts          # In-memory TTL cache
│       ├── types.ts          # Shared types + result builders
│       ├── resolver.ts       # Ticker resolution (AAPL → NASDAQ:AAPL)
│       └── utils.ts          # withMetadata() wrapper
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## Key Commands

```bash
npm install           # Install dependencies
npm run build         # Build with tsup → dist/
npm run dev           # Watch mode (rebuild on save)
npm test              # Run all tests (vitest)
npm run test:watch    # Watch mode tests
npm run lint          # Type-check (tsc --noEmit)
npm run validate-tools # Tool description quality check
npm test -- --run src/modules/sentiment/__tests__/client.test.ts  # Run single test file
node dist/index.js    # Run MCP server
node dist/index.js --modules tradingview,finnhub  # Run specific modules
```

## Configuration

### Environment Variables (secrets)
- `FINNHUB_API_KEY` -- enables Finnhub module (news, earnings)
- `ALPHA_VANTAGE_API_KEY` -- enables Alpha Vantage module (quotes, fundamentals)
- `FRED_API_KEY` -- enables FRED module (economic calendar, indicators, rates)

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
| options | (none) | Always |
| options-cboe | (none) | Always |
| finnhub | FINNHUB_API_KEY | When key set |
| alpha-vantage | ALPHA_VANTAGE_API_KEY | When key set |
| fred | FRED_API_KEY | When key set |
| sentiment | (none) | Always |
| frankfurter | (none) | Always |

## Development Standards

**Full reference:** [`docs/development-standards.md`](docs/development-standards.md) — architecture, patterns, naming, testing, error handling, and new module checklist.

Read it before writing any code. Key rules summarized below:

### Mandatory Rules

- **Every code change MUST include corresponding tests.** No exceptions. New functions need unit tests, modified functions need updated tests. PRs without test coverage for changed code will be rejected.
- All HTTP calls go through `shared/http.ts` (never raw `fetch`), with 10s timeout via AbortController
- All tool handlers wrapped with `withMetadata()` — handlers MUST NEVER throw to MCP client
- All URL parameters use `encodeURIComponent()`; API keys passed via headers (URL query param auth allowed when API requires it — see development-standards.md §2 Documented Deviations)
- Response payloads truncated to control token usage
- In-memory TTL cache (`shared/cache.ts`) for all external API calls
- Tool descriptions must be LLM-readable, disambiguated from similar tools, honest about limitations, and include value scales for ratings/scores
- All tools in a module MUST use the same response shape (standard: `JSON.stringify(rows, null, 2)`)
- Tools returning stock data MUST include both `name` and `description` metadata columns
- Every new tool handler MUST have a dedicated test (columns, input resolution, response shape, edge cases)
- Schema defaults declared via `.default()` in zod (not manual fallbacks) so LLMs see them
- All response types must have TypeScript interfaces (no `any` in new code)
- Imports must use `.js` extension (ESM requirement)
- **Every code change MUST check if `CLAUDE.md`, `README.md`, or `docs/development-standards.md` need updating** (module counts, tool counts, env vars, project structure, version — see development-standards.md §13 Documentation Freshness)

### Module Pattern

Every module follows: `index.ts` (factory) + `client.ts` (HTTP + cache) + `__tests__/client.test.ts`

### Naming

- Tool names: `{module}_{action}` (e.g., `finnhub_quote`)
- Factory functions: `create{Name}Module()`
- Cache keys: `{entity}:{params}` colon-separated

### Quality Gates (must pass before merge)

```bash
npm run lint            # tsc --noEmit
npm test                # vitest
npm run validate-tools  # tool description quality
npm run build           # tsup
```

### Pre-PR Expert Review Loop (MANDATORY)

After quality gates pass but **before committing/pushing/creating a PR**, run an iterative 4-expert review. Full details in [`docs/development-standards.md`](docs/development-standards.md) §14.

1. Spawn 4 review agents **in parallel**: TypeScript Expert, Security Reviewer, Architecture Reviewer, QA Automation
2. Each classifies findings as CRITICAL / MAJOR / MINOR
3. If any CRITICAL or MAJOR → fix → re-run quality gates → new review round
4. Loop until all 4 agents approve (zero critical + zero major). Max 3 rounds.
5. MINOR findings are logged in PR description but do not block.

## Git Workflow

- **Never commit directly to `main`.** Main is protected. Always create a feature branch first (e.g. `feat/descriptive-name`, `fix/issue-description`).
- Create the branch **before** writing any code, not after.
- All work goes through PRs — push the feature branch, create a PR against `main`.

## Pre-Flight Checklist (MANDATORY)

**Before starting ANY new feature, bug fix, or creating a worktree/branch:** follow the checklist in `docs/pre-flight-checklist.md`. No exceptions — multiple LLMs work concurrently on this repo.
