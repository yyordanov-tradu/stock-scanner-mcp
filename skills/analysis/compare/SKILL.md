---
name: compare
description: Compare 2-5 stocks side by side across valuation, growth, technicals, and analyst sentiment to identify the strongest pick.
argument-hint: [TICKER1 TICKER2 ...]
---

# Compare Stocks

## Overview

Perform a structured side-by-side comparison of multiple stocks. Rank each across key investment dimensions and identify a preferred pick with clear reasoning.

Announce at start: "Comparing [TICKER1], [TICKER2], ... — collecting valuation, technicals, and analyst data..."

## Input

Parse `$ARGUMENTS` as space-separated ticker symbols. If fewer than 2 tickers provided, respond with:
"Usage: /compare TICKER1 TICKER2 [TICKER3 ...]" and STOP.

If more than 5 tickers provided, respond with:
"Maximum 5 tickers supported. Got [N]. Please reduce the list." and STOP.

Normalize all tickers to UPPERCASE. Strip whitespace and leading dollar signs.

## Data Collection

### Wave 1 — ALL calls in parallel

| Tool                      | Parameters                          | Priority    |
|---------------------------|-------------------------------------|-------------|
| tradingview_compare_stocks| tickers=[all tickers as array]      | REQUIRED    |
| alphavantage_overview     | symbols=TICKER (for EACH ticker)    | ENRICHMENT  |
| finnhub_analyst_ratings   | symbol=TICKER (for EACH ticker)     | ENRICHMENT  |

ALL calls launch in parallel. For multi-ticker tools that accept one symbol at a time, fire all instances concurrently.

If the REQUIRED tool fails, report the error and STOP. If ENRICHMENT tools fail for some tickers, continue with available data and note gaps.

## Analysis

DO NOT reproduce raw tool output. Synthesize into a comparative framework.

Score each stock across these dimensions:

1. **Valuation** — P/E, P/S, PEG ratio. Lower is better unless growth justifies premium.
2. **Growth** — Revenue growth, EPS growth trajectory. Higher is better.
3. **Technicals** — TradingView rating, RSI positioning, trend direction. Favor stocks above key SMAs with non-overbought RSI.
4. **Analyst Sentiment** — Consensus rating, target upside percentage. Stronger consensus and higher upside wins.
5. **Dividend** — Yield and payout sustainability. Only relevant if comparing income stocks.

For each dimension, rank all tickers from strongest to weakest. Note when stocks are effectively tied.

Identify divergences — a stock that is fundamentally strong but technically weak (or vice versa) deserves explicit commentary.

## Output Format

### Comparison: [TICKER1] vs [TICKER2] vs ...

### Side-by-Side Metrics

| Metric            | TICKER1 | TICKER2 | TICKER3 | ... |
|-------------------|---------|---------|---------|-----|
| Price             |         |         |         |     |
| Change %          |         |         |         |     |
| Market Cap        |         |         |         |     |
| P/E (TTM)         |         |         |         |     |
| EPS (TTM)         |         |         |         |     |
| Revenue Growth    |         |         |         |     |
| Dividend Yield    |         |         |         |     |
| RSI (14)          |         |         |         |     |
| TradingView Rating|         |         |         |     |
| Analyst Consensus |         |         |         |     |
| Target Upside     |         |         |         |     |

Only include columns for tickers being compared. Omit rows where data is unavailable for all tickers. Omit Dividend dimension if comparing non-income stocks.

### Dimension Rankings

| Dimension          | 1st     | 2nd     | 3rd     | ... |
|--------------------|---------|---------|---------|-----|
| Valuation          |         |         |         |     |
| Growth             |         |         |         |     |
| Technicals         |         |         |         |     |
| Analyst Sentiment  |         |         |         |     |
| Dividend           |         |         |         |     |

### Verdict

**Preferred Pick:** [TICKER]
**Reasoning:** 2-3 sentences explaining why this stock ranks highest overall. Acknowledge tradeoffs. State which type of investor (growth, value, income) benefits most from each pick.

## Limitations

Data from TradingView and Yahoo Finance is 15-minute delayed. CBOE and sentiment data is end-of-day. Verify critical levels with real-time data before executing trades.

## Common Mistakes

- Ranking purely on one dimension (e.g., lowest P/E wins) without considering growth context.
- Failing to launch all alphavantage_overview and finnhub_analyst_ratings calls in parallel — fire ALL at once.
- Omitting the dimension rankings table and jumping straight to verdict.
- Comparing a mega-cap to a small-cap without noting the size difference affects metric interpretation.
