# Installation & Setup

## Prerequisites

- [Claude Code](https://claude.ai/claude-code) installed
- Node.js 18+

## Option 1: Zero-Config (Recommended)

Add to `~/.claude.json` (global) or `.mcp.json` (per-project):

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

This gives you **29 tools** across 6 modules immediately — no API keys needed.

## Option 2: With API Keys (All 47 Tools)

```json
{
  "mcpServers": {
    "stock-scanner": {
      "command": "npx",
      "args": ["-y", "stock-scanner-mcp"],
      "env": {
        "FINNHUB_API_KEY": "your-key",
        "ALPHA_VANTAGE_API_KEY": "your-key",
        "FRED_API_KEY": "your-key"
      }
    }
  }
}
```

All three keys are free:
- **Finnhub** — [Get free key](https://finnhub.io/) (30 calls/sec)
- **Alpha Vantage** — [Get free key](https://www.alphavantage.co/support/#api-key) (5 calls/min, 25/day)
- **FRED** — [Get free key](https://fred.stlouisfed.org/docs/api/api_key.html) (no hard limit)

## Option 3: Select Specific Modules

Only want certain modules? Use `--modules`:

```json
{
  "mcpServers": {
    "stock-scanner": {
      "command": "npx",
      "args": ["-y", "stock-scanner-mcp", "--modules", "tradingview,options,sec-edgar"]
    }
  }
}
```

## Option 4: Global Install

```bash
npm install -g stock-scanner-mcp
```

Then use `stock-scanner-mcp` instead of `npx -y stock-scanner-mcp` in your config.

## Verify Installation

After adding the config, restart Claude Code and ask:

> "What's the current price of AAPL?"

If you see a quote with price and volume data, you're set.

## Module Overview

| Module | Tools | API Key | What You Get |
|--------|-------|---------|--------------|
| tradingview | 10 | None | Stock scanning, quotes, technicals, sector performance, market indices |
| tradingview-crypto | 4 | None | Crypto scanning, quotes, technicals |
| sec-edgar | 6 | None | SEC filings, insider trades, institutional holdings |
| coingecko | 3 | None | Crypto details, trending coins, global market stats |
| options | 5 | None | Options chains, Greeks, unusual activity, max pain, implied move |
| options-cboe | 1 | None | Put/call ratio sentiment |
| finnhub | 9 | `FINNHUB_API_KEY` | Real-time quotes, news, earnings, analyst ratings, short interest |
| alpha-vantage | 5 | `ALPHA_VANTAGE_API_KEY` | Quotes, daily prices, fundamentals, earnings, dividends |
| fred | 4 | `FRED_API_KEY` | Economic calendar, indicators (CPI, GDP, rates), historical data |
