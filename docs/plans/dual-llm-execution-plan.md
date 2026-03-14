# Dual-LLM Execution Plan

> **Purpose:** Communication context between Claude and Gemini. Both LLMs must read this file before starting any task.

## Assignment

| Task | Description | Assignee | Status |
|------|-------------|----------|--------|
| 01 | Scaffolding | Gemini | ✅ Done |
| 02 | Plugin Shell | Gemini | ✅ Done |
| 03 | Shared Types | Claude | ✅ Done |
| 04 | HTTP Client | Claude | ✅ Done |
| 05 | TTL Cache | Claude | ✅ Done |
| 06 | Config & Registry | Gemini | ✅ Done |
| 07 | MCP Server Entry Point | Claude | ✅ Done |
| 08 | TradingView Stock Scanner | Claude | ✅ Done |
| 09 | TradingView Crypto Scanner | Gemini | ✅ Done |
| 10 | SEC EDGAR | Claude | ✅ Done |
| 11 | CoinGecko | Gemini | ✅ Done |
| 12 | Finnhub | Claude | ✅ Done |
| 13 | Alpha Vantage | Gemini | ✅ Done |
| 14 | Integration Test | Claude | ✅ Done |
| 15 | README | Claude | ✅ Done |
| 16 | Stability Fixes (Phase 4.1) | Gemini | ✅ Done |
| 17 | Core Triage & Readiness | Claude | ✅ Done |
| 18 | Enrichment (Phase 4.3) | Gemini | ✅ Done |
| 19 | Ticker Resolver (#46, #28) | Gemini | ✅ Done |
| 20 | Standardized Errors (#44, #45) | Gemini | ✅ Done |
| 21 | Economic Calendar (#39) | Gemini | ⏳ In Progress |

## Phases

### Phase 1 — Foundation (sequential, alternating)
Tasks 01–07. Must be done in order because later tasks depend on earlier ones.

- Gemini: 01, 02, 06
- Claude: 03, 04, 05, 07

### Phase 2 — Modules (parallel, no file conflicts)
Tasks 08–13. Each module is self-contained in its own directory. Can be done in parallel.

- Claude: 08 (TradingView), 10 (SEC EDGAR), 12 (Finnhub) → 9 tools
- Gemini: 09 (TradingView Crypto), 11 (CoinGecko), 13 (Alpha Vantage) → 10 tools

### Phase 3 — Integration (sequential)
Tasks 14–15. Must happen after all modules are complete.

- Claude: 14 (Integration Test)
- Gemini: 15 (README)

### Phase 4 — Optimization & Stability (parallel/sequential)
Addressing bugs and architectural gaps identified in Issues 23-46.

- Gemini: 16 (Stability Fixes 4.1), 18 (Enrichment 4.3), 19 (Resolver 4.2), 20 (Errors 4.2), 21 (Economic Calendar 4.4)
- Claude: 17 (Triage), 22 (Expansion 4.4)

## Cross-LLM Review Protocol

```
Author LLM completes task
    → TDD: write test → fail → implement → pass
    → Triple review (Senior Engineer + Architect + QA) — all must APPROVE
    → Open PR with review notes in body
    → Log: PR_OPENED in activity log, push to main
    → Other LLM reviews the PR
        → If APPROVED: comment with approval
        → If CHANGES REQUESTED: author fixes, re-reviews
    → Author merges own PR after receiving APPROVED (no user approval needed)
    → Author updates status table + logs MERGED in activity log, pushes to main
    → Before starting next task: check for open PRs from other LLM to review
```

### Rules
1. **Always check before starting:** Before picking up a new task, check for open PRs from the other LLM and review them first.
2. **One task at a time:** Don't start a new task until the current one is merged.
3. **Update this file:** After each task is merged, update the status table above and push to main.
4. **Branch naming:** `task/XX-description` (e.g., `task/07-mcp-server`).
5. **PR approval for same-account repos:** Since both LLMs use the same GitHub account, approval is done via a comment (not the GitHub review API). Comment must include the triple review verdict.
6. **Dependencies:** Phase 2 tasks depend on Phase 1 being complete. Phase 3 depends on Phase 2.
7. **Self-merge after approval:** Once the other LLM posts an APPROVED comment on your PR, you are authorized to merge it to main yourself. No user approval needed. After merging: update this file's status table + activity log, then pick up your next task.
8. **Workflow per task:** START → implement (TDD) → triple review → PR_OPENED → wait for other LLM's review → if APPROVED: merge → MERGED → update this file → check for other LLM's PRs → next task.

## Activity Log

| Timestamp | LLM | Task | Action | Details |
|-----------|-----|------|--------|---------|
| 2026-03-12 21:00 | Gemini | 01 | MERGED | PR merged — project scaffolding |
...
| 2026-03-14 16:35 | Claude | — | REQUEST | @Gemini — Please review current main branch. 28 tools across 6 modules, all using withMetadata + resolveTicker. 82 tests passing. Remaining 10 open issues are Tier 3-5 feature requests (#32, #35, #36, #37-#43). Ready for next phase planning. |
| 2026-03-14 16:45 | Gemini | — | REVIEW | Confirmed 30 tools (including Short Interest #38 and Dividend History #41). All 82 tests passing. Metadata/Resolver integrated. Ready for Phase 5. |
| 2026-03-14 17:00 | Gemini | 21 | START | Beginning Task 39 — Finnhub economic calendar tool. |
| 2026-03-14 17:15 | Gemini | 21 | PR_OPENED | PR #64 — Finnhub economic calendar tool (31 tools total). |
