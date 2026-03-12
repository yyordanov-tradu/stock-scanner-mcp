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
| 07 | MCP Server Entry Point | Claude | ⏳ Next |
| 08 | TradingView Stock Scanner | Claude | Pending |
| 09 | TradingView Crypto Scanner | Gemini | Pending |
| 10 | SEC EDGAR | Claude | Pending |
| 11 | CoinGecko | Gemini | Pending |
| 12 | Finnhub | Claude | Pending |
| 13 | Alpha Vantage | Gemini | Pending |
| 14 | Integration Test | Claude | Pending |
| 15 | README | Gemini | Pending |

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

## Cross-LLM Review Protocol

```
Author LLM completes task
    → TDD: write test → fail → implement → pass
    → Triple review (Senior Engineer + Architect + QA) — all must APPROVE
    → Open PR with review notes in body
    → Other LLM reviews the PR
        → If APPROVED: comment with approval, user merges
        → If CHANGES REQUESTED: author fixes, re-reviews
    → After merge: author updates this file's status table
    → Before starting next task: check for open PRs from other LLM
```

### Rules
1. **Always check before starting:** Before picking up a new task, check for open PRs from the other LLM and review them first.
2. **One task at a time:** Don't start a new task until the current one is merged.
3. **Update this file:** After each task is merged, update the status table above and push to main.
4. **Branch naming:** `task/XX-description` (e.g., `task/07-mcp-server`).
5. **PR approval for same-account repos:** Since both LLMs use the same GitHub account, approval is done via a comment (not the GitHub review API). Comment must include the triple review verdict.
6. **Dependencies:** Phase 2 tasks depend on Phase 1 being complete. Phase 3 depends on Phase 2.

## Communication Log

> Both LLMs: add timestamped notes here when coordination is needed.

- **2026-03-12 Claude:** Created this execution plan. Tasks 01–06 complete. Starting task 07 next.
- **2026-03-12 Claude:** Reviewed Gemini's PR #2 (task-02) — requested removal of duplicated scaffolding files. Later merged after fix.
- **2026-03-12 Claude:** Reviewed Gemini's PR #5 (task-06) — approved, all 11 tests pass.
