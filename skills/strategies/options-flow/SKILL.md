---
name: options-flow
description: Track smart money options positioning by analyzing unusual activity, put/call skew, max pain, and implied moves.
argument-hint: [TICKER]
---

# Smart Money Options Flow

## Overview

Act as an options flow analyst tracking institutional positioning. Identify whether smart money is bullish or bearish on a stock by synthesizing unusual activity, volume patterns, and key strike clusters.

Announce at start: "Tracking options flow for [TICKER]..."

## Input

Parse `$ARGUMENTS` as a single ticker symbol. This is REQUIRED. If missing or empty, respond: "Usage: /options-flow TICKER (e.g., /options-flow AAPL)" and stop.

Normalize the ticker to uppercase. Strip any leading $ character.

## Data Collection

### Wave 1 -- FIRE ALL IN PARALLEL

| Tool | Parameters | Priority |
|------|-----------|----------|
| `tradingview_quote` | tickers=[ticker] | REQUIRED |
| `options_expirations` | symbol=ticker | REQUIRED |
| `options_unusual_activity` | symbol=ticker | REQUIRED |
| `options_put_call_ratio` | (none) -- returns MARKET-WIDE ratio only, not per-stock | ENRICHMENT |
| `tradingview_technicals` | tickers=[ticker] | ENRICHMENT |

### Wave 2 -- NEEDS EXPIRATION FROM WAVE 1

Use the nearest monthly expiration from `options_expirations`.

| Tool | Parameters | Priority |
|------|-----------|----------|
| `options_chain` | symbol=ticker, expiration=nearest monthly | REQUIRED |
| `options_max_pain` | symbol=ticker | ENRICHMENT |
| `options_implied_move` | symbol=ticker | ENRICHMENT |

## Analysis

Synthesize flow data across four dimensions:

1. **Unusual activity signals** -- Contracts with volume/OI ratio > 3x suggest new positioning. Separate opening trades (bullish calls, bearish puts) from closing trades. Large block trades carry more weight than scattered retail flow.
2. **Strike clustering** -- Where are the heaviest open interest strikes? These act as magnets and barriers. Compare to current price and technical levels.
3. **Market-wide put/call context** -- Use the market-wide put/call ratio as broad sentiment context. A low market-wide P/C (< 0.7) suggests broad bullishness; a high P/C (> 1.0) suggests broad hedging. Interpret the stock's unusual activity flow against this backdrop.
4. **Max pain and implied move** -- Max pain is the price where most options expire worthless. The implied move defines the expected range. Identify whether flow is positioned inside or outside this range.

If no unusual activity is found, state this explicitly and weight technicals and market-wide P/C higher in the verdict.

DO NOT reproduce raw tool output. Distill into actionable intelligence.

## Output Format

### Price Snapshot
- **Ticker**: [TICKER] -- [Company Name]
- **Price**: $[price] ([change]%)
- **Technical Bias**: [Bullish / Bearish / Neutral] based on MAs and oscillators

### Unusual Activity

| Type (Call/Put) | Strike | Expiry | Volume | OI | Vol/OI | Premium |
|-----------------|--------|--------|--------|----|--------|---------|
(Top contracts ranked by volume, max 8 rows)

### Flow Summary
- **Net Positioning**: [Bullish / Bearish] -- [X] bullish contracts vs [Y] bearish
- **Dominant Expiry**: [date] -- what timeframe is smart money targeting?
- **Key Strike Clusters**: $[strike1], $[strike2] -- these levels will act as magnets

### Structure
- **Max Pain**: $[level] ([X]% from current)
- **Implied Move**: +/-[X]% by [expiry]
- **Current IV**: [value] (no historical IV comparison available)

### Market Context
- **Market-wide P/C**: [value] ([interpretation])

### Verdict: BULLISH FLOW / BEARISH FLOW / MIXED

State the verdict with confidence level (HIGH / MODERATE / LOW) and 2-3 sentences of reasoning. Include:
- **Key Levels to Watch**: $[support] / $[resistance] based on flow
- **Timeframe**: [near-term / intermediate] based on dominant expiry

## Limitations

Data from TradingView and Yahoo Finance is 15-minute delayed. CBOE and sentiment data is end-of-day. Verify critical levels with real-time data before executing trades.

## Common Mistakes

- Treating all volume as directional. High volume on a strike could be closing, hedging, or spreading. LOOK AT VOL/OI RATIO to distinguish new vs existing positions.
- Ignoring the market-wide put/call ratio. A stock's flow only makes sense in context of broad market positioning.
- Presenting max pain as a price target. Max pain is a gravitational reference, not a prediction. State it as context only.
- Conflating implied volatility level with direction. High IV means large expected move, not bullish or bearish.
