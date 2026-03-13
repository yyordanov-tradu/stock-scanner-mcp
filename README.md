# stock-scanner-mcp

A modular MCP (Model Context Protocol) server that provides Claude Code with stock and crypto market data via 21 tools across 6 data source modules.

## Quick Start

### As a Claude Code Plugin

Add to your `.mcp.json`:
```json
{
  "mcpServers": {
    "stock-scanner": {
      "command": "npx",
      "args": ["stock-scanner-mcp"],
      "env": {
        "FINNHUB_API_KEY": "${FINNHUB_API_KEY}",
        "ALPHA_VANTAGE_API_KEY": "${ALPHA_VANTAGE_API_KEY}"
      }
    }
  }
}
```

### Run Directly

```bash
npx stock-scanner-mcp
```

With specific modules only:
```bash
npx stock-scanner-mcp --modules tradingview,coingecko
```

## Modules

| Module | Tools | API Key | Description |
|--------|-------|---------|-------------|
| tradingview | 6 | None | US stock scanner with real-time quotes, technicals, and screening |
| tradingview-crypto | 4 | None | Crypto pair scanner with technicals and screening |
| sec-edgar | 2 | None | SEC EDGAR filing search and company filings |
| coingecko | 3 | None | Crypto market data, trending coins, global stats |
| finnhub | 3 | `FINNHUB_API_KEY` | Market news, company news, earnings calendar |
| alpha-vantage | 3 | `ALPHA_VANTAGE_API_KEY` | Stock quotes, daily prices, company fundamentals |

Modules auto-enable when their required environment variables are set. Modules with no required key are always enabled.

## Tools Reference

### TradingView Stock Scanner (6 tools)

| Tool | Description |
|------|-------------|
| `tradingview_scan` | Scan stocks with custom filters on any technical or fundamental indicator |
| `tradingview_quote` | Get real-time quotes for specific stock symbols |
| `tradingview_technicals` | Technical analysis summary (RSI, MACD, MAs, recommendation) |
| `tradingview_top_gainers` | Top gaining stocks by percentage change |
| `tradingview_top_volume` | Highest volume stocks |
| `tradingview_volume_breakout` | Stocks with unusual volume breakouts |

### TradingView Crypto Scanner (4 tools)

| Tool | Description |
|------|-------------|
| `crypto_scan` | Scan crypto pairs with filters |
| `crypto_quote` | Real-time crypto pair quotes |
| `crypto_technicals` | Technical analysis for crypto pairs |
| `crypto_top_gainers` | Top gaining crypto pairs |

### SEC EDGAR (2 tools)

| Tool | Description |
|------|-------------|
| `edgar_search` | Full-text search SEC filings |
| `edgar_company_filings` | Get recent filings for a company |

### CoinGecko (3 tools)

| Tool | Description |
|------|-------------|
| `coingecko_coin` | Detailed crypto info (use slug IDs: 'bitcoin', not 'BTC') |
| `coingecko_trending` | Trending cryptocurrencies (top 7) |
| `coingecko_global` | Global market stats (market cap, dominance) |

### Finnhub (3 tools) — requires `FINNHUB_API_KEY`

| Tool | Description |
|------|-------------|
| `finnhub_market_news` | Latest market news by category |
| `finnhub_company_news` | Company-specific news with date range |
| `finnhub_earnings_calendar` | Upcoming earnings reports |

### Alpha Vantage (3 tools) — requires `ALPHA_VANTAGE_API_KEY`

| Tool | Description |
|------|-------------|
| `alphavantage_quote` | Real-time stock quote |
| `alphavantage_daily` | Daily OHLCV price history |
| `alphavantage_overview` | Company fundamentals (PE, market cap, sector) |

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `FINNHUB_API_KEY` | No | Enables Finnhub module. Get free key at [finnhub.io](https://finnhub.io) |
| `ALPHA_VANTAGE_API_KEY` | No | Enables Alpha Vantage module. Get free key at [alphavantage.co](https://www.alphavantage.co/support/#api-key) |

### CLI Arguments

| Argument | Description |
|----------|-------------|
| `--modules` | Comma-separated list of modules to enable (default: all available) |
| `--default-exchange` | Default exchange for symbol resolution (default: NASDAQ) |

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Run locally
node dist/index.js
```

## Rate Limits

| API | Free Tier Limit |
|-----|-----------------|
| TradingView | No documented limit (be reasonable) |
| SEC EDGAR | 10 requests/second |
| CoinGecko | ~30 calls/minute |
| Finnhub | 30 calls/second |
| Alpha Vantage | 5 calls/minute, 25 calls/day |

All modules use in-memory TTL caching to minimize API calls.

## License

MIT
