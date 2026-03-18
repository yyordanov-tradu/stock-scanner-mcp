# stock-scanner-mcp

[![CI](https://github.com/yyordanov-tradu/stock-scanner-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/yyordanov-tradu/stock-scanner-mcp/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/stock-scanner-mcp)](https://www.npmjs.com/package/stock-scanner-mcp)
[![npm downloads](https://img.shields.io/npm/dw/stock-scanner-mcp)](https://www.npmjs.com/package/stock-scanner-mcp)

A modular MCP (Model Context Protocol) server that gives Claude Code real-time access to stock and crypto market data. Scan markets, check technicals, monitor insider trades, track earnings and economic events — all from your terminal.

**47 tools** across **9 modules** — 6 modules work with zero API keys.

**[Wiki](https://github.com/yyordanov-tradu/stock-scanner-mcp/wiki)** — Full tool reference, example prompts, advanced strategies, and troubleshooting guide.

## Quick Start

```bash
npx stock-scanner-mcp
```

Or install globally:

```bash
npm install -g stock-scanner-mcp
stock-scanner-mcp
```

## Setup with Claude Code

Add to your Claude Code MCP config (`~/.claude.json` or project `.mcp.json`):

```json
{
  "mcpServers": {
    "stock-scanner": {
      "command": "npx",
      "args": ["-y", "stock-scanner-mcp"]
    }
  }
}
```

### With API keys (optional, enables all 47 tools):

```json
{
  "mcpServers": {
    "stock-scanner": {
      "command": "npx",
      "args": ["-y", "stock-scanner-mcp"],
      "env": {
        "FINNHUB_API_KEY": "your-key-here",
        "ALPHA_VANTAGE_API_KEY": "your-key-here",
        "FRED_API_KEY": "your-key-here"
      }
    }
  }
}
```

## Modules

| Module | Tools | API Key | Description |
|--------|-------|---------|-------------|
| tradingview | 10 | None | US stock scanner with quotes, technicals, sectors, indices, and screening |
| tradingview-crypto | 4 | None | Crypto pair scanner with technicals and screening |
| sec-edgar | 6 | None | SEC filings, insider trades, institutional holdings, ownership |
| coingecko | 3 | None | Crypto market data, trending coins, global stats |
| options | 5 | None | Options chains, Greeks, unusual activity, max pain, implied move |
| options-cboe | 1 | None | CBOE put/call ratio sentiment indicator |
| finnhub | 9 | `FINNHUB_API_KEY` | Quotes, news, earnings, analyst ratings, short interest |
| alpha-vantage | 5 | `ALPHA_VANTAGE_API_KEY` | Quotes, daily prices, fundamentals, earnings, dividends |
| fred | 4 | `FRED_API_KEY` | Economic calendar, indicators (CPI, GDP, rates), historical data |

Modules auto-enable when their required environment variables are set. Modules with no required key are always enabled.

## Available Tools (47 total)

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

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `FINNHUB_API_KEY` | No | Enables Finnhub module ([get free key](https://finnhub.io/)) |
| `ALPHA_VANTAGE_API_KEY` | No | Enables Alpha Vantage module ([get free key](https://www.alphavantage.co/support/#api-key)) |
| `FRED_API_KEY` | No | Enables FRED module ([get free key](https://fred.stlouisfed.org/docs/api/api_key.html)) |

### CLI Options

```bash
stock-scanner-mcp --modules tradingview,sec-edgar    # Enable specific modules only
stock-scanner-mcp --default-exchange NYSE             # Set default exchange
stock-scanner-mcp --help                              # Show all options
```

## MCP Prompts

The server includes built-in analysis workflows:

| Prompt | Description |
|--------|-------------|
| `analyze_stock` | Full stock analysis — quote, technicals, news, and BTC correlation for crypto-related stocks |
| `intraday_candidates` | Find intraday trading candidates with customizable price range and filters |

## Example Usage in Claude Code

Once configured, just ask Claude naturally:

- "What are the top gaining stocks today?"
- "Show me technicals for AAPL on the hourly timeframe"
- "Any insider trades for TSLA in the last 30 days?"
- "What's trending in crypto right now?"
- "Find stocks with unusual volume today"
- "What earnings are coming up this week?"
- "What's the current fed funds rate and CPI inflation trend?"
- "Show me upcoming high-impact economic events"
- "What's the short interest on GME?"
- "Get Apple's dividend history"
- "What's the options chain for AAPL expiring next Friday?"
- "Any unusual options activity on TSLA?"
- "What's the max pain for SPY this week?"
- "Show me the put/call ratio trend for the last 30 days"

## Development

```bash
npm install
npm run build
npm test
npm run lint          # TypeScript type checking
node dist/index.js    # Run locally
```

## Architecture

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
│   ├── finnhub/          # 9 tools — quotes, news, earnings, analyst ratings, short interest
│   ├── alpha-vantage/    # 5 tools — quotes, fundamentals, dividends
│   └── fred/             # 4 tools — economic calendar, indicators, historical data
└── shared/
    ├── http.ts           # HTTP client with timeouts and key sanitization
    ├── cache.ts          # In-memory TTL cache
    ├── types.ts          # ToolDefinition, ToolResult, helpers
    ├── resolver.ts       # Ticker/exchange resolution
    └── utils.ts          # withMetadata error wrapper
```

## Rate Limits

| API | Free Tier Limit | Cache TTL |
|-----|-----------------|-----------|
| TradingView | No documented limit (be reasonable) | — |
| SEC EDGAR | 10 requests/second | 5 min |
| CoinGecko | ~30 calls/minute | 1 min |
| Yahoo Finance | No documented limit (be reasonable) | 5 min |
| CBOE CDN | No documented limit | 30 min |
| Finnhub | 30 calls/second | 5 min |
| Alpha Vantage | 5 calls/minute, 25 calls/day | 1 min |
| FRED | No hard limit | 30 min |

All modules use in-memory TTL caching to minimize API calls. Error responses include retry hints for rate-limited requests.

## License

MIT
