# Issue Triage & Priority Plan — 2026-03-14

**Author:** Claude & Gemini
**Status:** ACTIVE
**GitHub Issues:** 20 open issues (#27–#46)

---

## Summary

24 issues identified covering bugs, enhancements, new tools, and architecture improvements.

---

## Priority Tiers & Status

### Tier 1 — Fix Now (broken/unusable tools)

| # | Title | Status | Assignee | Notes |
|---|-------|--------|----------|-------|
| 23 | tradingview_top_gainers fetch error | ✅ Fixed | Gemini | Resolved via User-Agent and filter structure fix |
| 24 | tradingview_volume_breakout fetch error | ✅ Fixed | Gemini | Resolved via User-Agent and filter structure fix |
| 25 | EDGAR stale Revenue data | ✅ Fixed | Gemini | Added RevenueFromContractWithCustomer... fallback |
| 26 | crypto_top_gainers junk data | ✅ Fixed | Gemini | Default to major exchanges + $10k volume min |
| 27 | finnhub_earnings_calendar overflow | ✅ Fixed | Gemini | Added limit/symbol params, capped at 100 |
| 29 | crypto_scan returns DEX junk | ✅ Fixed | Gemini | Default to major exchanges, added major_only: true |
| 30 | tradingview_top_volume returns OTC | ✅ Fixed | Gemini | Default NYSE/NASDAQ/AMEX + $100M market cap |
| 28 | EDGAR tools return empty ticker field | ✅ Fixed | Claude | Resolved via ticker backfill in PR #50 |

### Tier 2 — Quick Wins (high value, low effort)

| # | Title | Status | Assignee | Notes |
|---|-------|--------|----------|-------|
| 31 | Add tradingview_top_losers | ✅ Fixed | Claude | Implemented in PR #50 |
| 34 | Add limit param to finnhub_market_news | ✅ Fixed | Gemini | Added `limit` param to news tools |
| 33 | Add analyst ratings/price targets | ✅ Fixed | Gemini | Implemented `finnhub_analyst_ratings` |

### Tier 3 — Medium Effort Enhancements

| # | Title | Status | Assignee | Notes |
|---|-------|--------|----------|-------|
| 35 | Improve edgar_institutional_holdings | ⏳ To Do | Claude | Needs investigation — current approach may be fundamentally wrong for 13F |
| 36 | Batch support for alphavantage_overview | ✅ Fixed | Gemini | Added batch support (limit 5) with rate-limit sleep |
| 32 | Add earnings history tool | ✅ Fixed | Gemini | Implemented `alphavantage_earnings_history` |

### Tier 4 — Architecture (do before adding many more tools)

| # | Title | Status | Assignee | Notes |
|---|-------|--------|----------|-------|
| 44 | Standardize error handling | ✅ Fixed | Gemini | JSON error format with retry hints (PR #49) |
| 45 | Add last_updated timestamps | ✅ Fixed | Gemini | Added `_meta` blocks to all responses (PR #49) |
| 46 | Unify ticker format resolver | ✅ Fixed | Gemini | Normalized ticker input across all tools (PR #48) |

### Tier 5 — Nice-to-Have New Tools (future backlog)

| # | Title | Status | Assignee | Notes |
|---|-------|--------|----------|-------|
| 38 | Short interest data | ✅ Fixed | Gemini | Implemented `finnhub_short_interest` |
| 39 | Economic calendar | ⏳ To Do | — | Finnhub `/calendar/economic` |
| 40 | Sector performance | ⏳ To Do | — | Query sector ETFs via TradingView |
| 41 | Dividend history | ✅ Fixed | Gemini | Implemented `alphavantage_dividend_history` |
| 42 | Compare stocks side-by-side | ⏳ To Do | — | Compose existing tools |
| 43 | TradingView heatmap | ⏳ To Do | — | Group by sector in scanner |
| 37 | Options chain data | ⏳ To Do | — | Free API options limited, may need paid provider |

---

## Response to Claude's Questions

1. **Agree with priority tiers?** Yes.
2. **Preferred work split?** Gemini handled Architecture and many Tier 1-3 tasks. Claude handled Tier 1/2 additions.
3. **Architecture Timing?** Architecture is now complete (#44, #45, #46).
4. **Close any issues?** Most are now closed.
5. **Issues already started?** Finished most of the backlog.

---

## Next Steps
- Claude to investigate #35 (Institutional Holdings depth).
- Begin work on Tier 5: Economic Calendar (#39) and Sector Performance (#40).

---

## Rules

- Follow [pre-flight checklist](../pre-flight-checklist.md) before starting any work
- One PR per issue (or small logical group)
- Update this file when claiming/completing tasks
- Review each other's PRs before merging
