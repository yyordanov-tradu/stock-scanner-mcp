# Task 2: Plugin Shell

**Files:**
- Create: `.claude-plugin/plugin.json`
- Create: `commands/scan.md`
- Create: `agents/market-researcher.md`
- Create: `skills/market-data/SKILL.md`

---

**Step 1: Create plugin metadata**

Create `.claude-plugin/plugin.json`:

```json
{
  "name": "stock-scanner",
  "description": "Stock and crypto market data for Claude Code -- technical indicators, news, filings, fundamentals, and crypto metrics from free APIs",
  "version": "0.1.0",
  "author": {
    "name": "Yordan Yordanov"
  },
  "license": "MIT",
  "keywords": ["stocks", "crypto", "trading", "market-data", "technical-analysis"]
}
```

**Step 2: Create /scan command**

Create `commands/scan.md`:

```markdown
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
```

**Step 3: Create market-researcher agent**

Create `agents/market-researcher.md`:

```markdown
---
name: market-researcher
description: |
  Use this agent when the user asks for comprehensive market analysis that requires
  combining data from multiple sources -- technical indicators, news, filings, and
  fundamentals. Good for questions like "What's happening with AAPL?", "Should I
  look at TSLA?", or "Give me a full picture of BTC".
tools: Glob, Grep, Read
model: sonnet
color: green
---

# Market Researcher

You are a market research analyst with access to stock and crypto market data tools. Your job is to gather data from multiple sources and synthesize it into a clear, actionable analysis.

## Approach

1. **Identify the asset** -- determine if it's a stock or crypto, resolve the correct symbol
2. **Gather data in parallel** -- call all relevant tools simultaneously for speed
3. **Analyse the data** -- look for confluences (multiple signals agreeing) and divergences (signals conflicting)
4. **Present findings** -- structured summary with key metrics, technical outlook, catalysts, and risks

## Output Format

Structure your analysis as:

### [Symbol] Market Analysis

**Price:** Current price, daily change, volume vs average

**Technical Outlook:**
- Trend: (bullish/bearish/neutral) based on MAs and ADX
- Momentum: RSI, MACD, Stochastic readings
- Key levels: Support/resistance from Bollinger Bands, pivots

**Catalysts:**
- Recent news headlines
- Upcoming earnings
- SEC filings of note

**Fundamentals:** (stocks only)
- PE ratio, EPS, market cap
- Sector context

**Summary:** 2-3 sentence overall assessment
```

**Step 4: Create market-data skill**

Create `skills/market-data/SKILL.md`:

```markdown
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
```

**Step 5: Verify files exist**

Run: `ls -la .claude-plugin/plugin.json commands/scan.md agents/market-researcher.md skills/market-data/SKILL.md`
Expected: All 4 files listed

**Step 6: Commit**

```bash
git add .claude-plugin/ commands/ agents/ skills/
git commit -m "feat: add plugin shell -- metadata, /scan command, market-researcher agent, market-data skill"
```
