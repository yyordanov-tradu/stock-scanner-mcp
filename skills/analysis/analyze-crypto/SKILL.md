---
name: analyze-crypto
description: Run a full crypto deep dive — price action, market data, technicals, and market sentiment — and deliver an actionable verdict with levels.
argument-hint: [COIN]
---

# Analyze Crypto

## Overview

Perform a comprehensive crypto research analysis on a single coin or token. Combine price data, CoinGecko fundamentals, technical signals, and market-wide sentiment into a unified thesis.

Announce at start: "Running full crypto analysis on [COIN] — collecting price data, market data, technicals, and sentiment..."

## Input

Parse `$ARGUMENTS` as a single coin identifier. If empty or missing, respond with:
"Usage: /analyze-crypto COIN (e.g., bitcoin, BTCUSDT, ethereum)" and STOP.

**Primary format:** CoinGecko slug (lowercase, no suffix) -- e.g., "bitcoin", "ethereum", "solana". Use directly as coinId. Derive the trading pair by mapping common slugs (bitcoin->BTCUSDT, ethereum->ETHUSDT, solana->SOLUSDT, etc.).

**Secondary format:** Trading pair (contains "USDT") -- e.g., "BTCUSDT". Use directly for crypto_quote and crypto_technicals. Infer coinId from common mappings; if unknown, skip CoinGecko calls and note the gap.

Plain uppercase symbols (e.g., "BTC", "ETH") are also accepted -- append "USDT" for the pair and infer coinId from common mappings.

If the coin cannot be resolved to at least a trading pair, respond with an error and STOP.

## Data Collection

### Wave 1 — ALL calls in parallel

| Tool                        | Parameters                  | Priority    |
|-----------------------------|-----------------------------|-------------|
| crypto_quote                | symbols=[PAIR]              | REQUIRED    |
| crypto_technicals           | symbols=[PAIR]              | REQUIRED    |
| coingecko_coin              | coinId=SLUG                 | REQUIRED    |
| sentiment_crypto_fear_greed | (no parameters)             | ENRICHMENT  |
| coingecko_global            | (no parameters)             | ENRICHMENT  |

If a REQUIRED tool fails, report the error and STOP. If coingecko_coin fails because the slug mapping was wrong, note the gap and continue with trading pair data only. If ENRICHMENT tools fail, continue without them.

## Analysis

DO NOT reproduce raw tool output. Synthesize across all data sources.

Cross-reference in this order:

1. **Price action vs market data** — Does CoinGecko market data (volume, market cap rank, supply metrics) support the current price trend or suggest divergence?
2. **Technical signals** — RSI, MACD, moving averages. Is the coin overbought/oversold? Trending or ranging?
3. **Market sentiment alignment** — Does the Fear and Greed Index agree with the coin's individual momentum? Extreme greed during a rally is a warning; fear during accumulation is opportunity.
4. **Dominance and macro context** — Is BTC dominance rising or falling? Rising dominance pressures altcoins. Falling dominance favors alt rotation.

Weight REQUIRED data heavily. Use ENRICHMENT data to confirm or challenge. If the coin is an altcoin, explicitly discuss BTC correlation risk.

## Output Format

### [COIN] — [Full Name]

**[Price] | [Change 24h %] | Vol 24h: [Volume] | MCap: [Market Cap] | Rank: #[Rank]**

### Market Data

| Metric              | Value   |
|---------------------|---------|
| All-Time High       |         |
| ATH Distance        |         |
| 24h High / Low      |         |
| Circulating Supply  |         |
| Total Supply        |         |
| Market Cap Rank     |         |

### Technical Snapshot

| Indicator           | Value   | Signal       |
|---------------------|---------|--------------|
| RSI (14)            |         |              |
| MACD                |         |              |
| SMA 20              |         |              |
| SMA 50              |         |              |
| SMA 200             |         |              |
| TradingView Rating  |         |              |

### Market Context

| Indicator               | Value   | Reading      |
|-------------------------|---------|--------------|
| Crypto Fear & Greed     |         |              |
| BTC Dominance           |         |              |
| Total Crypto Market Cap |         |              |

If enrichment data is unavailable, omit the row and note "Market context data unavailable" below the table.

### Verdict

**Direction:** BULLISH / BEARISH / NEUTRAL
**Confidence:** HIGH / MEDIUM / LOW
**Support:** [level]
**Resistance:** [level]
**Key Risk:** One sentence describing the primary downside scenario (e.g., BTC breakdown, regulatory event, liquidity thin below support).

## Limitations

Data from TradingView and Yahoo Finance is 15-minute delayed. CBOE and sentiment data is end-of-day. Verify critical levels with real-time data before executing trades.

## Common Mistakes

- Using a CoinGecko slug as a trading pair or vice versa — resolve the input type BEFORE making any calls.
- Ignoring BTC dominance context for altcoin analysis — altcoins can drop even with bullish individual technicals if BTC dominance surges.
- Presenting CoinGecko JSON fields verbatim instead of extracting and formatting the relevant metrics.
- Calling tools sequentially — ALL Wave 1 calls MUST be parallel.
