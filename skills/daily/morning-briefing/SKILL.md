---
name: morning-briefing
description: Run a pre-market scan across indices, sectors, sentiment, and upcoming catalysts to produce a structured morning briefing with directional bias.
---

# Morning Briefing

## Overview

Institutional pre-market desk analyst briefing. Collect broad market indices, sector performance, sentiment, top movers, and upcoming catalysts in a single parallel wave, then cross-reference to produce a directional bias.

Announce at start: "Running pre-market briefing -- collecting indices, sectors, sentiment, movers, and catalysts."

## Data Collection

### Wave 1 (ALL calls in parallel)

| Tool | Parameters | Priority |
|------|-----------|----------|
| `tradingview_market_indices` | (defaults) | REQUIRED |
| `sentiment_fear_greed` | (defaults) | REQUIRED |
| `finnhub_market_status` | (defaults) | REQUIRED |
| `tradingview_sector_performance` | (defaults) | REQUIRED |
| `tradingview_top_gainers` | limit=10 | ENRICHMENT |
| `tradingview_top_losers` | limit=10 | ENRICHMENT |
| `tradingview_volume_breakout` | limit=10 | ENRICHMENT |
| `finnhub_market_news` | limit=5 | ENRICHMENT |
| `finnhub_earnings_calendar` | from=today, to=today+5 | ENRICHMENT |
| `fred_economic_calendar` | limit=10 | ENRICHMENT  |

If any REQUIRED call fails, report the failure explicitly and proceed with available data. ENRICHMENT failures are silently omitted.

## Analysis

DO NOT reproduce raw tool output. Cross-reference the collected data to answer:

1. **Risk appetite agreement** -- Do index levels/futures direction and the Fear & Greed score point the same way? Flag any divergence as a caution signal.
2. **Sector divergence** -- Which sectors diverge from the broad market direction? A defensive sector leading in a risk-on tape (or vice versa) is notable.
3. **Volume clustering** -- Do volume breakout names cluster in one or two sectors? Flag as a potential rotation signal and name the sectors.
4. **Catalyst check** -- Are any earnings or economic releases in the next 5 days likely to move the broad market or a specific sector? Highlight date, event, and expected impact.

## Output Format

### Market Pulse

| Index | Last | Change | Change % |
|-------|------|--------|----------|

Include VIX, S&P 500, NASDAQ Composite, Dow Jones. Note market session status (pre-market / regular / after-hours).

### Fear & Greed

Single line: score, label (Extreme Fear / Fear / Neutral / Greed / Extreme Greed), and one-week trend direction.

### Sector Map

| Sector | Change % | Signal |
|--------|----------|--------|

Sort by Change % descending. Signal column: "Leading", "Lagging", or "Inline".

### Top Movers

Three sub-tables (Gainers, Losers, Volume Breakouts) each with: Ticker, Name, Change %, Volume context. Limit 5 rows per table.

### Week Ahead

Bullet list of upcoming earnings and economic events that MUST include date and expected impact magnitude (high / medium / low).

### Bias

Present a single structured verdict:

- **Direction:** RISK-ON | RISK-OFF | NEUTRAL
- **Confidence:** HIGH | MEDIUM | LOW
- **Key risk:** One sentence identifying the biggest threat to the bias.

## Limitations

Data from TradingView and Yahoo Finance is 15-minute delayed. CBOE and sentiment data is end-of-day. Verify critical levels with real-time data before executing trades.

## Common Mistakes

- Dumping raw JSON or full tool responses instead of synthesized tables.
- Ignoring divergences between sentiment score and index direction -- these are the most valuable signals.
- Listing movers without connecting them to sector rotation or catalysts.
- Stating a bias without citing the supporting data points that justify it.
