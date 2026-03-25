---
name: risk-check
description: Run a pre-trade risk assessment scoring volatility, technicals, short interest, earnings proximity, and market regime into a 0-8 risk flag system.
argument-hint: [TICKER]
---

# Pre-Trade Risk Check

## Overview

Act as a risk manager performing a pre-trade assessment. Collect market regime,
technicals, volatility, and event risk data, then score the trade on an 8-flag
risk system. Deliver a clear go/no-go with position sizing guidance.

Announce at start: "Running risk check for [TICKER]..."

## Input

Parse `$ARGUMENTS` as a single stock ticker (e.g., AAPL, TSLA).
If `$ARGUMENTS` is empty or contains more than one token, respond with:
"Usage: /risk-check [TICKER] -- provide exactly one stock ticker." and STOP.

Normalize ticker to uppercase. Set `ticker` variable.

## Data Collection

### Wave 1 -- ALL calls in parallel

| Tool                          | Parameters                                  | Priority    |
|-------------------------------|---------------------------------------------|-------------|
| `tradingview_market_indices`  |                                             | REQUIRED    |
| `tradingview_quote`           | tickers=[ticker]                            | REQUIRED    |
| `tradingview_technicals`      | tickers=[ticker]                            | REQUIRED    |
| `options_implied_move`        | symbol=ticker                               | REQUIRED    |
| `finnhub_short_interest`      | symbol=ticker                               | REQUIRED    |
| `finnhub_earnings_calendar`   | from=today, to=today+14, symbol=ticker      | REQUIRED    |
| `tradingview_sector_performance` |                                           | ENRICHMENT  |
| `sentiment_fear_greed`        |                                             | ENRICHMENT  |
| `options_max_pain`            | symbol=ticker                               | ENRICHMENT  |

If a REQUIRED tool fails, report the failure and score that flag as UNKNOWN.
If an ENRICHMENT tool fails, silently omit that section.

## Analysis

DO NOT reproduce raw tool output. Use FLAG ACCUMULATION -- check each condition
independently. Do NOT use nested if/else logic.

Initialize `risk_flags = 0`. Check each condition:

| # | Condition                          | Threshold              | Flag |
|---|-------------------------------------|------------------------|------|
| 1 | VIX level                          | VIX > 25               | +1   |
| 2 | Market fear/greed index            | Score < 25 (Ext. Fear) | +1   |
| 3 | Stock RSI extreme                  | RSI > 70 OR RSI < 30   | +1   |
| 4 | Short interest elevated            | Short % float > 15%    | +1   |
| 5 | Earnings event risk                | Earnings within 14 days| +1   |
| 6 | High implied volatility            | Implied move > 5% (note: this threshold works best for large-cap stocks; mid/small-caps normally have higher implied moves) | +1   |
| 7 | Price below long-term trend        | Below 200-day SMA      | +1   |
| 8 | Sector weakness                    | Sector in bottom 3     | +1   |

Scoring:
- 0-1 flags: **LOW RISK** -- green light, full position size acceptable
- 2-3 flags: **MODERATE RISK** -- proceed with caution, reduce to 50-75% size
- 4-5 flags: **HIGH RISK** -- reduce to 25-50% size, use tight stops
- 6+ flags: **EXTREME RISK** -- consider avoiding entirely or hedge the position

After scoring, derive key levels:
- Support: nearest technical support from technicals data
- Resistance: nearest technical resistance from technicals data
- Max pain: options max pain strike (if available)
- Suggested stop: below nearest support level, or 2-3% below entry for a standard risk tolerance

## Output Format

### [TICKER] -- Pre-Trade Risk Assessment

**Price + Technical Snapshot**
Current price, change, RSI, SMA-20, SMA-50, SMA-200, overall technical signal
(buy/sell/neutral).

**Risk Flag Checklist**

| # | Risk Factor           | Status | Value          |
|---|-----------------------|--------|----------------|
| 1 | VIX                   | PASS/FAIL | VIX = X.X   |
| 2 | Fear & Greed          | PASS/FAIL | Score = X    |
| 3 | RSI Extreme           | PASS/FAIL | RSI = X.X    |
| 4 | Short Interest        | PASS/FAIL | X% of float  |
| 5 | Earnings Proximity    | PASS/FAIL | Date or None |
| 6 | Implied Move          | PASS/FAIL | X.X%         |
| 7 | Below 200-SMA         | PASS/FAIL | Price vs SMA |
| 8 | Sector Weakness       | PASS/FAIL | Sector rank  |

PASS = flag NOT triggered (favorable). FAIL = flag triggered (risk present).

**Risk Score: X / 8 flags -- [LEVEL]**

**Market Context**
VIX level and trend, Fear & Greed index value and label, broad market direction.

**Sector Context**
Stock's sector, sector rank today, top and bottom 3 sectors.

**Key Levels**

| Level       | Price  |
|-------------|--------|
| Resistance  | $X.XX  |
| Current     | $X.XX  |
| Support     | $X.XX  |
| Max Pain    | $X.XX  |
| Stop-Loss   | $X.XX  |

**Verdict**
State risk level: LOW RISK / MODERATE RISK / HIGH RISK / EXTREME RISK.
Position sizing guidance: specific percentage of normal size.
Stop-loss recommendation: specific price level with rationale.
1-2 sentences on the dominant risk factor if score is 3+.

## Limitations

Data from TradingView and Yahoo Finance is 15-minute delayed. CBOE and sentiment data is end-of-day. Verify critical levels with real-time data before executing trades.

## Common Mistakes

- DO NOT use nested if/else for scoring. Check each flag independently and sum.
  This prevents logic errors where one condition masks another.
- DO NOT skip the earnings check. Earnings within 14 days is the single most
  common source of unexpected loss for new positions.
- DO NOT report PASS/FAIL without showing the actual value. The trader needs to
  see VIX=23.5 (PASS), not just PASS.
- DO NOT give position sizing advice without referencing the flag count. Every
  sizing recommendation MUST tie back to the risk score.
