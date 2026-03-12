---
name: market-data
description: Guidance on using stock and crypto market data tools effectively -- when to use which tools, how to interpret results, and how to combine data sources
---

# Market Data Tools Guide

## Available Tool Categories

### Stock Technical Analysis (TradingView)
- `tradingview_scan_indicators` -- full technical scan for a stock symbol
- `tradingview_top_gainers` / `tradingview_top_losers` -- market movers
- `tradingview_volume_breakout` -- unusual volume detection
- `tradingview_rating_filter` -- filter by buy/sell rating

### Crypto Technical Analysis (TradingView Crypto)
- `crypto_scan_indicators` -- full technical scan for crypto pairs
- `crypto_top_gainers` / `crypto_top_losers` -- crypto movers
- `crypto_volume_breakout` -- unusual crypto volume

### News & Events
- `finnhub_company_news` -- recent company news (7-day lookback)
- `finnhub_earnings_calendar` -- upcoming/recent earnings
- `edgar_search_filings` -- search SEC 8-K filings
- `edgar_recent_filings` -- recent material events

### Prices & Fundamentals
- `alpha_vantage_quote` -- current price, volume, change
- `alpha_vantage_daily_history` -- daily OHLCV (100 days)
- `alpha_vantage_company_overview` -- PE, EPS, market cap, sector

### Crypto Market Data
- `coingecko_coin_data` -- price, market cap, 24h volume
- `coingecko_trending` -- trending coins
- `coingecko_global` -- total market cap, BTC dominance

## When to Use What

| User Question | Tools to Use |
|---|---|
| "What do the charts say about AAPL?" | `tradingview_scan_indicators` |
| "What's moving today?" | `tradingview_top_gainers`, `tradingview_top_losers`, `tradingview_volume_breakout` |
| "Any news on TSLA?" | `finnhub_company_news`, `edgar_recent_filings` |
| "Is MSFT fairly valued?" | `alpha_vantage_company_overview`, `alpha_vantage_quote` |
| "How's crypto doing?" | `coingecko_global`, `coingecko_trending`, `crypto_top_gainers` |
| "Full analysis of AAPL" | All stock tools in parallel |

## Key Principles

1. **Call tools in parallel** when gathering multiple data points
2. **Not all modules may be available** -- some require API keys. Use what's available and note what's missing
3. **Timeframes matter** -- default to 1D (daily) unless the user specifies otherwise. Options: 1D, 4h, 1h, 15m, 5m
4. **Interpret, don't just relay** -- combine signals into an actionable view
5. **Truncated responses** -- tool outputs are already truncated for token efficiency
