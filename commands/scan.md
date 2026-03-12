---
description: Scan a stock or crypto symbol for technical indicators, news, and fundamentals
argument-hint: <SYMBOL> [timeframe]
---

# Scan Market Data

Perform a comprehensive scan of the given symbol using all available market data tools.

## Arguments

The user provided: $ARGUMENTS

Parse the arguments:
- First argument: **symbol** (required) -- e.g. AAPL, TSLA, BTC
- Second argument: **timeframe** (optional, default: 1D) -- e.g. 1h, 15m, 4h, 1D

## Instructions

1. **Determine asset type:** If the symbol looks like a crypto ticker (BTC, ETH, SOL, DOGE, ADA, XRP, DOT, AVAX, MATIC, LINK, UNI, ATOM), use crypto tools. Otherwise use stock tools.

2. **For stocks**, run these tools in parallel:
   - `tradingview_scan_indicators` -- technicals for the symbol + timeframe
   - `finnhub_company_news` -- recent news (if available)
   - `edgar_recent_filings` -- recent SEC filings (if available)
   - `alpha_vantage_quote` -- current price (if available)
   - `alpha_vantage_company_overview` -- fundamentals (if available)

3. **For crypto**, run these tools in parallel:
   - `crypto_scan_indicators` -- technicals for the pair + timeframe
   - `coingecko_coin_data` -- price, market cap, volume

4. **Synthesize** the results into a concise market summary:
   - Current price and change
   - Key technical signals (RSI, MACD, trend)
   - Any notable news or filings
   - Overall sentiment (bullish/bearish/neutral) with reasoning

Only use tools that are available. If some modules are not enabled, work with what you have.
