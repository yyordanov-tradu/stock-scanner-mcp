---
name: smart-money
description: Track institutional holdings, options flow, short interest, and analyst ratings to determine whether big players are bullish or bearish on a stock.
argument-hint: [TICKER]
---

# Smart Money Flow Tracker

## Overview

Act as an institutional flow analyst who reads the positioning of hedge funds,
mutual funds, and options desks. Combine institutional holdings, short interest,
analyst consensus, and unusual options activity into a single directional read.

Announce at start: "Tracking smart money flow for [TICKER]..."

## Input

Parse `$ARGUMENTS` as a single stock ticker (e.g., AAPL, TSLA).
If `$ARGUMENTS` is empty or contains more than one token, respond with:
"Usage: /smart-money [TICKER] -- provide exactly one stock ticker." and STOP.

Normalize ticker to uppercase. Set `ticker` variable.

## Data Collection

### Wave 1 -- ALL calls in parallel

| Tool                          | Parameters                  | Priority    |
|-------------------------------|-----------------------------|-------------|
| `edgar_institutional_holdings`| query=ticker                | REQUIRED    |
| `options_unusual_activity`    | symbol=ticker               | REQUIRED    |
| `finnhub_short_interest`      | symbol=ticker               | REQUIRED    |
| `finnhub_analyst_ratings`     | symbol=ticker               | REQUIRED    |
| `tradingview_quote`           | tickers=[ticker]            | ENRICHMENT  |
| `options_put_call_ratio`      | (none) -- returns MARKET-WIDE ratio only, not per-stock | ENRICHMENT  |

If a REQUIRED tool fails, report the failure and continue with available data.
If an ENRICHMENT tool fails, silently omit that section.

## Analysis

DO NOT reproduce raw tool output. Cross-reference across data sources:

1. **Institutional trend.** Are institutions increasing or decreasing positions?
   Note any notable names (Berkshire, Vanguard, BlackRock) and direction.
2. **Short interest signal.** Calculate short interest as % of float and days to
   cover. Above 15% is elevated; above 25% is extreme. Note the trend (rising
   or falling).
3. **Analyst consensus math.** Tally Strong Buy / Buy / Hold / Sell / Strong Sell.
   Compute weighted score: (5*SB + 4*B + 3*H + 2*S + 1*SS) / total. Scale:
   4.0+ = Strong Buy consensus, 3.0-3.9 = Buy lean, 2.0-2.9 = Hold, <2.0 = Sell.
4. **Options flow direction.** From unusual activity, classify dominant flow as
   call-heavy (bullish), put-heavy (bearish), or mixed. Note large single trades
   (>$500K premium) and whether they were bought or sold.
5. **Market-wide put/call as sentiment context.** Use the market-wide put/call ratio
   as broad sentiment context for interpreting the stock's options flow. A low market P/C
   suggests broad bullishness; a high P/C suggests broad hedging.

Cross-reference checks:
- Institutions buying + calls dominating + low short interest = ALIGNED BULLISH
- Institutions selling + puts dominating + rising short interest = ALIGNED BEARISH
- Mixed signals across sources = DIVIDED (state which sources disagree)

## Output Format

### [TICKER] -- Smart Money Report

**Price Snapshot**
Current price, change, volume vs average (from quote data if available).

**Institutional Holdings**
Top 5 holders by position size. Note any visible quarter-over-quarter changes
(increased/decreased/new/exited). Summarize net institutional direction.

**Short Interest**

| Metric          | Value   |
|-----------------|---------|
| Short % Float   | X%      |
| Days to Cover   | X       |
| Trend           | Rising/Falling/Stable |

**Analyst Consensus**

| Rating      | Count |
|-------------|-------|
| Strong Buy  | X     |
| Buy         | X     |
| Hold        | X     |
| Sell        | X     |
| Strong Sell | X     |
| **Score**   | X.X/5 |

**Options Flow**
Summarize unusual activity: number of flagged trades, dominant direction (calls vs
puts), largest single trade, and whether flow leans bullish or bearish.

**Market Put/Call Context**
State current market-wide put/call ratio and how this stock's flow compares.

**Verdict**
State: SMART MONEY BULLISH / SMART MONEY BEARISH / SMART MONEY DIVIDED
Confidence: HIGH / MODERATE / LOW
Summary: 2-3 bullet points stating which data sources agree or conflict.

## Limitations

Data from TradingView and Yahoo Finance is 15-minute delayed. CBOE and sentiment data is end-of-day. Verify critical levels with real-time data before executing trades.

## Common Mistakes

- DO NOT treat analyst ratings as smart money. They are one input, not the verdict.
  Institutional flows and options positioning carry more weight.
- DO NOT ignore short interest trend direction. A stock at 15% short but declining
  is very different from 15% short and rising.
- DO NOT report options flow without distinguishing bought vs sold. A large put
  SOLD is a bullish bet (collecting premium), not bearish.
- DO NOT present each data source in isolation. The entire value of this skill is
  the cross-reference. Always state agreement or divergence explicitly.
