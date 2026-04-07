# stock-scanner-mcp

[![CI](https://github.com/yyordanov-tradu/stock-scanner-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/yyordanov-tradu/stock-scanner-mcp/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/stock-scanner-mcp)](https://www.npmjs.com/package/stock-scanner-mcp)
[![npm downloads](https://img.shields.io/npm/dw/stock-scanner-mcp)](https://www.npmjs.com/package/stock-scanner-mcp)

A modular MCP server for Claude Code and Claude Desktop that provides real-time access to stock and crypto market data. Scan markets, check technicals, monitor insider trades, track earnings, analyze options flow, and optionally save your own watchlists and thesis notes from one server.

**61 tools** across **12 modules** — 9 modules work with zero API keys, including an optional stateful Market Workspace.

## Quick Start

Three steps to get the full experience: server config, trading skills, and workspace setup.

### Step 1 — Add the server to your MCP config

Copy this complete config block into your config file:

- **Claude Code:** `~/.claude.json` (global) or `.mcp.json` (project-local)
- **Claude Desktop:** `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows)

```json
{
  "mcpServers": {
    "stock-scanner": {
      "command": "npx",
      "args": ["-y", "stock-scanner-mcp", "--enable-workspace"],
      "env": {
        "FINNHUB_API_KEY": "your-key-here",
        "ALPHA_VANTAGE_API_KEY": "your-key-here",
        "FRED_API_KEY": "your-key-here"
      }
    }
  }
}
```

This gives you **43 tools** immediately with no API keys. API keys are optional and free — they unlock 18 additional tools for real-time quotes, news, earnings, and economic data. See [API Keys](#api-keys-optional) below for where to get them.

> **Minimal config** — if you don't want workspace or API keys, use this instead:
> ```json
> {
>   "mcpServers": {
>     "stock-scanner": {
>       "command": "npx",
>       "args": ["-y", "stock-scanner-mcp"]
>     }
>   }
> }
> ```
> This gives you **36 stateless tools** with no local data storage.

Restart Claude Desktop after saving. Claude Code picks up the config automatically.

### Step 2 — Install the trading skills

Run this command in your terminal:

```bash
npx -p stock-scanner-mcp stock-scanner-install-skills
```

This installs 19 slash commands (like `/morning-briefing`, `/analyze-stock AAPL`, `/setup-market-workspace`) into `~/.claude/skills/` so they're available in every Claude Code session. See [Trading Skills](#trading-skills) for the full list.

### Step 3 — Set up your workspace

Run `/setup-market-workspace` in Claude Code. It asks three quick questions:

```
> /setup-market-workspace

Setting up your market workspace — I'll ask a few quick questions to get started...

1. What kind of trader or investor are you?
   (e.g., options trader, swing trader, long-term investor, crypto-focused)

   → "I'm mostly a swing trader, also watch crypto"

2. Which names or assets should I save to your core watchlist?
   (e.g., AAPL, MARA, BTC, Gold)

   → "MARA, HOOD, SOFI, BTC, ETH"

3. Do you want a daily or weekly market review?

   → "Daily"
```

Once answered, it saves your profile and creates a `core` watchlist:

```
✓ Workspace saved

  Profile     swing trader | daily review
  Watchlist   core — MARA, HOOD, SOFI, BTC, ETH
```

You can also skip the skill and ask Claude directly: *"Set up my workspace — I'm a swing trader, create a core watchlist with MARA, HOOD, BTC, daily reviews."*

**That's it.** You now have 61 tools, 19 skills, and a personalized workspace. Try `/workspace-morning-brief` for your first tailored market scan.

## What You Can Do

```
"What are the top gaining stocks today?"
"Show me technicals for AAPL on the hourly timeframe"
"Any insider trades for TSLA in the last 30 days?"
"What's the options chain for AAPL expiring next Friday?"
"What's the current fed funds rate and CPI trend?"
"Convert $10,000 USD to EUR"
"Set up a core watchlist with MARA, HOOD, and BTC"
"Give me a personalized morning brief for my saved watchlist"
```

### Highlights

- **Stock scanning** — screen by price, RSI, volume, market cap with custom filters
- **Technical analysis** — RSI, MACD, Bollinger Bands, moving averages, pivots across multiple timeframes
- **Options flow** — chains with Greeks, unusual activity detection, max pain, implied move
- **Insider trades** — parsed Form 4 transactions with buy/sell/grant details
- **Earnings & news** — calendar, analyst ratings, company news, short interest
- **Crypto** — real-time quotes, technicals, trending coins, market stats
- **Macro** — CPI, GDP, fed funds rate, economic calendar, yield curve data
- **Forex** — 31 currency pairs from ECB, conversion, historical rates
- **Sentiment** — CNN Fear & Greed Index, Crypto Fear & Greed
- **Market Workspace** — save a trading profile, named watchlists, and thesis notes for personalized workflows across sessions

## Trading Skills

19 ready-made workflows that chain multiple tools into structured analysis. Each skill orchestrates 5-14 tools in parallel and outputs a verdict with direction, confidence, and key levels.

| Category | Skills | What They Do |
|----------|--------|-------------|
| **Daily Routines** | `/morning-briefing`, `/market-close-recap`, `/crypto-briefing` | Pre-market scan, EOD recap, crypto overview |
| **Analysis** | `/analyze-stock TICKER`, `/compare TICKER1 TICKER2`, `/analyze-crypto COIN` | Deep dives and side-by-side comparisons |
| **Strategies** | `/swing-setup`, `/earnings-play TICKER`, `/options-flow TICKER`, `/dividend-screen` | Swing trades, earnings options, smart money, income screen |
| **Macro** | `/macro-dashboard`, `/fed-watch`, `/sector-rotation` | Economic indicators, Fed outlook, sector rotation |
| **Risk** | `/insider-tracker TICKER`, `/smart-money TICKER`, `/risk-check TICKER` | Insider trades, institutional flow, pre-trade risk scorecard |
| **Workspace** | `/setup-market-workspace`, `/workspace-morning-brief` | Guided setup for saved profile/watchlist context and a personalized brief driven by your stored names |

Skills degrade gracefully when optional API keys are missing. Workspace skills require `--enable-workspace` in the server config.

<details>
<summary>Install options</summary>

```bash
npx -p stock-scanner-mcp stock-scanner-install-skills                    # all 19 skills
npx -p stock-scanner-mcp stock-scanner-install-skills --scope project    # project only (.claude/skills/)
npx -p stock-scanner-mcp stock-scanner-install-skills --category macro   # one category
npx -p stock-scanner-mcp stock-scanner-install-skills --category workspace # workspace skills only
npx -p stock-scanner-mcp stock-scanner-install-skills --list             # list without installing
npx -p stock-scanner-mcp stock-scanner-install-skills --force            # overwrite existing
```

Manual: `git clone` this repo and `cp -r skills/*/ ~/.claude/skills/`
</details>

See [skills/README.md](skills/README.md) for the full catalog.

## Market Workspace

The Market Workspace is an optional stateful layer that remembers your trading context across sessions — your trading style, named watchlists, and investment thesis notes per symbol. Skills like `/workspace-morning-brief` use this context to deliver personalized market scans instead of generic ones.

### What you can do with it

- **`/workspace-morning-brief`** — personalized pre-market scan that reads your profile and watchlist, checks earnings, news, and price action for your names, and highlights what matters today
- **Add more watchlists** — ask Claude: *"Create a watchlist called 'earnings' with AAPL, MSFT, GOOG"*
- **Track investment theses** — save your reasoning per ticker so the system monitors it for you (see below)
- **Update anytime** — *"Add NVDA to my core watchlist"* or *"Change my review cadence to weekly"*

### Thesis Tracking

Save your investment reasoning per ticker — direction, key levels, catalysts, and timeframe — so the system can monitor it across sessions.

**Save a thesis:**

```
"My thesis on NIO: bullish above $6.35, that confirms the uptrend. Below it the setup is invalid."
```

Claude saves the structured thesis:

| Field | Value |
|-------|-------|
| Direction | Bullish above $6.35 |
| Bear case | Below $6.35 uptrend is invalidated |
| Catalyst | Technical breakout at $6.35 |
| Timeframe | Swing |

**How it works in practice:** When you run `/workspace-morning-brief`, the brief cross-references your saved theses against live price action:

- NIO drops to $6.10 → *"NIO broke below your $6.35 thesis floor — re-evaluate."*
- NIO rallies to $7.20 → *"NIO holding above your $6.35 level — uptrend thesis intact."*

Without a thesis, the brief just reports a price change. With a thesis, it tells you **whether the move matters to your plan.**

Each thesis supports five fields: `summary`, `bullCase`, `bearCase`, `catalyst`, and `timeframe`. You can save up to 200 theses per workspace.

### Configuration reference

| Option | Default | Description |
|--------|---------|-------------|
| `--enable-workspace` | off | Activate the 7 workspace tools |
| `--data-dir <path>` | `~/.stock-scanner-mcp` | Directory for `workspace.json` storage |
| `--default-exchange` | `NASDAQ` | Default exchange for ticker resolution |

Data is stored locally in `workspace.json` — no cloud sync, no external calls. If you omit `--enable-workspace`, the server stays fully stateless and writes no local data.

For the full list of workspace tools, see the [tool reference](#workspace--personalized-context-optional-no-api-key) below.

## Modules

| Module | Tools | API Key | Description |
|--------|-------|---------|-------------|
| tradingview | 10 | None | US stock scanner with quotes, technicals, sectors, indices, and screening |
| tradingview-crypto | 4 | None | Crypto pair scanner with technicals and screening |
| sec-edgar | 6 | None | SEC filings, insider trades, institutional holdings, ownership |
| coingecko | 3 | None | Crypto market data, trending coins, global stats |
| options | 5 | None | Options chains, Greeks, unusual activity, max pain, implied move |
| options-cboe | 1 | None | CBOE put/call ratio sentiment indicator |
| sentiment | 2 | None | CNN Fear & Greed Index, Crypto Fear & Greed Index |
| frankfurter | 5 | None | Forex exchange rates — 31 currencies from ECB (daily reference rates) |
| workspace | 7 | None | Optional stateful profile, watchlists, and thesis tracking for personalized workflows (`--enable-workspace`) |
| finnhub | 9 | `FINNHUB_API_KEY` | Quotes, news, earnings, analyst ratings, short interest |
| alpha-vantage | 5 | `ALPHA_VANTAGE_API_KEY` | Quotes, daily prices, fundamentals, earnings, dividends |
| fred | 4 | `FRED_API_KEY` | Economic calendar, indicators (CPI, GDP, rates), historical data |

Modules auto-enable when their API key is set. No-key modules are always enabled, except `workspace`, which requires `--enable-workspace`.

For a complete list of every tool with descriptions, see the [Full Tool Reference](#full-tool-reference-61-tools) below.

## Full Tool Reference (61 tools)

### TradingView — Stock Scanning (no API key)

| Tool | Description |
|------|-------------|
| `tradingview_scan` | Scan US stocks with custom filters (price, RSI, volume, etc.) |
| `tradingview_compare_stocks` | Side-by-side comparison of 2-5 stocks |
| `tradingview_quote` | 15-min delayed quotes for stock tickers (includes pre/post-market) |
| `tradingview_technicals` | Technical indicators (RSI, MACD, moving averages, pivots) |
| `tradingview_top_gainers` | Today's top gaining stocks by % change |
| `tradingview_top_losers` | Today's top losing stocks by % change |
| `tradingview_top_volume` | Highest volume stocks today |
| `tradingview_market_indices` | Real-time VIX, S&P 500, NASDAQ, Dow Jones |
| `tradingview_sector_performance` | S&P 500 sector ETF performance (weekly, monthly, YTD) |
| `tradingview_volume_breakout` | Stocks with unusual volume (2x+ their 10-day average) |

### TradingView — Crypto (no API key)

| Tool | Description |
|------|-------------|
| `crypto_scan` | Scan crypto pairs with custom filters across major exchanges |
| `crypto_quote` | Real-time crypto pair quotes (e.g. BTCUSDT, ETHUSDT) |
| `crypto_technicals` | Technical analysis for crypto pairs (RSI, MACD, MAs, Bollinger) |
| `crypto_top_gainers` | Top gaining crypto pairs by % change |

### SEC EDGAR — Filings & Ownership (no API key)

| Tool | Description |
|------|-------------|
| `edgar_search` | Full-text search across all SEC filings |
| `edgar_company_filings` | Recent official filings (10-K, 10-Q, 8-K) for a company |
| `edgar_company_facts` | Financial metrics from XBRL data (Revenue, EPS, Net Income) |
| `edgar_insider_trades` | Insider buy/sell activity with parsed Form 4 transaction details |
| `edgar_institutional_holdings` | Institutional holdings (13F) by ticker or manager name |
| `edgar_ownership_filings` | Major ownership changes — 13D/13G activist investor filings |

### CoinGecko — Crypto Intelligence (no API key)

| Tool | Description |
|------|-------------|
| `coingecko_coin` | Detailed crypto info by CoinGecko slug (e.g. 'bitcoin', 'solana') |
| `coingecko_trending` | Top 7 trending cryptos by search volume (last 24h) |
| `coingecko_global` | Global crypto market cap, volume, BTC/ETH dominance |

### Options — Chains, Greeks & Unusual Activity (no API key)

| Tool | Description |
|------|-------------|
| `options_expirations` | Available expiration dates for a stock's options |
| `options_chain` | Full options chain with Greeks for a given expiration |
| `options_unusual_activity` | Unusual options activity — high volume/OI contracts |
| `options_max_pain` | Max pain (strike where most options expire worthless) |
| `options_implied_move` | Expected move from ATM straddle pricing |

### Options CBOE — Put/Call Sentiment (no API key)

| Tool | Description |
|------|-------------|
| `options_put_call_ratio` | CBOE equity/index/total put/call ratio for market sentiment |

### Sentiment — Fear & Greed (no API key)

| Tool | Description |
|------|-------------|
| `sentiment_fear_greed` | CNN Fear & Greed Index — composite score (0-100) with 7 sub-indicators |
| `sentiment_crypto_fear_greed` | Crypto Fear & Greed Index — daily score (0-100) with historical values |

### Frankfurter — Forex Rates (no API key)

| Tool | Description |
|------|-------------|
| `frankfurter_latest` | Latest ECB exchange rates for 31 currencies |
| `frankfurter_historical` | Exchange rates for a specific past date |
| `frankfurter_timeseries` | Daily rate history for a date range (max 90 days) |
| `frankfurter_convert` | Convert an amount between two currencies |
| `frankfurter_currencies` | List all supported currency codes |

### Workspace — Personalized Context (optional, no API key)

Enabled only when you start the server with `--enable-workspace`.

| Tool | Description |
|------|-------------|
| `workspace_get_profile` | Read the saved trading profile and workspace defaults |
| `workspace_update_profile` | Save or update trading style, asset focus, and review cadence |
| `workspace_list_watchlists` | List all saved watchlists and their resolved instruments |
| `workspace_create_watchlist` | Create a named empty watchlist such as `core` or `swing` |
| `workspace_update_watchlist` | Replace a watchlist's saved symbols with resolved, deduplicated instruments |
| `workspace_get_thesis` | Read a thesis for a symbol using a stable hit/miss JSON shape |
| `workspace_save_thesis` | Save or update a thesis note for a symbol |

### Finnhub — News, Earnings & Macro (requires `FINNHUB_API_KEY`)

| Tool | Description |
|------|-------------|
| `finnhub_quote` | Real-time stock quote |
| `finnhub_company_profile` | Company info (industry, market cap, IPO date, website) |
| `finnhub_peers` | Comparable companies in the same industry |
| `finnhub_market_status` | Exchange open/closed status and current session |
| `finnhub_market_news` | Latest market news (general, forex, crypto, merger) |
| `finnhub_company_news` | Company-specific news by ticker and date range |
| `finnhub_earnings_calendar` | Upcoming and historical earnings reports |
| `finnhub_analyst_ratings` | Analyst consensus and rating history |
| `finnhub_short_interest` | Short interest, short ratio, and key financial metrics |

### Alpha Vantage — Fundamentals & History (requires `ALPHA_VANTAGE_API_KEY`)

| Tool | Description |
|------|-------------|
| `alphavantage_quote` | Real-time stock quote (price, change, volume) |
| `alphavantage_daily` | Daily OHLCV price history (up to 100 days) |
| `alphavantage_overview` | Company fundamentals (PE, market cap, sector, analyst target) |
| `alphavantage_earnings_history` | Historical EPS actual vs estimate by quarter |
| `alphavantage_dividend_history` | Historical dividend payments and dates |

### FRED — US Economic Data (requires `FRED_API_KEY`)

| Tool | Description |
|------|-------------|
| `fred_economic_calendar` | Upcoming high-impact economic releases (FOMC, CPI, NFP, GDP) |
| `fred_indicator` | Latest value for any indicator (CPI, fed funds, unemployment, etc.) |
| `fred_indicator_history` | Historical values with unit transforms (YoY %, change, level) |
| `fred_search` | Discover FRED series IDs by keyword |

## Configuration

### CLI Options

```bash
npx -y stock-scanner-mcp --modules tradingview,sec-edgar    # Enable specific modules only
npx -y stock-scanner-mcp --default-exchange NYSE             # Set default exchange
npx -y stock-scanner-mcp --enable-workspace                  # Turn on local workspace tools
npx -y stock-scanner-mcp --enable-workspace --data-dir /tmp/market-workspace  # Custom data directory
npx -y stock-scanner-mcp --help                              # Show all options
```

### API Keys (optional)

All three keys are **free** — no credit card required:

| Key | Get it from | What it unlocks |
|-----|-------------|-----------------|
| `FINNHUB_API_KEY` | [finnhub.io/register](https://finnhub.io/register) | Real-time quotes, company news, earnings calendar, analyst ratings, short interest (9 tools) |
| `ALPHA_VANTAGE_API_KEY` | [alphavantage.co/support](https://www.alphavantage.co/support/#api-key) | Daily price history, company fundamentals, earnings & dividend history (5 tools) |
| `FRED_API_KEY` | [fred.stlouisfed.org/api](https://fred.stlouisfed.org/docs/api/api_key.html) | Economic calendar, CPI/GDP/fed funds indicators, historical data (4 tools) |

Add them to the `env` block in your MCP config (see [Quick Start](#step-1--add-the-server-to-your-mcp-config)).

### Use with other MCP clients

Any MCP client that supports stdio servers can run this package. Use the same JSON config from [Quick Start](#step-1--add-the-server-to-your-mcp-config). If your client does not expose `npx`, install the package first and point the client at the installed binary instead.

## HTTP Sidecar

An optional HTTP server exposing all tools as REST endpoints for non-MCP integrations (trading bots, chat UIs, LLM pipelines).

```bash
npx stock-scanner-sidecar              # Start on port 3200
npx stock-scanner-sidecar --port 8080  # Custom port
```

55 endpoints including `/tradingview/quote`, `/options/chain`, `/frankfurter/convert`, and more. See [wiki](https://github.com/yyordanov-tradu/stock-scanner-mcp/wiki/Sidecar-HTTP-API) for the full route table.

## Rate Limits

| API | Free Tier Limit | Cache TTL |
|-----|-----------------|-----------|
| TradingView | No documented limit | — |
| SEC EDGAR | 10 req/sec | 5 min |
| CoinGecko | ~30 calls/min | 1 min |
| Yahoo Finance (Options) | No documented limit | 5 min |
| CBOE | No documented limit | 30 min |
| Finnhub | 30 calls/sec | 5 min |
| Alpha Vantage | 5 calls/min, 25/day | 1 min |
| FRED | No hard limit | 30 min |
| Frankfurter (ECB) | No limit | 1 hour |

All modules use in-memory TTL caching to minimize API calls.

## Development

```bash
npm install && npm run build && npm test
npm run lint          # TypeScript type checking
npm run validate-tools # Tool description quality check
```

## Credibility Artifacts

- [Benchmark examples](docs/credibility/benchmark-examples.md)
- [Sample transcripts](docs/credibility/sample-transcripts.md)
- [Latency & reliability snapshot](docs/credibility/latency-reliability.md)

<details>
<summary>Architecture</summary>

```
src/
├── index.ts              # MCP server entry + prompt definitions
├── config.ts             # CLI arg parsing
├── registry.ts           # Module auto-discovery and filtering
├── modules/
│   ├── tradingview/      # 10 tools — stock scanning, quotes, technicals, sectors, indices
│   ├── tradingview-crypto/ # 4 tools — crypto scanning and technicals
│   ├── sec-edgar/        # 6 tools — filings, insider trades, holdings
│   ├── coingecko/        # 3 tools — crypto market data
│   ├── options/          # 5 tools — options chains, Greeks, unusual activity, implied move
│   ├── options-cboe/     # 1 tool  — CBOE put/call ratio sentiment
│   ├── workspace/        # 7 tools — stateful profile, watchlists, thesis notes
│   ├── finnhub/          # 9 tools — quotes, news, earnings, analyst ratings, short interest
│   ├── alpha-vantage/    # 5 tools — quotes, fundamentals, dividends
│   ├── fred/             # 4 tools — economic calendar, indicators, historical data
│   ├── sentiment/        # 2 tools — Fear & Greed indexes (market + crypto)
│   └── frankfurter/      # 5 tools — forex exchange rates (ECB, 31 currencies)
├── sidecar/
│   ├── index.ts          # HTTP sidecar entry point (port 3200)
│   └── server.ts         # HTTP request handler (55 endpoints)
└── shared/
    ├── http.ts           # HTTP client with timeouts and key sanitization
    ├── cache.ts          # In-memory TTL cache
    ├── types.ts          # ToolDefinition, ToolResult, helpers
    ├── resolver.ts       # Ticker/exchange resolution
    └── utils.ts          # withMetadata error wrapper
```

</details>

## License

MIT
