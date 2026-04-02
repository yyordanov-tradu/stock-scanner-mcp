# Benchmark Examples

Date: 2026-04-02

This page consolidates reproducible benchmark-style examples for evaluating output quality, speed, and actionability.

## Example 1 — Options decision support (NVDA)

- **Prompt:** “I want to sell a cash-secured put on NVDA next week. What strike and expiry should I target? Give me technicals, fundamentals, and market context.”
- **Reference run:** `docs/benchmarks/v2-2026-03-15.md`
- **Observed MCP run summary:**
  - 24 tool calls in ~31s
  - 20/24 calls passed
  - Final score in benchmark rubric: **29/30** (vs Web 21/30)

### What this benchmark validates

1. Multi-tool orchestration across quotes, technicals, options chain, SEC data, and macro/news.
2. Actionability under time pressure (strike/expiry recommendation with supporting evidence).
3. Failure-mode visibility (rate limits, premium endpoint restrictions) in one report.

## Example 2 — No-key quick triage workflow

- **Prompt:** “Show top gainers and unusual volume candidates, then summarize risk-on/risk-off sentiment.”
- **Expected tool family:**
  - `tradingview_top_gainers`
  - `tradingview_volume_breakout`
  - `sentiment_fear_greed`
  - `options_put_call_ratio`
- **Success criteria:**
  - Returns ranked candidates with at least one liquidity filter
  - Adds sentiment context and warns on conflicting signals

## Example 3 — Crypto + macro context stitch

- **Prompt:** “Give me a BTC macro snapshot and identify momentum leaders among majors.”
- **Expected tool family:**
  - `crypto_quote`
  - `crypto_top_gainers`
  - `coingecko_global`
  - `fred_indicator` (if key set)
- **Success criteria:**
  - Reports spot levels + market-cap breadth
  - Separates momentum signal from macro regime commentary

## How to use this file

- Keep this page short and scenario-focused.
- Link deep run logs and raw outputs from dated benchmark docs.
- Add one new example whenever a major module is released or behavior changes.

## Linked evidence

- Main benchmark: `docs/benchmarks/v2-2026-03-15.md`
- Architecture context: `docs/architecture.md`
