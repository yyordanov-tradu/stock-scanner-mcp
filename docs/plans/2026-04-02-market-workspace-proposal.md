# Market Workspace Proposal

**Date:** 2026-04-02
**Status:** Revised after review
**Author:** Yordan Yordanov + AI Assistant

## Overview

The next major product step for `stock-scanner-mcp` should not be "more tools." The better move is to turn the server into a **personal market workspace** built on top of the existing market-data surface.

This proposal makes one product decision explicit:

- **MVP is research memory first**
- **Portfolio tracking and P&L are not part of MVP**

The product direction is:

1. **Watchlists**: persistent named groups of instruments
2. **Thesis journal**: saved research context per instrument
3. **Profile and defaults**: saved exchange, timeframe, and workflow preferences
4. **Playbooks**: opinionated workflows such as morning briefing, watchlist review, earnings prep, and thesis refresh

This changes the product from:

- "finance MCP server with many tools"

to:

- "finance MCP server that remembers what I track and runs my market routines"

## Why This Direction

Current strengths:

- broad market coverage across stocks, crypto, options, SEC, macro, sentiment, and forex
- strong zero-key onboarding
- installable skills already prove that workflow packaging adds real value

Current gap:

- the server is still mostly a query surface
- users must restate what they care about in every session
- there is no persistent research context between sessions
- the best workflows are still stateless and session-local

This proposal adds:

- personalization
- stickiness
- repeat usage
- stronger demos
- clearer differentiation from finance MCP servers that only wrap APIs

## Product Decision

The MVP is a **research workspace**, not a portfolio tracker.

That means:

- watchlists are in scope
- thesis records are in scope
- saved profile/preferences are in scope
- playbooks that consume saved research context are in scope

The following are explicitly out of scope for MVP:

- live trading execution
- broker connectivity
- trade blotter features
- portfolio holdings and P&L
- push alerts
- paper trading
- collaboration features

The goal is to prove that persistent research context increases usage and perceived value. If that works, portfolio-state features can be evaluated later as a separate product step.

## Customer Experience

### Installation

There should be **no separate npm package** and **no second server install path**.

The customer experience should remain:

1. install `stock-scanner-mcp` exactly as today
2. optionally install skills using the existing skill installer
3. opt in to workspace persistence with one config flag

This keeps adoption simple and avoids fragmenting the product.

### Enablement

Workspace persistence should be an explicit opt-in because it introduces local writes.

Recommended server config additions:

- `--enable-workspace`
- `--data-dir <path>`
- `STOCK_SCANNER_DATA_DIR` env override

This keeps the current zero-key read-only experience unchanged for existing users while making the stateful feature discoverable and intentional.

### First-Run Experience

The first-run experience should guide the user instead of dropping them into raw write tools.

Recommended onboarding entry point:

- `/setup-market-workspace`

It should gather:

- whether the user is an intraday trader, swing trader, long-term investor, or mixed
- whether they care about stocks, crypto, options, macro, or all
- the first 5-20 names they track
- default timeframe and exchange preferences
- whether they want a daily morning workflow or weekly review habit

The result should be:

- create `core` watchlist
- optionally create a second watchlist such as `earnings-week`
- create a default user profile
- optionally create starter thesis entries for core names

## Core Concepts

### 1. Canonical Instrument Identity

This is a required design constraint, not an implementation detail.

The current server already normalizes user input through `src/shared/resolver.ts`. The workspace layer must store the resolved identity, not only the raw symbol entered by the user.

Every saved instrument should include:

- `full`: canonical key such as `NASDAQ:AAPL`
- `ticker`: normalized base symbol such as `AAPL`
- `exchange`: normalized exchange when applicable
- `isCrypto`: whether the identity is treated as crypto by the resolver
- `input`: the original user input for display and traceability

Rules:

- `full` is the primary key for watchlists and thesis records
- all user-entered symbols are resolved on write
- reads return both canonical and human-friendly fields
- future migrations may improve resolver logic, but saved records should remain stable once written

