---
name: swing-setup
description: Scan the market for swing trade setups (2-10 day holds) using RSI oversold, volume breakout, and catalyst filters.
argument-hint: [EXCHANGE]
---

# Swing Trade Setup Scanner

## Overview

Act as a swing trading desk analyst. Scan US equities for actionable 2-10 day setups using technical oversold conditions, volume breakouts, and catalyst-driven moves.

Announce at start: "Scanning for swing trade setups across US equities..."

## Input

Parse `$ARGUMENTS` as optional exchange filter (e.g., NASDAQ, NYSE). If empty, scan all exchanges.

## Data Collection

### Wave 1 -- FIRE ALL IN PARALLEL

| Tool | Parameters | Priority |
|------|-----------|----------|
| `tradingview_scan` | filters: RSI < 30 AND volume > 500000 AND market_cap > 500M. Columns: close, change, RSI, volume, name, description, market_cap_basic. limit=15 | REQUIRED |
| `tradingview_scan` | filters: relative_volume > 2 AND change > 3 AND market_cap > 500M. limit=15 | REQUIRED |
| `tradingview_volume_breakout` | limit=15 | ENRICHMENT |
| `tradingview_market_indices` | (none) | ENRICHMENT |
| `sentiment_fear_greed` | (none) | ENRICHMENT |

### Wave 2 -- FOR TOP 3 CANDIDATES FROM WAVE 1

Select top 3 candidates from Wave 1 results. Rank by relative volume (highest first). Break ties by RSI distance from 30. If technicals fail for a candidate, skip the deep dive for that ticker and note the gap.

| Tool | Parameters | Priority |
|------|-----------|----------|
| `tradingview_technicals` | tickers=[candidate] for each | REQUIRED |
| `finnhub_company_news` | symbol=candidate, last 7 days, for each | ENRICHMENT |
| `edgar_insider_trades` | ticker=candidate, for each | ENRICHMENT |

## Analysis

Filter Wave 1 results to find the best setups. Look for three patterns:

1. **Oversold bounce** -- RSI < 30 combined with a volume surge vs average. Price should be near support.
2. **Breakout** -- Price above SMA20 with relative volume > 2x. Confirm with Wave 2 technicals.
3. **Catalyst-driven** -- News event plus abnormal volume. Verify the catalyst is material.

Cross-check every candidate against market context (indices trend, fear/greed level). Avoid setups that fight the broad market direction unless the catalyst is overwhelming.

DO NOT reproduce raw tool output. Synthesize and rank.

## Output Format

### Market Context
One line: key indices direction + Fear & Greed reading.

### Scan Results
Table of top candidates (max 8):

| Ticker | Name | Price | Change% | RSI | RelVol | Setup Type |
|--------|------|-------|---------|-----|--------|------------|

### Deep Dive (Top 3)
For each candidate:
- **Technicals**: Key levels (support/resistance), moving averages, oscillator signals
- **Catalyst**: Recent news or filing that explains the move (or "No catalyst found")
- **Insider Activity**: Recent buys/sells in last 90 days (or "None reported")

### Trade Ideas
For each actionable setup:
- **Entry**: Specific price or condition
- **Target**: Price target with rationale
- **Stop**: Hard stop level
- **Risk/Reward**: Ratio
- **Hold Period**: Estimated days

## Limitations

Data from TradingView and Yahoo Finance is 15-minute delayed. CBOE and sentiment data is end-of-day. Verify critical levels with real-time data before executing trades.

All trade recommendations are based on delayed data. Include a disclaimer in the output reminding the user to verify entries, stops, and targets with a real-time feed before placing orders.

## Common Mistakes

- Presenting all 30 scan results instead of filtering to actionable setups. FILTER RUTHLESSLY.
- Ignoring market context -- do not recommend long setups in a fear-extreme selloff without acknowledging the risk.
- Suggesting entries without stops. EVERY trade idea MUST have a stop loss.
- Treating high yield traps or penny stocks as swing candidates. Enforce the market cap floor.
