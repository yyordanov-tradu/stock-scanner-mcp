---
name: sector-rotation
description: Analyze sector performance across timeframes, detect risk-on vs risk-off rotation, and identify overweight/underweight sector picks with technical confirmation.
---

# Sector Rotation

## Overview

Act as a sector strategist. Collect sector performance data across multiple timeframes, overlay technical signals on leaders and laggards, and determine whether capital is rotating toward risk-on or risk-off sectors. Produce actionable sector allocation guidance.

Announce at start: "Running sector rotation analysis -- collecting sector performance, market indices, and technical signals."

## Data Collection

### Wave 1 -- ALL calls in parallel

| Tool                         | Parameters            | Priority    |
|------------------------------|-----------------------|-------------|
| `tradingview_sector_performance` | (default)         | REQUIRED    |
| `tradingview_market_indices`     | (default)         | REQUIRED    |
| `sentiment_fear_greed`           | (default)         | ENRICHMENT  |
| `fred_indicator`                 | series_id=treasury_10y | ENRICHMENT |

### Wave 2 -- After Wave 1 completes

Rank sectors by 1-week performance for rotation analysis. Identify the top 3 and bottom 3 sectors by this ranking. Call technicals for their ETFs.

| Tool                    | Parameters                          | Priority   |
|-------------------------|-------------------------------------|------------|
| `tradingview_technicals` | tickers=[top 3 + bottom 3 sector ETFs] | REQUIRED |

Standard sector ETF mapping: XLK (Technology), XLF (Financials), XLV (Health Care), XLY (Consumer Discretionary), XLP (Consumer Staples), XLE (Energy), XLI (Industrials), XLRE (Real Estate), XLU (Utilities), XLB (Materials), XLC (Communication Services).

DO NOT proceed to analysis until ALL REQUIRED calls return. ENRICHMENT failures are acceptable.

## Analysis

Cross-reference the collected data across four dimensions:

1. **Timeframe Divergence** -- Compare 1-day vs 1-week vs 1-month vs YTD performance for each sector. Short-term moves diverging from longer-term trends signal emerging rotation.
2. **Risk Appetite** -- Defensive sectors (XLU, XLP, XLV) outperforming cyclicals (XLY, XLI, XLF) = RISK-OFF. Cyclicals outperforming defensives = RISK-ON. Mixed leadership = no clear signal.
3. **Rate Sensitivity** -- Compare rate-sensitive sectors (XLU, XLRE) performance to 10Y yield direction. Rising yields should pressure these sectors. Outperformance despite rising yields is a strong signal.
4. **Technical Confirmation** -- Use RSI and trend data from Wave 2 to confirm or contradict the rotation signal. Overbought leaders (RSI >70) may reverse. Oversold laggards (RSI <30) may bounce.

Note that broad market direction context matters -- sector rotation signals are most actionable when the overall market trend is clear. In a choppy, trendless market, rotation signals may be noise.

DO NOT reproduce raw tool output. Synthesize and interpret.

## Output Format

### Sector Performance

| Sector               | ETF  | 1D     | 1W     | 1M     | 3M     | YTD    |
|----------------------|------|--------|--------|--------|--------|--------|
| Technology           | XLK  | +x.x%  | +x.x%  | ...    | ...    | ...    |
| Financials           | XLF  | ...    | ...    | ...    | ...    | ...    |
| (all 11 GICS sectors) |    |        |        |        |        |        |

### Technical Status -- Leaders and Laggards

| Sector | ETF | RSI(14) | Trend  | Signal     |
|--------|-----|---------|--------|------------|
| (top 3 and bottom 3 sectors from performance ranking) |

### Rotation Signal

**Classification:** RISK-ON / RISK-OFF / MIXED

3-4 sentences explaining the rotation pattern. Reference specific sector pairs (cyclical vs defensive) and timeframe divergences that support the classification.

### Rate Sensitivity
Note how rate-sensitive sectors (XLU, XLRE) are behaving relative to the current 10Y yield direction. Flag any divergence.

### Sector Picks

**Overweight (top 2):**
- SECTOR (ETF) -- 2-sentence reasoning citing performance trend + technical confirmation

**Underweight (top 2):**
- SECTOR (ETF) -- 2-sentence reasoning citing performance trend + technical confirmation

## Limitations

Data from TradingView and Yahoo Finance is 15-minute delayed. CBOE and sentiment data is end-of-day. Verify critical levels with real-time data before executing trades.

## Common Mistakes

- Ranking sectors by a single timeframe (e.g., 1-day) instead of analyzing rotation across multiple timeframes
- Classifying rotation signal without comparing defensive vs cyclical sector groups explicitly
- Skipping Wave 2 technicals and making sector picks without RSI or trend confirmation
- Ignoring interest rate direction when assessing rate-sensitive sectors like Utilities and Real Estate
