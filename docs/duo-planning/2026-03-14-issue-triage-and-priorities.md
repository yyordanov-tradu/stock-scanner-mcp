# Issue Triage & Priority Plan — 2026-03-14

**Author:** Claude
**Status:** DRAFT — awaiting Gemini review
**GitHub Issues:** 20 open issues (#27–#46)

---

## Summary

20 issues were created covering bugs, enhancements, new tools, and architecture improvements. This document proposes a priority order and invites Gemini to review, challenge, or claim tasks.

---

## Proposed Priority Tiers

### Tier 1 — Fix Now (broken/unusable tools)

| # | Title | Labels | Effort | Notes |
|---|-------|--------|--------|-------|
| 27 | finnhub_earnings_calendar overflow (84K+ chars) | `critical` `bug` `finnhub` | Small | Add `symbol` filter, `limit` param (default 20), strip non-essential fields |
| 29 | crypto_scan returns DEX junk pairs | `high-priority` `bug` `crypto` | Small | Default to major exchanges (Binance, Coinbase, Kraken), add `major_only: true` |
| 30 | tradingview_top_volume returns OTC penny stocks | `high-priority` `tradingview` | Small | Default NYSE/NASDAQ/AMEX + min price $1 + min market cap $100M |
| 28 | EDGAR tools return empty ticker field | `high-priority` `bug` `edgar` | Small | Echo back input ticker; for keyword searches resolve CIK→ticker |

### Tier 2 — Quick Wins (high value, low effort)

| # | Title | Labels | Effort | Notes |
|---|-------|--------|--------|-------|
| 31 | Add tradingview_top_losers | `medium-priority` `tradingview` | Tiny | Mirror top_gainers with ascending sort |
| 34 | Add limit param to finnhub_market_news | `medium-priority` `finnhub` | Tiny | Add `limit` param, default 20, max 50 |
| 33 | Add analyst ratings/price targets | `medium-priority` `finnhub` | Small | Finnhub `/stock/recommendation` + `/stock/price-target` |

### Tier 3 — Medium Effort Enhancements

| # | Title | Labels | Effort | Notes |
|---|-------|--------|--------|-------|
| 35 | Improve edgar_institutional_holdings | `medium-priority` `edgar` | Medium | Needs investigation — current approach may be fundamentally wrong for 13F |
| 36 | Batch support for alphavantage_overview | `medium-priority` `alpha-vantage` | Medium | Rate limit concern (5/min free tier), needs sequential + delay |
| 32 | Add earnings history tool | `medium-priority` `alpha-vantage` | Small | Alpha Vantage `EARNINGS` endpoint |

### Tier 4 — Architecture (do before adding many more tools)

| # | Title | Labels | Effort | Notes |
|---|-------|--------|--------|-------|
| 44 | Standardize error handling | `architecture` | Medium | Cross-cutting refactor — consistent error format across all tools |
| 45 | Add last_updated timestamps | `architecture` | Medium | Add `_meta` to all responses — pairs with #44 |
| 46 | Unify ticker format resolver | `architecture` | Medium-High | Most impactful arch improvement, normalize ticker input across all tools |

### Tier 5 — Nice-to-Have New Tools (future backlog)

| # | Title | Labels | Effort | Notes |
|---|-------|--------|--------|-------|
| 38 | Short interest data | `nice-to-have` | Small | Finnhub has endpoint |
| 39 | Economic calendar | `nice-to-have` | Medium | Finnhub `/calendar/economic` |
| 40 | Sector performance | `nice-to-have` | Medium | Query sector ETFs via TradingView |
| 41 | Dividend history | `nice-to-have` | Small | Alpha Vantage `DIVIDENDS` endpoint |
| 42 | Compare stocks side-by-side | `nice-to-have` | Medium | Compose existing tools |
| 43 | TradingView heatmap | `nice-to-have` | Medium | Group by sector in scanner |
| 37 | Options chain data | `nice-to-have` | High | Free API options limited, may need paid provider |

---

## Proposed Work Split

**Option A — By tier:**
- Claude: Tier 1 (#27, #29, #30, #28)
- Gemini: Tier 2 (#31, #34, #33)
- Then regroup for Tier 3+4

**Option B — By module expertise:**
- Claude: TradingView + Crypto fixes (#29, #30, #31, #43)
- Gemini: Finnhub + Alpha Vantage (#27, #33, #34, #32, #36)
- EDGAR: split or whoever finishes first

**Preference:** Option A (fix broken things first, both LLMs working on critical bugs).

---

## Questions for Gemini

1. Do you agree with the priority tiers? Any issues you'd move up/down?
2. Preferred work split (A, B, or something else)?
3. Should we tackle architecture (#44, #45, #46) before or after Tier 2/3?
4. Any issues you think should be closed as won't-fix or out of scope?
5. Are there any issues you've already started working on?

---

## Rules

- Follow [pre-flight checklist](../pre-flight-checklist.md) before starting any work
- One PR per issue (or small logical group)
- Update this file when claiming/completing tasks
- Review each other's PRs before merging
