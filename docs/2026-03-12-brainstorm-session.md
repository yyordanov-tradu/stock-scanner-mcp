# stock-scanner -- Brainstorm Session

**Date:** 2026-03-12
**Status:** Decisions complete -- ready for implementation planning

---

## Decisions Made

### 1. Project Vision
A modular, open-source **Claude Code Plugin** that gives Claude access to stock and crypto market data. Distributed via a marketplace. Separate project from ibkr-bot.

### 2. Target Audience
Open source / community -- general-purpose stock data MCP server anyone can install and use with Claude Code.

### 3. Core Design Principle: Modular
Users pick which data sources to enable. Core is lightweight, each source is an optional module with its own API key config. No premium/paid APIs in v1 -- all free.

### 4. Technology
- **Language:** TypeScript
- **Runtime:** Node.js
- **Protocol:** MCP over stdio (JSON-RPC)
- **SDK:** `@modelcontextprotocol/sdk`
- **Distribution:** Claude Code Plugin marketplace (GitHub-based)
- **Build:** tsup or tsc

### 5. Configuration: Hybrid approach
- **Env vars** for secrets (API keys) -- security best practice
- **CLI args** for preferences (`--modules`, `--default-exchange`)
- Modules with no key auto-enable; modules with keys enable when key is present
- Fits naturally into Claude Code's `.mcp.json` format (args array + env block)

### 6. Package Name
`stock-scanner` (plugin name), `stock-scanner-mcp` (npm package for the MCP server component)

### 7. Module Organisation: Option A -- By Data Source
Modules split by data source (where data comes from). Simple, focused tools -- let the LLM compose them.

**Rationale:**
- Claude is excellent at chaining multiple tool calls -- no composite tools needed
- Composite tools break the modular key model (partial availability is confusing)
- Each module is self-contained -- easy to build, test, maintain
- 19 focused tools is a good number; a composite layer would double tool count and increase LLM confusion
- Can always add composite tools later if real usage shows a need

### 8. Delivery Format: Claude Code Plugin (not just MCP server)
A full Claude Code Plugin, not a bare MCP server. A plugin can bundle:

| Component | Purpose | Our usage |
|---|---|---|
| `.claude-plugin/plugin.json` | Plugin metadata | Required -- name, version, description |
| `.mcp.json` | MCP server config | The 19 data tools (TradingView, Finnhub, etc.) |
| `commands/` | Slash commands | e.g. `/scan AAPL`, `/crypto-overview` |
| `agents/` | Specialized subagents | e.g. `market-researcher` for multi-source analysis |
| `skills/` | Auto-applied guidance | When/how to use market data tools effectively |
| `hooks/` | Lifecycle hooks | Optional -- future use |

**Distribution:** via a GitHub-based marketplace repository with a `marketplace.json` manifest. Users install through Claude Code's `/plugin` UI.

---

## Data Sources (v1 Scope)

All free APIs only.

### No API Key Needed
| Source | Data Provided |
|--------|--------------|
| TradingView Stock Scanner | 62+ technical indicators, screeners, candle patterns |
| TradingView Crypto Scanner | Crypto pair technicals (BTC, ETH, SOL, etc.) |
| SEC EDGAR | 8-K filings, corporate events, full-text search |

### Free API Key Needed
| Source | Data Provided | Env Var |
|--------|--------------|---------|
| Finnhub | Company news (7-day), earnings calendar | `FINNHUB_API_KEY` |
| Alpha Vantage | Quotes, daily history, fundamentals (PE, EPS, market cap) | `ALPHA_VANTAGE_API_KEY` |
| CoinGecko | Coin data, trending coins, global market metrics | None (optional key for pro tier) |

---

## Architecture

### Project Structure
```
stock-scanner-mcp/
├── src/
│   ├── index.ts              # MCP server entry point, module loader
│   ├── config.ts             # Env var + arg parsing, module resolution
│   ├── registry.ts           # Module registry, auto-discovery
│   ├── modules/
│   │   ├── base.ts           # Abstract module interface
│   │   ├── tradingview/      # TradingView stock scanner (no key)
│   │   ├── tradingview-crypto/  # TradingView crypto scanner (no key)
│   │   ├── sec-edgar/        # SEC EDGAR filings (no key)
│   │   ├── finnhub/          # News + earnings (FINNHUB_API_KEY)
│   │   ├── alpha-vantage/    # Prices + fundamentals (ALPHA_VANTAGE_API_KEY)
│   │   └── coingecko/        # Crypto market data (no key)
│   └── shared/
│       ├── http.ts           # HTTP client with timeouts, retries, rate limiting
│       ├── cache.ts          # In-memory TTL cache (avoid hammering free tiers)
│       └── types.ts          # Shared types
├── package.json
├── tsconfig.json
└── README.md
```

