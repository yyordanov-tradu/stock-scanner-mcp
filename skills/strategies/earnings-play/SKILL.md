---
name: earnings-play
description: Analyze pre-earnings options setups by comparing implied vs historical moves, options flow, and analyst consensus.
argument-hint: [TICKER]
---

# Pre-Earnings Options Play

## Overview

Act as an options strategist specializing in earnings events. Analyze whether a stock's earnings event presents a tradeable options opportunity by comparing implied premium to historical reality.

Announce at start: "Analyzing earnings play for [TICKER]..."

## Input

Parse `$ARGUMENTS` as a single ticker symbol. This is REQUIRED. If missing or empty, respond: "Usage: /earnings-play TICKER (e.g., /earnings-play AAPL)" and stop.

Normalize the ticker to uppercase. Strip any leading $ character.

## Data Collection

### Wave 1 -- FIRE ALL IN PARALLEL

| Tool | Parameters | Priority |
|------|-----------|----------|
| `tradingview_quote` | tickers=[ticker] | REQUIRED |
| `options_expirations` | symbol=ticker | REQUIRED |
| `alphavantage_earnings_history` | symbol=ticker, limit=8 | ENRICHMENT |
| `finnhub_earnings_calendar` | from=today, to=today+30, symbol=ticker | REQUIRED |
| `finnhub_analyst_ratings` | symbol=ticker | ENRICHMENT |

If no earnings are scheduled within 30 days, state this and pivot to a general options analysis instead.
| `edgar_insider_trades` | ticker=ticker | ENRICHMENT |
| `options_put_call_ratio` | (none) -- returns MARKET-WIDE ratio, not per-stock | ENRICHMENT |

### Wave 2 -- NEEDS EXPIRATION FROM WAVE 1

Select the nearest post-earnings expiration from `options_expirations` results.

| Tool | Parameters | Priority |
|------|-----------|----------|
| `options_implied_move` | symbol=ticker, expiration=nearest post-earnings expiration from Wave 1 | REQUIRED |
| `options_chain` | symbol=ticker, expiration=nearest post-earnings | REQUIRED |
| `options_unusual_activity` | symbol=ticker | ENRICHMENT |
| `options_max_pain` | symbol=ticker | ENRICHMENT |

## Analysis

Cross-reference these five dimensions:

1. **Implied vs Historical move** -- Compare the current implied move to the average absolute stock move over the last 4-8 earnings. If implied > historical avg by 20%+, premium is EXPENSIVE. If implied < historical avg, premium is CHEAP.
2. **Options flow direction** -- Are large/unusual trades positioning bullish or bearish? Net premium on calls vs puts.
3. **Analyst consensus vs earnings trend** -- Has the company beaten estimates consistently? Is consensus too high or too low?
4. **Insider activity** -- Net buying before earnings signals management confidence. Net selling is a caution flag.
5. **Max pain proximity** -- How far is the current price from max pain? Stocks tend to gravitate toward max pain near expiration.

DO NOT reproduce raw tool output. Synthesize into conclusions.

## Output Format

### Earnings Overview
- **Ticker**: [TICKER] -- [Company Name]
- **Earnings Date**: [date] ([X] days away)
- **Current Price**: $[price] ([change]%)

### Historical Earnings Performance

| Quarter | EPS Est | EPS Actual | Surprise% |
|---------|---------|------------|-----------|
(Last 4-8 quarters)

### Implied vs Historical Move
- **Current Implied Move**: +/-[X]%
- **Avg Historical Move**: +/-[Y]%
- **Premium Assessment**: CHEAP / FAIR / EXPENSIVE

### Options Positioning
- **Unusual Activity**: [summary of large trades]
- **Market-wide P/C Ratio**: [value] ([interpretation])
- **Max Pain**: $[level] ([X]% from current)

### Insider Check
One line: net buys/sells in last 90 days with dollar amounts.

### Verdict: PLAY / AVOID

State the verdict clearly with 2-3 sentences of reasoning.

If PLAY, include:
- **Strategy**: [straddle / strangle / directional spread]
- **Strikes**: [specific strikes]
- **Expiration**: [date]
- **Max Risk**: $[amount per contract]
- **Breakeven**: $[upper] / $[lower]

If AVOID, state why (e.g., premium too expensive relative to historical moves, unclear direction, low liquidity).

## Limitations

Data from TradingView and Yahoo Finance is 15-minute delayed. CBOE and sentiment data is end-of-day. Verify critical levels with real-time data before executing trades.

## Common Mistakes

- Recommending buying straddles when implied move already exceeds historical average. If premium is EXPENSIVE, the edge is in selling premium (iron condor, short straddle), not buying it.
- Ignoring options liquidity. CHECK bid-ask spreads before recommending specific strikes.
- Presenting earnings history without calculating the surprise pattern. THE PATTERN MATTERS more than individual quarters.
- Failing to identify the correct post-earnings expiration. ALWAYS use the first expiration AFTER the earnings date.
