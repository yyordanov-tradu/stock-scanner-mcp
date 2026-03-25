---
name: dividend-screen
description: Screen for high-yield dividend stocks with sustainable payouts, or deep-dive a single ticker for income analysis.
argument-hint: [TICKER]
---

# Dividend Income Screen

## Overview

Act as an income portfolio analyst. Identify high-quality dividend stocks with sustainable yields, or analyze a single ticker for income suitability. Operates in two modes: screen (no argument) or deep-dive (ticker provided).

Announce at start: "Running dividend screen..." or "Analyzing [TICKER] for income suitability..."

## Input

Parse `$ARGUMENTS` to determine mode:
- **Empty** -- Run screen mode across the market.
- **Single ticker** -- Run deep-dive mode on that ticker.

Normalize any ticker to uppercase. Strip any leading $ character.

## Data Collection

### Screen Mode -- Wave 1 -- FIRE ALL IN PARALLEL

| Tool | Parameters | Priority |
|------|-----------|----------|
| `tradingview_scan` | filters: dividend_yield > 2, market_cap > 5B, price_earnings_ttm > 0. Columns: close, change, dividend_yield_recent, price_earnings_ttm, earnings_per_share_basic_ttm, name, description, market_cap_basic. limit=20, sort by dividend_yield desc | REQUIRED |
| `tradingview_market_indices` | (none) | ENRICHMENT |
| `fred_indicator` | series_id=DGS10 (10-Year Treasury) | ENRICHMENT |

### Deep-Dive Mode -- Wave 1 -- FIRE ALL IN PARALLEL

| Tool | Parameters | Priority |
|------|-----------|----------|
| `alphavantage_dividend_history` | symbol=ticker | ENRICHMENT |
| `alphavantage_overview` | symbols=ticker | ENRICHMENT |
| `alphavantage_earnings_history` | symbol=ticker, limit=8 | ENRICHMENT |
| `edgar_company_facts` | ticker=ticker | ENRICHMENT |
| `tradingview_technicals` | tickers=[ticker] | ENRICHMENT |

## Analysis

### Screen Mode

Rank results by yield but apply these filters to eliminate yield traps:

1. **Earnings trend** -- Remove stocks with declining EPS over the last 2+ years. A high yield from a falling stock price is a trap.
2. **Payout ratio** -- Calculate dividend per share / EPS. Remove any stock with payout ratio > 80%. It signals unsustainable dividends. Note: REITs and utilities commonly have payout ratios above 80% -- exclude them from the payout ratio filter.
3. **Positive earnings** -- The PE filter in the scan should handle this, but verify no negative-EPS stocks slipped through.
4. **Treasury comparison** -- Compare each yield to the 10-Year Treasury rate. Stocks should have a yield spread above the 10Y Treasury of at least 1.5 percentage points to justify the equity risk.

### Deep-Dive Mode

Assess dividend quality across four dimensions:

1. **Dividend growth** -- Is the dividend growing year-over-year? Calculate CAGR over available history. Flat or declining dividends are a red flag.
2. **Payout sustainability** -- Compare annual dividend to EPS for each year. A rising payout ratio trending toward 80%+ signals future cuts.
3. **Earnings coverage** -- Are earnings stable enough to support the dividend through a downturn? Look at worst-quarter EPS vs quarterly dividend.
4. **Valuation and trend** -- Is the stock in an uptrend or downtrend? A dividend stock in a downtrend may offer better entry points but also signals risk.

DO NOT reproduce raw tool output. Synthesize and rank.

## Output Format

### Screen Mode

### Treasury Benchmark
One line: current 10Y Treasury yield as the risk-free baseline.

### Dividend Stocks

| Rank | Ticker | Name | Price | Yield% | PE | Est. Payout% | vs Treasury |
|------|--------|------|-------|--------|-----|--------------|-------------|
(Max 15 rows, filtered and ranked)

### Top 5 Highlights
For each of the top 5 ranked stocks, one sentence on why it stands out (growth, stability, sector, valuation).

### Deep-Dive Mode

### Dividend History

| Year | Annual Div | Yield% | YoY Growth |
|------|-----------|--------|------------|
(Last 5 years or available history)

- **Dividend CAGR**: [X]% over [N] years

### Payout Analysis

| Year | EPS | Dividend | Payout Ratio |
|------|-----|----------|-------------|
(Last 4-5 years)

### Fundamentals Snapshot
Key metrics in a compact block: market cap, PE, forward PE, profit margin, debt/equity, sector.

### Technical Trend
One line: current trend direction and key support/resistance levels.

### Verdict: INCOME BUY / HOLD / AVOID

State the verdict with 2-3 sentences. Address:
- Yield attractiveness vs risk-free rate
- Dividend sustainability and growth trajectory
- Key risk (if any) that could threaten the dividend

## Limitations

Data from TradingView and Yahoo Finance is 15-minute delayed. CBOE and sentiment data is end-of-day. Verify critical levels with real-time data before executing trades.

## Common Mistakes

- Ranking purely by yield without checking payout sustainability. HIGH YIELD WITHOUT EARNINGS SUPPORT IS A TRAP.
- Omitting the Treasury comparison. Income investors always benchmark against risk-free alternatives.
- Presenting 20 unfiltered scan results. FILTER to quality names before presenting.
- In deep-dive mode, failing to calculate payout ratio. The ratio is the single most important metric for dividend safety.