This avoids ambiguity across exchanges and asset classes and keeps saved state aligned with how the server already resolves tickers elsewhere.

### 2. Watchlists

Named persistent lists such as:

- `core`
- `earnings-week`
- `swing-candidates`
- `high-beta`
- `macro-sensitive`

Each watchlist can store:

- canonical instrument references
- tags
- short notes
- preferred timeframe
- preferred exchange
- created and updated timestamps

### 3. Thesis Journal

Per-instrument research memory, for example:

- thesis summary
- bullish case
- bearish case
- catalyst
- invalidation level
- target or scenario range
- timeframe
- next review date
- confidence
- last updated

This is not a broker integration and not a trade blotter. It is a decision-memory layer for research continuity.

### 4. Profile and Defaults

One default user profile can hold:

- default exchange
- preferred timeframes
- preferred asset focus
- workflow preferences such as daily briefing versus weekly review

## Customer Journey

### 1. Discovery and Positioning

The message should be:

- "This is the finance MCP server that remembers your watchlists and theses, then runs your daily workflows."

Not:

- "This server has 61 tools."

### 2. Daily Use

Typical morning flow:

1. User opens Claude Desktop or Claude Code
2. User runs `/morning-briefing`
3. Claude checks saved watchlists, macro calendar, earnings calendar, sentiment, and price action for relevant names
4. Claude returns:
   - what matters today
   - names that need attention
   - event risk
   - suggested follow-up playbooks

This should feel like a routine, not a one-off API query.

### 3. Event-Driven Use

When the user wants to inspect one symbol deeply:

- `/earnings-play NVDA`
- `/thesis-refresh TSLA`
- `/watchlist-review swing-candidates`

The differentiator is that the workflow compares:

- current market state

against:

- saved watchlist context
- saved thesis context

### 4. Weekly Review

The system should support recurring research hygiene:

- review theses due this week
- prune stale watchlist names
- update catalysts
- review earnings names for next week

## Fit With The Current MCP Server

This idea fits the product, but the repo needs a realistic implementation sequence.

### Tools

Tools remain the execution layer for MVP.

Proposed MVP tools:

- `workspace_create_watchlist`
- `workspace_update_watchlist`
- `workspace_delete_watchlist`
- `workspace_list_watchlists`
- `workspace_save_thesis`
- `workspace_get_thesis`
- `workspace_list_due_reviews`
- `workspace_archive_thesis`
- `workspace_get_profile`
- `workspace_update_profile`

### Prompts

Prompts are already a supported primitive in the server today, so they are part of MVP.

Recommended prompt ids:

- `setup_market_workspace`
- `morning_brief`
- `watchlist_review`
- `earnings_setup`
- `thesis_refresh`

Prompt names and skill names should be intentionally mapped, not mixed:

- prompt `morning_brief` backs skill `/morning-briefing`
- prompt `earnings_setup` backs skill `/earnings-play`
- prompt `watchlist_review` backs skill `/watchlist-review`
- prompt `thesis_refresh` backs skill `/thesis-refresh`

### Skills

Skills remain valuable, especially for Claude Code, but they should be personalized rather than duplicated.

Examples:

- `/morning-briefing` uses the saved `core` watchlist
- `/earnings-play` can prioritize the `earnings-week` watchlist
- `/risk-check TICKER` can reference a saved thesis if present

### Resources

Resources are **not MVP**.

They are still a strong phase-2 direction, but the current server visibly supports prompt registration and tool registration today, while a resource registration layer is not yet present in the codebase.

That means the right order is:

1. persistent storage plus stateful tools
2. workspace-aware prompts and skills
3. resource exposure once the server has an explicit resource implementation path

Potential phase-2 resource URIs:

- `watchlist://core`
- `watchlist://earnings-week`
- `thesis://NASDAQ:AAPL`
- `review://due`
- `profile://default`

## Storage Strategy

### Default Backend

Default MVP backend should be **local JSON behind a storage abstraction**.

Recommended default path:

- `~/.stock-scanner-mcp/workspace.json`

