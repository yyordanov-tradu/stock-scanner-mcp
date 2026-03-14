# stock-scanner-mcp

A modular MCP (Model Context Protocol) server that gives Claude Code real-time access to stock and crypto market data. Scan markets, check technicals, monitor insider trades, and track earnings — all from your terminal.

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

### With API keys (optional, enables more tools):

```json
{
  "mcpServers": {
    "stock-scanner": {
      "command": "npx",
      "args": ["-y", "stock-scanner-mcp"],
      "env": {
        "FINNHUB_API_KEY": "your-key-here",
        "ALPHA_VANTAGE_API_KEY": "your-key-here"
      }
    }
  }
}
```

## Modules

| Module | Tools | API Key | Description |
|--------|-------|---------|-------------|
| tradingview | 6 | None | US stock scanner with real-time quotes, technicals, and screening |
| tradingview-crypto | 4 | None | Crypto pair scanner with technicals and screening |
| sec-edgar | 6 | None | SEC EDGAR filings, insider trades, institutional holdings, ownership |
| coingecko | 3 | None | Crypto market data, trending coins, global stats |
| finnhub | 3 | `FINNHUB_API_KEY` | Market news, company news, earnings calendar |
| alpha-vantage | 3 | `ALPHA_VANTAGE_API_KEY` | Stock quotes, daily prices, company fundamentals |

Modules auto-enable when their required environment variables are set. Modules with no required key are always enabled.

## Available Tools (25 total)

### TradingView — Stock Scanning (no API key)

| Tool | Description |
|------|-------------|
| `tradingview_scan` | Scan US stocks with custom filters (price, RSI, volume, etc.) |
| `tradingview_quote` | Real-time quotes for stock tickers |
| `tradingview_technicals` | Technical indicators (RSI, MACD, moving averages, pivots) |
| `tradingview_top_gainers` | Today's top gaining stocks |
| `tradingview_top_volume` | Highest volume stocks today |
| `tradingview_volume_breakout` | Stocks with unusual volume spikes |

### TradingView — Crypto (no API key)

| Tool | Description |
|------|-------------|
| `crypto_scan` | Scan crypto pairs with custom filters |
| `crypto_quote` | Real-time crypto pair quotes |
| `crypto_technicals` | Technical analysis for crypto pairs |
| `crypto_top_gainers` | Top gaining crypto pairs |

### SEC EDGAR — Filings & Ownership (no API key)

| Tool | Description |
|------|-------------|
| `edgar_search` | Full-text search across all SEC filings |
| `edgar_company_filings` | Recent official filings (10-K, 10-Q, 8-K) |
| `edgar_company_facts` | Financial metrics from XBRL data |
| `edgar_insider_trades` | Insider buy/sell activity (Form 4) |
| `edgar_institutional_holdings` | Institutional holdings (13F) |
| `edgar_ownership_filings` | Major ownership changes (13D/13G) |

### CoinGecko — Crypto Intelligence (no API key)

| Tool | Description |
|------|-------------|
| `coingecko_coin` | Detailed crypto info by CoinGecko ID |
| `coingecko_trending` | Top 7 trending cryptos by search volume |
| `coingecko_global` | Global crypto market statistics |

### Finnhub — News & Earnings (requires `FINNHUB_API_KEY`)

| Tool | Description |
|------|-------------|
| `finnhub_market_news` | Latest market news articles |
| `finnhub_company_news` | Company-specific news |
| `finnhub_earnings_calendar` | Upcoming/historical earnings dates |

### Alpha Vantage — Fundamentals (requires `ALPHA_VANTAGE_API_KEY`)

| Tool | Description |
|------|-------------|
| `alphavantage_quote` | Real-time stock quote |
| `alphavantage_daily` | Daily OHLCV price history |
| `alphavantage_overview` | Company fundamentals (PE, market cap, sector) |

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `FINNHUB_API_KEY` | No | Enables Finnhub module ([get free key](https://finnhub.io/)) |
| `ALPHA_VANTAGE_API_KEY` | No | Enables Alpha Vantage module ([get free key](https://www.alphavantage.co/support/#api-key)) |

### CLI Options

```bash
stock-scanner-mcp --modules tradingview,sec-edgar    # Enable specific modules only
stock-scanner-mcp --default-exchange NYSE             # Set default exchange
```

## Example Usage in Claude Code

Once configured, just ask Claude naturally:

- "What are the top gaining stocks today?"
- "Show me technicals for AAPL"
- "Any insider trades for TSLA in the last 30 days?"
- "What's trending in crypto right now?"
- "Find stocks with unusual volume today"

## Development

```bash
npm install
npm run build
npm test
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