### Module Interface
```typescript
interface ModuleDefinition {
  name: string;                    // e.g. "finnhub"
  description: string;             // shown in logs on startup
  requiredEnvVars: string[];       // e.g. ["FINNHUB_API_KEY"] -- empty for no-key modules
  tools: ToolDefinition[];         // MCP tools this module provides
}

interface ToolDefinition {
  name: string;                    // e.g. "finnhub_company_news"
  description: string;             // LLM sees this to decide when to call
  inputSchema: object;             // JSON Schema for parameters
  handler: (params: any) => Promise<ToolResult>;
}
```

### Startup Flow
1. Parse CLI args (`--modules`, `--default-exchange`) and env vars
2. Registry scans all modules, checks `requiredEnvVars` against environment
3. Modules with missing keys are skipped (logged as `"finnhub: disabled -- FINNHUB_API_KEY not set"`)
4. Enabled modules register their tools with the MCP server
5. Server starts on stdio, exposes only the active tools

### Tool Naming Convention
`{module}_{action}` -- e.g. `tradingview_scan_indicators`, `finnhub_company_news`, `edgar_search_filings`. Prefixed with module name to avoid collisions.

---

## Tools Per Module (19 total)

### TradingView Stock Scanner (no key)
- `tradingview_scan_indicators` -- technicals for symbol + timeframe (RSI, MACD, BBands, MAs, pivots)
- `tradingview_top_gainers` -- top gaining stocks by % change
- `tradingview_top_losers` -- top losing stocks
- `tradingview_volume_breakout` -- stocks with unusual volume
- `tradingview_rating_filter` -- filter by TradingView buy/sell rating

### TradingView Crypto Scanner (no key)
- `crypto_scan_indicators` -- technicals for crypto pair + timeframe
- `crypto_top_gainers` -- top gaining coins
- `crypto_top_losers` -- top losing coins
- `crypto_volume_breakout` -- coins with unusual volume

### SEC EDGAR (no key)
- `edgar_search_filings` -- full-text search for 8-K filings by company
- `edgar_recent_filings` -- recent material events for a symbol (last 30 days)

### Finnhub (FINNHUB_API_KEY)
- `finnhub_company_news` -- recent news for a symbol (7-day lookback)
- `finnhub_earnings_calendar` -- upcoming/recent earnings for a symbol

### Alpha Vantage (ALPHA_VANTAGE_API_KEY)
- `alpha_vantage_quote` -- current price, volume, change
- `alpha_vantage_daily_history` -- daily OHLCV (last 100 days)
- `alpha_vantage_company_overview` -- fundamentals (PE, market cap, EPS, sector)

### CoinGecko (no key)
- `coingecko_coin_data` -- price, market cap, 24h volume, 7d/30d change
- `coingecko_trending` -- trending coins right now
- `coingecko_global` -- total market cap, BTC dominance

---

## Plugin Structure

```
stock-scanner/
├── .claude-plugin/
│   └── plugin.json              # Plugin metadata
├── .mcp.json                    # MCP server configuration
├── commands/
│   └── scan.md                  # /scan slash command
├── agents/
│   └── market-researcher.md     # Multi-source analysis agent
├── skills/
│   └── market-data/
│       └── SKILL.md             # Guidance on using market tools
├── src/                         # MCP server source
│   ├── index.ts
│   ├── config.ts
│   ├── registry.ts
│   ├── modules/
│   │   ├── base.ts
│   │   ├── tradingview/
│   │   ├── tradingview-crypto/
│   │   ├── sec-edgar/
│   │   ├── finnhub/
│   │   ├── alpha-vantage/
│   │   └── coingecko/
│   └── shared/
│       ├── http.ts
│       ├── cache.ts
│       └── types.ts
├── package.json
├── tsconfig.json
└── README.md
```

---

## Resolved: Module Organisation

**Decision:** Option A -- modules by data source.

See Decision #7 above for full rationale.

---

## Context: Existing ibkr-bot Integrations

The ibkr-bot project already has working implementations of TradingView, Finnhub, SEC EDGAR, and CryptoTrend integrations in Java. Key patterns to carry forward:

- **Gateway/adapter pattern** -- thin wrappers translating external API formats to domain models
- **Timeouts on every call** -- TradingView: 5s connect + 10s read, Finnhub/EDGAR: 3s connect + 5s read
- **Response truncation** -- external payloads truncated before passing to LLM
- **Error isolation** -- every tool catches exceptions, returns error JSON, never propagates
- **TradingView indicators** -- 62+ columns across price, technicals, BBands, MAs, momentum, volatility, volume, pivots, ichimoku, sentiment
- **Parallel fetching** -- multiple timeframes fetched concurrently (CompletableFuture in Java, Promise.all in TS)

### Gaps identified in ibkr-bot (addressed by this plugin)
- No alternative data (sentiment, social media)
- No macro context (VIX, sector rotation)
- Limited crypto (only BTC/USDT hardcoded)
- No fundamentals (PE, EPS, market cap)
- No caching layer for rate-limited APIs
