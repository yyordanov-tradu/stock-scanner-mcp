---
name: macro-dashboard
description: Build a comprehensive macroeconomic dashboard covering rates, inflation, labor, yield curve, and market sentiment to identify the current macro regime.
---

# Macro Dashboard

## Overview

Act as a macro strategist. Collect key economic indicators, yield curve data, inflation metrics, labor market signals, and market sentiment to produce a unified macro picture. Cross-reference all data points to classify the current economic regime.

**Prerequisite:** This skill requires FRED_API_KEY to be configured. Without it, only market indices and sentiment data are available.

Announce at start: "Building macro dashboard -- collecting economic indicators, yield curve, inflation, labor, and sentiment data."

## Data Collection

### Wave 1 -- ALL calls in parallel

| Tool                       | Parameters                  | Priority    |
|----------------------------|-----------------------------|-------------|
| `fred_indicator`           | series_id=fed_funds         | REQUIRED    |
| `fred_indicator`           | series_id=cpi               | REQUIRED    |
| `fred_indicator`           | series_id=core_pce          | REQUIRED    |
| `fred_indicator`           | series_id=unemployment      | REQUIRED    |
| `fred_indicator`           | series_id=treasury_10y      | REQUIRED    |
| `fred_indicator`           | series_id=treasury_2y       | REQUIRED    |
| `fred_indicator`           | series_id=gdp (quarterly, may be 1-3 months stale) | ENRICHMENT  |
| `fred_indicator`           | series_id=initial_claims    | ENRICHMENT  |
| `fred_economic_calendar`   | limit=15                    | REQUIRED    |
| `tradingview_market_indices` | (default)                 | REQUIRED    |
| `sentiment_fear_greed`     | (default)                   | ENRICHMENT  |

DO NOT proceed to analysis until ALL REQUIRED calls return. ENRICHMENT failures are acceptable.

## Analysis

Cross-reference the collected data across five dimensions:

1. **Yield Curve** -- Compute 10Y minus 2Y spread. Flag inversion (negative spread) as recession signal. Note steepening or flattening trend.
2. **Inflation Trajectory** -- Compare CPI and Core PCE to the Fed's 2% target. Determine if inflation is accelerating, decelerating, or anchored.
3. **Labor Market Health** -- Assess unemployment rate direction and initial claims trend. Rising claims with rising unemployment = deterioration.
4. **Fed Policy Stance** -- Current Fed Funds rate vs inflation readings. Is policy restrictive (rate > inflation) or accommodative?
5. **Market Pricing of Risk** -- Extract VIX from market indices. Combine with Fear & Greed score. Elevated VIX (>25) with extreme fear = stress.

Synthesize all five dimensions into a single macro regime classification.

DO NOT reproduce raw tool output. Synthesize and interpret.

## Output Format

### Economic Dashboard

| Indicator         | Latest | Prior | Trend     |
|-------------------|--------|-------|-----------|
| Fed Funds Rate    | x.xx%  | x.xx% | STEADY / UP / DOWN |
| CPI (YoY)        | x.x%   | x.x%  | ...       |
| Core PCE (YoY)   | x.x%   | x.x%  | ...       |
| Unemployment      | x.x%   | x.x%  | ...       |
| GDP (QoQ ann.)    | x.x%   | x.x%  | ...       |
| Initial Claims    | xxxK   | xxxK  | ...       |

### Yield Curve
- 10Y Yield: x.xx% | 2Y Yield: x.xx% | Spread: +/-xx bps
- Interpretation: Normal / Flat / Inverted -- what it signals

### Inflation vs Fed Target (2%)
- CPI trajectory and distance from target
- Core PCE trajectory and distance from target
- Assessment: ABOVE TARGET / AT TARGET / BELOW TARGET

### Labor Market
- 2-3 sentence assessment of employment conditions

### Market Risk Gauges
- VIX level and interpretation
- Fear & Greed score and classification

### Upcoming Releases (Next 2 Weeks)
List the most market-moving releases from the economic calendar with dates.

### Macro Regime

**Classification:** EXPANSION / SLOWDOWN / CONTRACTION / RECOVERY

Provide 3-4 sentences of reasoning tying the data dimensions together.

## Limitations

Data from TradingView and Yahoo Finance is 15-minute delayed. CBOE and sentiment data is end-of-day. Verify critical levels with real-time data before executing trades.

## Common Mistakes

- Reporting raw JSON from tool responses instead of synthesized values
- Forgetting to compute the yield curve spread (just listing 2Y and 10Y separately)
- Classifying regime based on a single indicator instead of cross-referencing all five dimensions
- Ignoring the direction/trend of indicators and only reporting the latest snapshot value
