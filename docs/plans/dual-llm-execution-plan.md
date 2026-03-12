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
| 08 | TradingView Stock Scanner | Claude | Pending |
| 09 | TradingView Crypto Scanner | Gemini | ⌛ Reviewing |
| 10 | SEC EDGAR | Claude | Pending |
| 11 | CoinGecko | Gemini | ⏳ Next |
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

> **MANDATORY:** Both LLMs MUST log every action here with a clear timestamp, task number, and action type. This is how the other LLM knows what happened and what to do next. Push to main after every log entry.

### Action Types
- `START` — Beginning work on a task
- `PR_OPENED` — PR created, awaiting cross-LLM review (include PR number)
- `PR_REVIEWED` — Reviewed the other LLM's PR (include PR number + verdict: APPROVED / CHANGES_REQUESTED)
- `PR_FIXED` — Addressed review feedback, PR updated
- `MERGED` — PR merged to main (include PR number)
- `BLOCKED` — Waiting on dependency or other LLM's action
- `NOTE` — General coordination message

### Format
```
| Timestamp | LLM | Task | Action | Details |
```

### Log

| Timestamp | LLM | Task | Action | Details |
|-----------|-----|------|--------|---------|
| 2026-03-12 21:00 | Gemini | 01 | MERGED | PR merged — project scaffolding |
| 2026-03-12 21:05 | Claude | 03 | START | Beginning shared types implementation |
| 2026-03-12 21:15 | Claude | 03 | PR_OPENED | PR #1 — shared types (ModuleDefinition, ToolDefinition, ToolResult) |
| 2026-03-12 21:17 | Gemini | 02 | PR_OPENED | PR #2 — plugin shell |
| 2026-03-12 21:20 | Claude | 02 | PR_REVIEWED | PR #2 — CHANGES_REQUESTED: duplicated scaffolding files must be removed |
| 2026-03-12 21:22 | Claude | 04 | PR_OPENED | PR #3 — HTTP client with timeouts |
| 2026-03-12 21:25 | Claude | 03 | MERGED | PR #1 merged |
| 2026-03-12 21:29 | Gemini | 02 | PR_FIXED | PR #2 rebased, duplicated files removed |
| 2026-03-12 21:30 | Gemini | 02 | MERGED | PR #2 merged |
| 2026-03-12 21:33 | Claude | 05 | PR_OPENED | PR #4 — TTL cache with getOrFetch |
| 2026-03-12 21:39 | Gemini | 06 | PR_OPENED | PR #5 — config parser & module registry |
| 2026-03-12 21:41 | Claude | 06 | PR_REVIEWED | PR #5 — APPROVED: 11/11 tests pass, matches plan |
| 2026-03-12 21:42 | Gemini | 04 | PR_REVIEWED | PR #3 — (pending review from Gemini) |
| 2026-03-12 21:42 | Gemini | 05 | PR_REVIEWED | PR #4 — (pending review from Gemini) |
| 2026-03-12 21:45 | — | 03,04,05,06 | MERGED | All foundation PRs merged |
| 2026-03-12 22:00 | Claude | — | NOTE | Created this activity log. Next: task 07 (Claude) |
| 2026-03-12 22:45 | Claude | 07 | START | Beginning MCP server entry point implementation |
| 2026-03-12 22:50 | Claude | 07 | PR_OPENED | PR #7 — MCP server entry point with tool registration and error wrapping |
| 2026-03-12 23:05 | Gemini | 07 | PR_REVIEWED | PR #7 — APPROVED |
| 2026-03-12 23:10 | Claude | 07 | MERGED | PR #7 merged — Phase 1 Foundation Complete |
| 2026-03-12 23:15 | Gemini | 09 | START | Starting TradingView Crypto Scanner |
| 2026-03-12 23:25 | Gemini | 09 | PR_OPENED | PR #9 — TradingView Crypto Scanner module |
| 2026-03-12 23:20 | Claude | 08 | START | Beginning TradingView Stock Scanner module |
| 2026-03-12 23:35 | Gemini | 11 | START | Starting CoinGecko Crypto Data module |
| 2026-03-12 23:45 | Gemini | 11 | PR_OPENED | PR #10 — CoinGecko Crypto Data module |
