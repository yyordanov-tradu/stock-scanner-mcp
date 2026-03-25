---
name: crypto-briefing
description: Scan crypto markets for BTC/ETH/SOL prices, sentiment, dominance, trending coins, and top movers to produce a structured briefing with directional bias.
---

# Crypto Briefing

## Overview

Crypto desk analyst briefing. Collect major coin prices, crypto-specific sentiment, global market metrics, trending coins, and top movers in a single parallel wave, then cross-reference for dominance shifts and rotation signals.

Announce at start: "Running crypto briefing -- collecting prices, sentiment, dominance, trending, and movers."

## Data Collection

### Wave 1 (ALL calls in parallel)

| Tool | Parameters | Priority |
|------|-----------|----------|
| `crypto_quote` | symbols=["BTCUSDT","ETHUSDT","SOLUSDT"] | REQUIRED |
| `sentiment_crypto_fear_greed` | (defaults) | REQUIRED |
| `coingecko_global` | (defaults) | REQUIRED |
| `coingecko_trending` | (defaults) | ENRICHMENT |
| `crypto_top_gainers` | limit=10 | ENRICHMENT |
| `crypto_technicals` | symbols=["BTCUSDT","ETHUSDT","SOLUSDT"] | ENRICHMENT |

If any REQUIRED call fails, report the failure explicitly and proceed with available data. ENRICHMENT failures are silently omitted.

## Analysis

DO NOT reproduce raw tool output. Cross-reference the collected data to answer:

1. **BTC dominance trend** -- Is BTC dominance rising or falling per `coingecko_global`? Rising dominance with falling alts signals risk-off rotation. Falling dominance with strong alts signals alt season conditions.
2. **Sentiment vs price action** -- Does the Crypto Fear & Greed score align with BTC's recent move? Extreme Fear with price stabilization is a contrarian bullish signal. Extreme Greed with stalling momentum is a caution signal.
3. **Altcoin rotation** -- Do the top gainers cluster in a specific narrative (L1s, DeFi, meme, AI)? Name the narrative and assess whether it has follow-through potential.
4. **Technical posture** -- If technicals data is available, summarize BTC and ETH as bullish / neutral / bearish based on oscillator and moving average consensus. Flag any disagreement between oscillators and MAs.

## Output Format

### Market Pulse

| Coin | Price | 24h Change % | 24h Volume |
|------|-------|-------------|------------|

Include BTC, ETH, SOL. Add total crypto market cap from global data below the table.

### Sentiment and Dominance

- **Crypto Fear & Greed:** Score, label (Extreme Fear / Fear / Neutral / Greed / Extreme Greed)
- **BTC Dominance:** Percentage and directional note (rising / stable / falling)
- **ETH/BTC Ratio:** Derive from quotes if available, note trend direction

### Top Movers

Single table: Ticker, Name, 24h Change %, Volume context. Limit 7 rows. Flag any narrative cluster in a note below the table.

### Trending

Bullet list of trending coins from CoinGecko. Each entry MUST include market cap rank and a one-phrase reason for trending (new listing, partnership, social momentum, etc.).

### Technical Snapshot

| Coin | Oscillators | Moving Averages | Overall |
|------|-------------|-----------------|---------|

Present BTC and ETH only. Each cell: Buy / Neutral / Sell. If technicals data is unavailable, omit this section entirely.

### Bias

Present a single structured verdict:

- **Direction:** BULLISH | BEARISH | NEUTRAL
- **Confidence:** HIGH | MEDIUM | LOW
- **Key risk:** One sentence identifying the biggest threat to the bias.

## Limitations

Data from TradingView and Yahoo Finance is 15-minute delayed. CBOE and sentiment data is end-of-day. Verify critical levels with real-time data before executing trades.

## Common Mistakes

- Ignoring BTC dominance -- it is the single most important context for interpreting altcoin moves.
- Treating Crypto Fear & Greed as a directional signal instead of a contrarian indicator at extremes.
- Listing trending coins without explaining why they are trending or their relevance.
- Presenting technical signals without noting when oscillators and moving averages disagree.
