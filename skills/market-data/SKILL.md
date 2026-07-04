---
name: market-data
description: Guidance on using stock and crypto market data tools effectively -- when to use which tools, how to interpret results, and how to combine data sources
---

# Market Data Tools Guide

## Available Tool Categories

### Stock Technical Analysis (TradingView)
- `tradingview_scan` -- custom stock scanner with filters and columns
- `tradingview_quote` -- delayed quote for one or more tickers
- `tradingview_technicals` -- RSI, MACD, moving averages, pivots, and ratings
- `tradingview_market_indices` -- VIX, S&P 500, NASDAQ, Dow, and related index context
- `tradingview_sector_performance` -- 11 sector ETFs across multiple timeframes
- `tradingview_top_gainers` / `tradingview_top_losers` -- market movers
- `tradingview_top_volume` -- highest volume stocks
- `tradingview_volume_breakout` -- unusual volume detection
- Use `tradingview_scan` filters and columns for rating-based stock screens
- `market_breadth` -- advance/decline ratio, % above SMA50/SMA200, and new highs/lows

### Crypto Technical Analysis (TradingView Crypto)
- `crypto_scan` -- custom crypto scanner with filters and columns
- `crypto_quote` -- quote and 24h change for crypto pairs
- `crypto_technicals` -- RSI, MACD, moving averages, pivots, and ratings
- `crypto_top_gainers` -- top gaining crypto pairs

### News & Events
- `finnhub_company_news` -- recent company news (7-day lookback)
- `finnhub_earnings_calendar` -- upcoming/recent earnings
- `edgar_search` -- search SEC filings by keyword, form, ticker, and date range
- `edgar_company_filings` -- recent company filings

### Prices & Fundamentals
- `alphavantage_quote` -- current price, volume, change
- `alphavantage_daily` -- daily OHLCV history
- `alphavantage_overview` -- PE, EPS, market cap, sector

### Social Sentiment
- `reddit_trending` -- trending tickers from investing subreddits
- `reddit_mentions` -- mentions and top posts for a ticker
- `reddit_sentiment` -- keyword sentiment for a ticker
- `reddit_watchlist_scan` -- batch scan watchlist tickers

### Crypto Market Data
- `coingecko_coin` -- price, market cap, 24h volume
- `coingecko_trending` -- trending coins
- `coingecko_global` -- total market cap, BTC dominance

## When to Use What

| User Question | Tools to Use |
|---|---|
| "What do the charts say about AAPL?" | `tradingview_technicals`, `tradingview_quote` |
| "What's moving today?" | `tradingview_top_gainers`, `tradingview_top_losers`, `tradingview_volume_breakout` |
| "How broad is this rally?" | `market_breadth`, `tradingview_market_indices` |
| "What's the market regime?" | `tradingview_market_indices`, `market_breadth`, `sentiment_fear_greed`, `tradingview_sector_performance` |
| "Any news on TSLA?" | `finnhub_company_news`, `edgar_company_filings` |
| "Is MSFT fairly valued?" | `alphavantage_overview`, `alphavantage_quote` |
| "How's crypto doing?" | `coingecko_global`, `coingecko_trending`, `crypto_top_gainers`, `crypto_quote` |
| "What is Reddit focused on?" | `reddit_trending`, `reddit_mentions`, `reddit_sentiment` |
| "Full analysis of AAPL" | All stock tools in parallel |

## Key Principles

1. **Call tools in parallel** when gathering multiple data points
2. **Not all modules may be available** -- some require API keys. Use what's available and note what's missing
3. **Timeframes matter** -- default to 1D (daily) unless the user specifies otherwise. Options: 1D, 4h, 1h, 15m, 5m
4. **Interpret, don't just relay** -- combine signals into an actionable view
5. **Truncated responses** -- tool outputs are already truncated for token efficiency
