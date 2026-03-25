---
name: analyze-stock
description: Run a full equity deep dive — fundamentals, technicals, insider activity, news catalysts — and deliver an actionable verdict with levels.
argument-hint: [TICKER]
---

# Analyze Stock

## Overview

Perform a comprehensive equity research analysis on a single stock. Combine fundamental data, technical signals, insider activity, analyst ratings, and recent news into a unified investment thesis.

Announce at start: "Running full analysis on [TICKER] — collecting fundamentals, technicals, insider data, and catalysts..."

## Input

Parse `$ARGUMENTS` as a single ticker symbol. If empty or missing, respond with:
"Usage: /analyze-stock TICKER" and STOP. Do not proceed without a ticker.

Normalize the ticker to UPPERCASE. Strip any whitespace or leading dollar signs.

## Data Collection

### Wave 1 — ALL calls in parallel

| Tool                          | Parameters                                      | Priority    |
|-------------------------------|------------------------------------------------|-------------|
| tradingview_quote             | tickers=[TICKER]                               | REQUIRED    |
| tradingview_technicals        | tickers=[TICKER]                               | REQUIRED    |
| alphavantage_overview         | symbols=TICKER                                 | ENRICHMENT  |
| finnhub_analyst_ratings       | symbol=TICKER                                  | ENRICHMENT  |
| finnhub_company_news          | symbol=TICKER, from=30 days ago, to=today      | ENRICHMENT  |
| edgar_insider_trades          | ticker=TICKER                                  | ENRICHMENT  |
| edgar_institutional_holdings  | query=TICKER                                   | ENRICHMENT  |
| alphavantage_earnings_history | symbol=TICKER, limit=4                         | ENRICHMENT  |
| finnhub_company_profile       | symbol=TICKER                                  | ENRICHMENT  |
| alphavantage_dividend_history | symbol=TICKER                                  | ENRICHMENT  |
| finnhub_short_interest        | symbol=TICKER                                  | ENRICHMENT  |

If a REQUIRED tool fails, report the gap and continue with available data. If an ENRICHMENT tool fails, continue without it and note the gap.

## Analysis

DO NOT reproduce raw tool output. Synthesize across all data sources.

Cross-reference in this order:

1. **Price action vs analyst consensus** — Do technicals agree with the fundamental view? Flag divergences (e.g., strong buy ratings but bearish chart breakdown).
2. **Insider behavior vs price trend** — Are insiders buying on weakness or selling into strength? Quantify net insider flow over the last 90 days.
3. **Earnings trajectory vs P/E** — Is the current valuation justified by EPS growth? Compare trailing P/E to forward P/E if available.
4. **News sentiment vs technical direction** — Are recent catalysts aligned with the trend or contradicting it?

Weight REQUIRED data heavily. Use ENRICHMENT data to confirm or challenge the primary thesis. If signals conflict, say so explicitly and lower confidence.

## Output Format

### [TICKER] — [Company Name]

**[Price] | [Change %] | Vol: [Volume] | MCap: [Market Cap]**

### Company Profile
One-line business description from the company profile data.

### Fundamentals

| Metric           | Value   |
|------------------|---------|
| P/E (TTM)        |         |
| Forward P/E      |         |
| EPS (TTM)        |         |
| Revenue (TTM)    |         |
| Dividend Yield   |         |
| Analyst Target   |         |
| Target Upside    |         |

### Technical Snapshot

| Indicator         | Value   | Signal       |
|-------------------|---------|--------------|
| RSI (14)          |         |              |
| MACD              |         |              |
| SMA 20            |         |              |
| SMA 50            |         |              |
| SMA 200           |         |              |
| TradingView Rating|         |              |

### Insider Activity
Summarize net insider buying/selling over 90 days. Note largest transactions by name and role.

### Catalyst Check
List 2-3 material news items and the next earnings date if known.

### Verdict

**Direction:** BULLISH / BEARISH / NEUTRAL
**Confidence:** HIGH / MEDIUM / LOW
**Support:** [level]
**Resistance:** [level]
**Key Risk:** One sentence describing the primary downside scenario.

## Limitations

Data from TradingView and Yahoo Finance is 15-minute delayed. CBOE and sentiment data is end-of-day. Verify critical levels with real-time data before executing trades.

## Common Mistakes

- Presenting raw JSON from tools instead of synthesized narrative.
- Ignoring conflicting signals — if technicals say sell but analysts say buy, DO NOT hide the disagreement. State it and adjust confidence.
- Omitting the verdict section or leaving levels blank.
- Calling tools sequentially instead of in parallel — ALL Wave 1 calls MUST be parallel.
