---
name: market-close-recap
description: Produce an end-of-day market recap covering index performance, sector rotation, notable movers, and key headlines to frame the next session.
---

# Market Close Recap

## Overview

Desk analyst closing the book. Collect final index prints, sector scores, top movers, volume anomalies, and late-day headlines in one parallel wave, then synthesize into a concise session narrative.

Announce at start: "Running market close recap -- collecting final prints, sectors, movers, and headlines."

## Data Collection

### Wave 1 (ALL calls in parallel)

| Tool | Parameters | Priority |
|------|-----------|----------|
| `tradingview_market_indices` | (defaults) | REQUIRED |
| `sentiment_fear_greed` | (defaults) | REQUIRED |
| `tradingview_sector_performance` | (defaults) | REQUIRED |
| `tradingview_top_gainers` | limit=10 | REQUIRED |
| `tradingview_top_losers` | limit=10 | REQUIRED |
| `tradingview_top_volume` | limit=10 | ENRICHMENT |
| `tradingview_volume_breakout` | limit=10 | ENRICHMENT |
| `finnhub_market_news` | limit=5 | ENRICHMENT |
| `finnhub_earnings_calendar` | from=tomorrow, to=tomorrow+2 | ENRICHMENT |

If any REQUIRED call fails, report the failure explicitly and proceed with available data. ENRICHMENT failures are silently omitted.

## Analysis

DO NOT reproduce raw tool output. Synthesize a session narrative by answering:

1. **Session driver** -- What single theme or catalyst best explains today's price action? Name it explicitly.
2. **Sector leaders and laggards** -- Identify the top 2 and bottom 2 sectors. Explain WHY they led or lagged using news, earnings, or macro context.
3. **Index divergence** -- Did the major indices move in lockstep or diverge? If NASDAQ outperformed Dow (or vice versa), note the growth-vs-value implication.
4. **Unusual volume** -- Flag names with abnormal volume that are NOT already in the gainers/losers lists. These are tomorrow's watchlist candidates.
5. **Sentiment alignment** -- Does the Fear & Greed reading match the day's action, or is there a disconnect worth noting?

## Output Format

### Day Summary

| Index | Close | Change | Change % |
|-------|-------|--------|----------|

Include S&P 500, NASDAQ Composite, Dow Jones, VIX. Add a one-sentence narrative below the table.

### Sector Scorecard

| Sector | Change % | Rank | Note |
|--------|----------|------|------|

Sort by Change % descending. Note column: brief context (e.g., "oil rally", "rate fears").

### Notable Movers

Two sub-tables (Gainers, Losers) with: Ticker, Name, Change %, Volume vs Avg, Catalyst. Limit 5 rows each. A separate "Volume Watch" list of up to 3 names with unusual volume not captured above.

### Key Headlines

Bullet list of up to 5 headlines. Each MUST include source context and market relevance in one sentence.

### Tomorrow's Setup

Structured watchlist:

- **Levels to watch:** Key S&P / NASDAQ support and resistance implied by today's action.
- **Catalysts ahead:** Any after-hours earnings or pre-market data releases for the next session.
- **Carry-over themes:** 1-2 themes from today likely to persist into tomorrow.

### Close Verdict
**Session:** RISK-ON / RISK-OFF / NEUTRAL
**Confidence:** HIGH / MEDIUM / LOW
**Tomorrow's Watch:** [key level or event]

## Limitations

Data from TradingView and Yahoo Finance is 15-minute delayed. CBOE and sentiment data is end-of-day. Verify critical levels with real-time data before executing trades.

## Common Mistakes

- Restating every gainer and loser without identifying the common thread that connects them.
- Presenting sector data without explaining what drove the leaders and laggards.
- Omitting the VIX context -- a rising VIX on a green day is a critical signal.
- Listing headlines without connecting them to observed price action.
