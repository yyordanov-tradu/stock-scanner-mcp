---
name: insider-tracker
description: Analyze insider buying and selling activity for a stock, detecting cluster trades, activist filings, and pre-earnings timing patterns.
argument-hint: [TICKER]
---

# Insider Activity Tracker

## Overview

Act as a compliance and research analyst specializing in insider transaction analysis.
Retrieve insider trades, ownership filings, and price context, then synthesize a
directional insider sentiment verdict.

Announce at start: "Analyzing insider activity for [TICKER]..."

## Input

Parse `$ARGUMENTS` as a single stock ticker (e.g., AAPL, TSLA).
If `$ARGUMENTS` is empty or contains more than one token, respond with:
"Usage: /insider-tracker [TICKER] -- provide exactly one stock ticker." and STOP.

Normalize ticker to uppercase. Set `ticker` variable.

## Data Collection

### Wave 1 -- ALL calls in parallel

| Tool                        | Parameters                                      | Priority    |
|-----------------------------|------------------------------------------------ |-------------|
| `edgar_insider_trades`      | ticker=ticker, limit=20                         | REQUIRED    |
| `edgar_ownership_filings`   | ticker=ticker                                   | REQUIRED    |
| `tradingview_quote`         | tickers=[ticker]                                | REQUIRED    |
| `finnhub_earnings_calendar` | from=today, to=today+30, symbol=ticker          | ENRICHMENT  |
| `alphavantage_earnings_history` | symbol=ticker, limit=4                       | ENRICHMENT  |

If a REQUIRED tool fails, report the failure and continue with available data.
If an ENRICHMENT tool fails, silently omit that section.

## Analysis

DO NOT reproduce raw tool output. Cross-reference and synthesize:

1. **Classify trades.** Separate insider transactions into buys vs sells. Note transaction
   sizes (shares and dollar value where available).
2. **Net insider sentiment.** Count net buy vs sell transactions and net shares over the
   period. Exclude 10b5-1 planned sales from the net sell count before scoring.
   State the ratio clearly (e.g., "12 buys vs 3 sells").
3. **Cluster detection.** Flag when 3+ distinct insiders trade in the same direction
   within a 30-day window. This is a strong directional signal.
4. **Pre-earnings timing.** If earnings are within 30 days AND insiders traded recently,
   flag as potential pre-earnings positioning. Note the gap in days.
5. **Activist watch.** Check ownership filings for 13D or 13G filings. These indicate
   activist or large block positions (>5% ownership).
6. **Price cross-reference.** Compare insider trade direction with recent price trend.
   Insiders buying into weakness or selling into strength carry more weight.

Use flag accumulation for sentiment scoring:
- Net buys > net sells by 3+ transactions -> +1 bullish flag
- Cluster buying detected -> +1 bullish flag
- 13D activist filing (signals potential catalyst -- direction depends on activist thesis) -> +1 bullish flag
- Net sells > net buys by 3+ transactions -> +1 bearish flag
- Cluster selling detected -> +1 bearish flag
- C-suite (CEO/CFO/COO) selling large blocks -> +1 bearish flag

Scoring: 2+ bullish flags = INSIDER BULLISH. 2+ bearish flags = INSIDER BEARISH. Otherwise NEUTRAL.

## Output Format

### [TICKER] -- Insider Activity Report

**Price Snapshot**
Current price, 52-week range, recent trend direction (from quote data).

**Insider Trades** (table)

| Date | Insider | Title | Direction | Shares | Price |
|------|---------|-------|-----------|--------|-------|

Show up to 15 most recent. Summarize remainder if more exist.

**Net Insider Sentiment**
State: X buys vs Y sells over the period. Net shares: +/- N.

**Cluster Activity**
State whether cluster buying or selling was detected, with dates and names involved.
If none, state "No cluster activity detected."

**Activist Watch**
List any 13D/13G filings with filer name, date, and ownership percentage.
If none, state "No activist filings found."

**Earnings Proximity**
If earnings are within 30 days, state the date and flag any insider trades within
that window. If no upcoming earnings, state "No earnings within 30 days."

**Verdict**
State: INSIDER BULLISH / INSIDER BEARISH / NEUTRAL
Confidence: HIGH / MODERATE / LOW
Key observations: 2-3 bullet points explaining the verdict.

## Limitations

Data from TradingView and Yahoo Finance is 15-minute delayed. CBOE and sentiment data is end-of-day. Verify critical levels with real-time data before executing trades.

## Common Mistakes

- DO NOT list every transaction without synthesis. Summarize patterns, not rows.
- DO NOT ignore transaction size. A CEO selling 500K shares matters more than a
  director selling 1K shares.
- DO NOT treat Form 4 automatic/planned sales (10b5-1 plans) the same as discretionary
  trades. Note when sales appear to be pre-planned.
- DO NOT skip the cluster detection step. Multiple insiders moving together is the
  single strongest insider signal.