with override support via `--data-dir` or `STOCK_SCANNER_DATA_DIR`.

The file should not live in the repo root or current working directory.

### Required Safety Guarantees

The JSON design is only acceptable if it includes:

- `schemaVersion`
- zod validation on every load
- migration hooks for future schema changes
- atomic write via temp file and rename
- one-process write serialization
- corruption handling with a last-known-good backup

Cross-process locking is not guaranteed by plain JSON. That limitation should be documented explicitly in MVP and treated as a future threshold for moving to SQLite.

### When To Move To SQLite

SQLite becomes justified when one or more of these are true:

- multiple Claude sessions are expected to write concurrently
- history and append-heavy journals become core features
- resources, sidecar views, or automations create heavier local-state usage
- export/import and richer querying become important

The plan should therefore build a small storage interface now so the backend can change later without rewriting tool handlers.

## Repo-Fit Requirements

The implementation plan must respect the current repo standards.

That means the eventual implementation must include:

- a proper `src/modules/workspace/` module with `index.ts`, `client.ts`, and tests
- `withMetadata()`-wrapped handlers
- dedicated handler tests for every new tool
- integration test count updates
- help text and docs updates

There is one additional repo-level requirement for this feature:

- the server currently registers all tools as read-only

Stateful workspace tools therefore require a small shared change so tool annotations can distinguish read-only tools from mutating tools. This is a prerequisite for a correct implementation.

## MVP Scope

### In Scope

- named watchlists
- thesis records keyed by canonical instrument id
- default user profile/preferences
- prompt-backed workflows for:
  - `morning_brief`
  - `watchlist_review`
  - `earnings_setup`
  - `thesis_refresh`
- skill updates that consume saved context

### Out of Scope

- portfolio holdings and P&L
- broker connectivity
- execution
- alerts and channels
- paper trading
- collaboration
- resource-layer rollout

## Example Workflows

### Workflow A: Swing Trader

1. Create `swing` watchlist
2. Save 8-15 theses with entries, risks, and invalidation levels
3. Run `/morning-briefing`
4. Run `/watchlist-review swing`
5. Run `/thesis-refresh PLTR`

### Workflow B: Earnings Trader

1. Create `earnings-week` watchlist
2. Run `/earnings-play AAPL`
3. Compare implied move, sentiment, and current thesis
4. Review all names due to report in the next 5 trading days

### Workflow C: Long-Term Investor

1. Create `core` watchlist
2. Save durable theses for 10 names
3. Run weekly thesis review
4. Check insider activity, earnings changes, and macro sensitivity only when relevant

## Rollout Plan

### Phase 1: Workspace Foundation

- storage abstraction
- watchlists
- thesis journal
- profile/preferences
- write-safe tool annotations

### Phase 2: Personalized Workflows

- `setup_market_workspace`
- `morning_brief`
- `watchlist_review`
- `earnings_setup`
- `thesis_refresh`
- skill updates that consume saved state

### Phase 3: Resource Layer

- expose workspace objects as MCP resources
- enable cleaner `@`-style reuse where clients support it

### Phase 4: Proactive Delivery

- scheduled morning briefs
- due-review automation
- event alerts through channels or sidecar integration

## Success Metrics

Product success should not be measured by tool count.

Better metrics:

- percentage of users who create at least one watchlist
- percentage of users who save at least one thesis
- repeat weekly usage of playbooks
- number of returning sessions where saved context is reused
- installs that progress from raw query usage to workflow usage

## Open Questions

1. Should thesis records be mostly structured fields, mostly free text, or hybrid?
2. Should export and import be part of v1 or wait until the schema settles?
3. At what point does concurrent-write risk justify moving from JSON to SQLite?
4. Should the onboarding flow create starter watchlists automatically or only on explicit user confirmation?

## Recommendation

Build in this order:

1. storage abstraction plus canonical instrument identity
2. watchlists
3. thesis journal
4. workspace-aware prompts
5. personalized skill updates
6. resources later, after there is an explicit server-side resource path

If only one major product bet is taken next, this should be it.
