---
name: fed-watch
description: Analyze Fed rate policy using 12-month inflation trends, employment data, yield curve signals, and market stress to forecast the next likely Fed move.
---

# Fed Watch

## Overview

Act as a rates strategist. Collect current and historical inflation data, employment indicators, yield curve levels, and market stress signals to assess the Fed's likely policy direction. Focus on what the data tells us about the next move.

**Prerequisite:** This skill requires FRED_API_KEY to be configured. Without it, only market indices and sentiment data are available.

Announce at start: "Running Fed Watch -- collecting rate history, inflation trends, employment data, and market stress indicators."

## Data Collection

### Wave 1 -- ALL calls in parallel

| Tool                        | Parameters                                                  | Priority    |
|-----------------------------|-------------------------------------------------------------|-------------|
| `fred_indicator`            | series_id=fed_funds                                         | REQUIRED    |
| `fred_indicator_history`    | series_id=fed_funds, start=12 months ago, end=today         | REQUIRED    |
| `fred_indicator_history`    | series_id=cpi, start=12 months ago, end=today, units=pc1    | REQUIRED    |
| `fred_indicator_history`    | series_id=core_pce, start=12 months ago, end=today, units=pc1 | REQUIRED |
| `fred_indicator`            | series_id=unemployment                                      | REQUIRED    |
| `fred_indicator`            | series_id=initial_claims                                    | ENRICHMENT  |
| `fred_indicator`            | series_id=treasury_2y                                       | REQUIRED    |
| `fred_indicator`            | series_id=treasury_10y                                      | REQUIRED    |
| `fred_indicator`            | series_id=nonfarm_payrolls (NFP data may be 2-4 weeks old)  | ENRICHMENT  |
| `tradingview_market_indices` | (default)                                                  | REQUIRED    |
| `fred_economic_calendar`    | limit=10                                                    | ENRICHMENT  |

DO NOT proceed to analysis until ALL REQUIRED calls return. ENRICHMENT failures are acceptable.

## Analysis

Cross-reference the collected data across four dimensions:

1. **Inflation Trend** -- Plot CPI and Core PCE over the 12-month history. Is inflation decelerating toward the 2% target, stalling, or re-accelerating? Identify the 3-month trend vs the 12-month trend.
2. **Employment Strength** -- Unemployment rate level and direction. Initial claims trend. Nonfarm payrolls momentum. A strong labor market gives the Fed room to stay restrictive.
3. **Yield Curve Signal** -- Compute 10Y minus 2Y spread. Compare 2Y yield to current Fed Funds rate. If 2Y < Fed Funds, the market is pricing cuts. If 2Y > Fed Funds, the market expects hikes or prolonged hold.
4. **Market Stress** -- Extract VIX from market indices. VIX above 30 signals acute stress that may force the Fed's hand regardless of inflation.

Determine whether the weight of evidence points to the Fed's next move being a hike, cut, or extended hold.

DO NOT reproduce raw tool output. Synthesize and interpret.

## Output Format

### Rate Snapshot

| Metric            | Value   |
|-------------------|---------|
| Fed Funds Rate    | x.xx%   |
| Last Change       | +/-xx bps on YYYY-MM-DD |
| 2Y Treasury       | x.xx%   |
| 10Y Treasury      | x.xx%   |
| 2Y-10Y Spread     | +/-xx bps |
| 2Y vs Fed Funds   | +/-xx bps (market pricing signal) |

### Inflation Trend (12-Month)

| Month   | CPI (YoY%) | Core PCE (YoY%) |
|---------|-----------|-----------------|
| (show 4-6 data points spanning the 12 months to illustrate the trajectory) |

- Trajectory assessment: Decelerating / Stalling / Re-accelerating
- Distance from 2% target

### Employment Picture
- Unemployment rate and direction
- Nonfarm payrolls trend (if available)
- Initial claims trend (if available)
- 2-3 sentence assessment

### Market Stress
- VIX level and interpretation (low <15, moderate 15-25, elevated 25-30, acute >30)
- Whether stress level constrains Fed options

### Upcoming Fed-Relevant Data
List releases from the economic calendar that directly influence Fed decisions (CPI, PCE, NFP, GDP, FOMC).

### Fed Outlook

**Stance:** HAWKISH / DOVISH / ON HOLD

**Confidence:** HIGH / MODERATE / LOW

Provide 3-5 sentences of reasoning. State what conditions would change the outlook. Note any divergence between what the data suggests and what the market is pricing.

## Limitations

Data from TradingView and Yahoo Finance is 15-minute delayed. CBOE and sentiment data is end-of-day. Verify critical levels with real-time data before executing trades.

## Common Mistakes

- Treating CPI and Core PCE as interchangeable -- the Fed watches Core PCE as its preferred gauge
- Ignoring the gap between 2Y yield and Fed Funds rate, which reveals market expectations
- Stating a Fed outlook without explaining what data would change it
- Presenting inflation history as a flat list instead of identifying the trend direction
