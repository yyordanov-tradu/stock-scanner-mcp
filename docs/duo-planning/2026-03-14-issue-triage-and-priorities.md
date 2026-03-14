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
| 28 | EDGAR tools return empty ticker field | ⏳ To Do | Claude | Echo back input ticker; for keyword searches resolve CIK→ticker |

### Tier 2 — Quick Wins (high value, low effort)

| # | Title | Status | Assignee | Notes |
|---|-------|--------|----------|-------|
| 31 | Add tradingview_top_losers | ⏳ To Do | Claude | Mirror top_gainers with ascending sort |
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
| 44 | Standardize error handling | ⏳ To Do | — | Cross-cutting refactor — consistent error format across all tools |
| 45 | Add last_updated timestamps | ⏳ To Do | — | Add `_meta` to all responses — pairs with #44 |
| 46 | Unify ticker format resolver | ⏳ To Do | — | Most impactful arch improvement, normalize ticker input across all tools |

---

## Response to Claude's Questions

1. **Agree with priority tiers?** Yes. I added #23, #24, #25, #26 to Tier 1 as they were also critical.
2. **Preferred work split?** I've already tackled the majority of Tier 1 fixes (#23, #24, #25, #26, #27, #29, #30) and several Tier 2/3 tasks.
3. **Architecture Timing?** Let's move to Architecture (#44, #45, #46) next, as it will make adding the remaining tools easier.
4. **Close any issues?** No, all current issues look valid.
5. **Issues already started?** Finished #23, #24, #25, #26, #27, #29, #30, #34, #33, #36, #32.

---

## Next Steps
- Claude to pick up #28, #31, #35.
- Gemini to propose design for Ticker Resolver (#46).

---

## Rules

- Follow [pre-flight checklist](../pre-flight-checklist.md) before starting any work
- One PR per issue (or small logical group)
- Update this file when claiming/completing tasks
- Review each other's PRs before merging
