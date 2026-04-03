# Winner Plan: Market Workspace V1

**Date:** 2026-04-03
**Status:** Draft for review
**Author:** Yordan Yordanov + Codex

## Decision Summary

The next product step should be a **market workspace**, not a generic persistence or portfolio module.

The winning idea is:

- remember what the user tracks
- remember why they track it
- use that saved context in a few repeatable workflows

The first iteration should stay intentionally small:

- **in scope:** watchlists, thesis notes, user defaults, and a small set of workspace-aware skills
- **out of scope:** portfolio holdings, P&L, broker connectivity, alerts, resources, sidecar views, and automations

This keeps the product differentiated while staying feasible inside the current repo.

## Product Vision

### One-Sentence Positioning

`stock-scanner-mcp` should become the finance MCP server that remembers a user's market context and helps run the same research routines every day.

### Core User Promise

Today the server answers market questions well, but it does not remember the user's working set between sessions.

V1 should solve one real problem:

- a user should not need to restate their core watchlist, research thesis, and default workflow preferences every time they open Claude

### Who V1 Is For

V1 is for users who research the same names repeatedly:

- swing traders
- earnings traders
- long-term investors

It is **not** for users looking for:

- execution
- live portfolio accounting
- broker sync
- advanced journaling

## Product Shape for V1

### 1. Watchlists

Users can create and manage named watchlists such as:

- `core`
- `swing`
- `earnings-week`

Each watchlist should contain:

- canonical instrument identity
- original input symbol for display
- optional short note
- created/updated timestamps

### 2. Thesis Notes

Each instrument can have one active thesis record in V1.

The record should stay lightweight. It should support:

- `summary`
- `bullCase`
- `bearCase`
- `catalyst`
- `invalidation`
- `timeframe`
- `nextReviewDate`
- `confidence`
- `updatedAt`
- `archivedAt` for soft archive

This is enough to support continuity without turning V1 into a full journal product.

### 3. Profile and Defaults

One default profile should store:

- trading style
- focus note
- default exchange for symbol resolution as an advanced/internal setting
- preferred asset focus
- preferred timeframe
- preferred workflow cadence

This allows workflows to feel personalized without adding account complexity.

### 4. Skill-Backed Workflows

V1 should include four workspace-related slash commands:

- `/setup-market-workspace`
- `/update-market-workspace`
- `/watchlist-brief`
- `/watchlist-review`

These should be implemented as Claude Code skills backed by workspace tools.

The existing `/morning-briefing` skill should remain as the general market-wide brief for users who do not want a personalized workspace-aware flow.

These commands are enough to prove the product concept without creating command sprawl.

Defer more specialized workflows such as earnings prep and thesis refresh until V1 is stable.

### 5. Command Naming Pattern

Command names should follow the repo's current style:

- lowercase kebab-case
- short outcome-oriented names
- no pronouns such as `my`
- use `workspace` only for setup and maintenance actions
- use `watchlist` for personalized daily workflows built from saved state

That yields this pattern:

- `/morning-briefing` = generic market brief
- `/watchlist-brief` = personalized brief from saved workspace state
- `/watchlist-review` = periodic review of saved names
- `/setup-market-workspace` and `/update-market-workspace` = explicit workspace management

## Customer Experience

### Installation and Enablement

The install path should remain unchanged:

1. install `stock-scanner-mcp` as today
2. optionally enable workspace mode
3. optionally install and use workspace skills

Recommended config additions:

- `--enable-workspace`
- `--data-dir <path>`
- `STOCK_SCANNER_DATA_DIR`

Workspace mode should be explicit because it introduces local writes.

Workspace module enablement rule for V1:

- workspace tools are registered only when `--enable-workspace` is set
- when workspace mode is off, the MCP server should not register the `workspace` module at all
- workspace skills should treat missing workspace tools as a setup/config issue and instruct the user to enable workspace mode

### First-Run Experience

The first-run entry point should be the slash command:

- `/setup-market-workspace`

It should gather only the minimum useful information:

- trading style: swing, earnings, long-term, or mixed
- first 5-10 names or assets to track
- preferred daily or weekly review rhythm

The setup result should:

- create a `core` watchlist
- create the default profile
- optionally create starter thesis records for core names
- flag ambiguous assets for one follow-up instead of guessing

### Daily Experience

The expected daily loop is:

1. user opens Claude
2. user chooses an entry point:
   `/morning-briefing` for a generic market-wide view, or `/watchlist-brief` for a personalized brief based on saved names
3. Claude checks the saved watchlist plus existing market-data tools when the personalized path is used
4. Claude returns what matters today and which names deserve attention

That is a much stronger product experience than raw stateless tool calls because the user can choose generic or personalized analysis without ambiguity.

## Explicit V1 Scope

### In Scope

- named watchlists
- one active thesis record per instrument
- one default user profile
- workspace-aware skills:
  - `/setup-market-workspace`
  - `/update-market-workspace`
  - `/watchlist-brief`
  - `/watchlist-review`
- local JSON persistence behind a storage abstraction

### Out of Scope

- portfolio holdings
- P&L
- broker connectivity
- trade blotter features
- push alerts
- sidecar UX
- MCP resources
- scheduled automations
- multi-user or collaboration support

## Technical Design

### 1. Module Shape

Implement a new module:

- `src/modules/workspace/`

Follow the standard repo pattern:

- `index.ts`
- `client.ts`
- `__tests__/client.test.ts`
- additional test files for storage and handlers as needed

The module should expose stateful tools while keeping storage details hidden behind `client.ts`.

### 2. Canonical Instrument Identity

All symbols must be resolved through `src/shared/resolver.ts` before being written.

Stored instrument records should include:

- `full`
- `ticker`
- `exchange`
- `isCrypto`
- `input`

Rules:

- `full` is the storage key for thesis records
- watchlists store resolved instrument records, not raw symbols
- read responses return both resolved fields and human-friendly input

This is a hard requirement. Raw symbol-only storage would create ambiguity across exchanges and asset classes.

### 3. Storage Backend

Default backend:

- local JSON file at `~/.stock-scanner-mcp/workspace.json`

Configuration override:

- `--data-dir`
- `STOCK_SCANNER_DATA_DIR`

The backend should sit behind a small storage interface so the repo can move to SQLite later if needed.

The config layer should be extended explicitly for this feature:

- `Config.enableWorkspace: boolean`
- `Config.dataDir?: string`
- `process.env.STOCK_SCANNER_DATA_DIR`

Path precedence should be explicit:

- `--data-dir` wins over `STOCK_SCANNER_DATA_DIR`
- `STOCK_SCANNER_DATA_DIR` wins over the default home-directory path

Repo-fit requirement:

- refactor module construction so the workspace module can be gated on full parsed config, not only `env`
- the workspace module should become a first-class module in registration, but only when `config.enableWorkspace` is true

### 4. WorkspaceStore Abstraction

V1 should introduce a `WorkspaceStore` interface immediately, even though the first backend is JSON.

Reason:

- tool handlers should not depend on file I/O details
- the JSON backend should be replaceable later without rewriting tool logic
- tests become easier because tool behavior can be validated against a store contract
- a later SQLite migration becomes a backend swap rather than a module rewrite

The architectural rule should be:

- workspace tools talk to `WorkspaceStore`
- `WorkspaceStore` owns persistence operations
- backend-specific code stays out of MCP tool handlers

Recommended file layout:

- `src/modules/workspace/types.ts`
- `src/modules/workspace/client.ts`
- `src/modules/workspace/json-store.ts`
- later `src/modules/workspace/sqlite-store.ts`

`client.ts` should act as the public store façade and creation point:

- export the `WorkspaceStore` interface
- export `createWorkspaceStore(config)`
- hide backend selection details from tool handlers

Recommended interface shape:

```ts
export interface WorkspaceStore {
  getProfile(): Promise<WorkspaceProfile>;
  updateProfile(input: UpdateProfileInput): Promise<WorkspaceProfile>;

  listWatchlists(): Promise<WatchlistSummary[]>;
  getWatchlist(id: string): Promise<Watchlist | null>;
  createWatchlist(input: CreateWatchlistInput): Promise<Watchlist>;
  updateWatchlist(input: UpdateWatchlistInput): Promise<Watchlist>;

  getThesis(full: string): Promise<ThesisRecord | null>;
  saveThesis(input: SaveThesisInput): Promise<ThesisRecord>;
  listDueReviews(asOf: string): Promise<ThesisRecord[]>;
}
```

`UpdateWatchlistInput` should model explicit operations such as `add`, `remove`, and `replace` rather than forcing skills to load and rewrite the full workspace object.

The first implementation should be:

- `JsonWorkspaceStore`

Future implementation:

- `SqliteWorkspaceStore`

The module factory should use a small creation function, for example:

```ts
const store = createWorkspaceStore(config);
```

For V1, that factory can always return `JsonWorkspaceStore`, but the calling code should not depend on that fact.

### 5. Storage Safety Requirements

JSON is acceptable for V1 only if the implementation includes:

- `schemaVersion`
- zod validation on every load
- migration entry point for future schema changes
- atomic write using temp file plus rename
- one-process write serialization
- corruption recovery using a backup copy

Cross-process locking is out of scope for V1 and should be documented as a limitation.

### 6. Versioning and Migration Strategy

Workspace data versioning must be treated separately from npm package versioning.

There are three upgrade surfaces:

1. **Server package version**
   Users who run `npx -y stock-scanner-mcp` will typically get the latest published server version the next time the client starts the MCP server.

2. **Workspace data schema version**
   Local workspace data must include its own `schemaVersion` and be migrated independently of the npm version.

3. **Installed skills**
   Skills copied into `~/.claude/skills/` do not auto-update with npm. Users must reinstall them when skill behavior changes materially.

Compatibility model for V1 and beyond:

- skills must depend on the workspace tool API, not on the persisted storage schema
- workspace schema migrations must remain invisible to skills
- changing `schemaVersion` must not by itself require reinstalling skills
- skills should only need reinstall when the skill text or the skill-facing tool contract changes materially

Recommended user-side upgrade story:

- server code upgrades on next `npx` launch or explicit package reinstall
- local workspace data upgrades automatically on startup via schema migrations
- skills upgrade when the user reruns the skill installer

Required migration behavior on startup:

1. open the existing workspace backend
2. read stored `schemaVersion`
3. run migrations incrementally until the current schema is reached
4. validate migrated data with zod
5. write the upgraded result atomically
6. preserve a backup before destructive migration steps

If migration fails:

- do not destroy the last known good state
- restore or preserve the backup
- surface a clear error
- prefer failing closed over silently corrupting user state

Recommended versioning rules:

- additive field changes should go through normal schema migration
- incompatible storage changes should increment `schemaVersion`
- npm major versions should be reserved for user-visible breaking changes, not routine schema additions
- slash command names should remain stable within a major version; if a rename is unavoidable, keep a compatibility alias for at least one transition release
- skill-facing tool names and input contracts should remain backward-compatible within minor versions; if a contract must change, keep a compatibility path for at least one transition release and document that users should reinstall skills

### 6.1 Skill-to-Workspace Compatibility Contract

The critical distinction is:

- `schemaVersion` governs the on-disk workspace format
- the skill-facing workspace tool API governs compatibility with installed skills

Skills should never care whether the backend is JSON or SQLite, and they should never inspect `schemaVersion` directly.

For implementation purposes, the workspace feature should have an internal tool-API compatibility policy:

- keep workspace tool names stable within a major version
- keep required arguments stable within a major version
- make new fields additive whenever possible
- prefer adding optional parameters over changing existing required ones
- if a tool must be replaced or renamed, keep an alias or compatibility handler for at least one transition release

Operational rule:

- a newer server must continue to support older installed skills across patch and minor releases
- a workspace data migration must not break an older skill if that skill still uses supported tool contracts

What happens when users do not reinstall skills:

- old skills should continue to work as long as they target still-supported workspace tools
- they simply will not expose newly added commands or new workflow behavior until reinstalled
- if a future major release introduces a true breaking skill/tool mismatch, release notes and docs must tell users to rerun the skill installer

This policy is more important than trying to make copied skill files auto-update.

### 7. JSON-to-SQLite Evolution Path

V1 should ship with JSON only.

SQLite should not be introduced until the product actually needs:

- concurrent write safety across sessions
- heavier append/history usage
- richer local queries
- automation-driven reads and writes
- sidecar or UI-heavy state access

When SQLite is introduced, it should be done behind the existing `WorkspaceStore` interface.

Recommended migration path:

1. keep `JsonWorkspaceStore` for existing users
2. add `SqliteWorkspaceStore`
3. add backend selection in config, for example `json` or `sqlite`
4. if JSON exists and SQLite is selected for the first time, import JSON into SQLite
5. preserve the original JSON as a backup
6. do not force all users onto SQLite immediately

This keeps V1 simple while avoiding a dead-end storage design.

### 8. V1 Data Model

The schema should stay simple:

```ts
const WorkspaceSchema = z.object({
  schemaVersion: z.number().default(1),
  profile: z.object({
    tradingStyle: z.string().optional(),
    focusNote: z.string().optional(),
    defaultExchange: z.string().default("NASDAQ"),
    assetFocus: z.array(z.string()).default([]),
    preferredTimeframe: z.string().optional(),
    workflowCadence: z.enum(["daily", "weekly"]).default("daily"),
    updatedAt: z.string(),
  }).default({
    defaultExchange: "NASDAQ",
    assetFocus: [],
    workflowCadence: "daily",
    updatedAt: new Date(0).toISOString(),
  }),
  watchlists: z.record(z.object({
    name: z.string(),
    instruments: z.array(z.object({
      full: z.string(),
      ticker: z.string(),
      exchange: z.string().optional(),
      isCrypto: z.boolean(),
      input: z.string(),
      note: z.string().optional(),
      addedAt: z.string(),
    })).default([]),
    createdAt: z.string(),
    updatedAt: z.string(),
  })).default({}),
  theses: z.record(z.object({
    full: z.string(),
    ticker: z.string(),
    exchange: z.string().optional(),
    isCrypto: z.boolean(),
    input: z.string(),
    summary: z.string(),
    bullCase: z.string().optional(),
    bearCase: z.string().optional(),
    catalyst: z.string().optional(),
    invalidation: z.string().optional(),
    timeframe: z.string().optional(),
    nextReviewDate: z.string().optional(),
    confidence: z.number().min(0).max(5).optional(),
    updatedAt: z.string(),
    archivedAt: z.string().optional(),
  })).default({}),
});
```

Important simplifications for V1:

- one profile only
- one active thesis per instrument
- no thesis history
- no portfolio table
- no tag system yet

Watchlist identity rules for V1:

- the record key in `watchlists` is the canonical immutable watchlist `id`
- `name` is the mutable display label
- `id` should be returned in API responses, but it does not need to be duplicated in persisted JSON
- watchlist ids should be normalized to lowercase kebab-case

### 9. Tool Surface

Keep the first tool set small and directly useful:

- `workspace_create_watchlist`
- `workspace_list_watchlists`
- `workspace_get_watchlist`
- `workspace_update_watchlist`
- `workspace_save_thesis`
- `workspace_get_thesis`
- `workspace_list_due_reviews`
- `workspace_get_profile`
- `workspace_update_profile`

Why this set:

- enough to create and maintain workspace state
- enough for skills to consume
- avoids premature CRUD explosion

`workspace_list_watchlists` should return lightweight summaries.

`workspace_get_watchlist` should return one watchlist with full resolved instrument details.

`workspace_update_watchlist` should support explicit operations:

- `add`
- `remove`
- `replace`

This avoids fragile read-modify-write logic inside skills and gives `/update-market-workspace` a stable primitive for edits.

Watchlist mutation invariants:

- watchlist `id` is immutable after creation
- watchlist `name` is mutable
- instrument uniqueness is determined by canonical `full`
- `add` is idempotent: adding an existing `full` does not duplicate it
- `remove` is idempotent: removing a missing `full` returns the watchlist unchanged
- `replace` fully replaces the instrument set for that watchlist
- updating a nonexistent watchlist returns a clear `NOT_FOUND` error

Suggested create contract:

- `workspace_create_watchlist` accepts a canonical `id` and a display `name`
- if `name` is omitted, it defaults to the `id`

Defer delete/archive-heavy management until there is real usage feedback, except soft archive within thesis save/update.

### 10. Skill Design

User-facing workflows in V1 should be skills, not MCP prompts.

Reason:

- skills are already the repo's customer-facing workflow model
- skills are installed as slash commands in Claude Code
- skills are easier to review and maintain as Markdown than prompt text embedded in TypeScript
- these workspace flows are multi-step and conversational, which fits skills better than server-registered prompt templates

The implementation pattern should be:

- user types a slash command
- Claude loads the corresponding `SKILL.md`
- the skill asks the user for missing information
- the skill calls `workspace_*` tools to read and write state

#### `/setup-market-workspace`

Purpose:

- gather setup inputs and create the initial workspace state

Expected flow:

1. ask what kind of user they are
2. ask which names or assets to save first
3. ask whether they want daily or weekly review
4. ask one follow-up only when an asset is ambiguous
5. call workspace tools and confirm what was saved

#### `/update-market-workspace`

Purpose:

- edit the saved workspace after initial setup

Expected uses:

- create a second watchlist after the initial `core` setup
- rename an existing watchlist display name
- add or remove names from the saved watchlist
- update review cadence or profile notes
- clarify or change mapped assets such as gold and silver
- adjust the tracked focus without rerunning full setup

This command should prefer targeted tool calls over full workspace replacement.

#### `/watchlist-brief`

Purpose:

- read `core` or selected watchlist
- combine saved workspace context with current price action, macro calendar, earnings, and sentiment tools
- produce a concise routine-oriented daily brief

Watchlist selection rule:

- if the user specifies a watchlist, use it
- otherwise use `core` if it exists
- otherwise, if exactly one watchlist exists, use that watchlist
- otherwise ask the user once which watchlist to use

#### `/watchlist-review`

Purpose:

- summarize a selected watchlist
- call out names with upcoming events, stale theses, or missing context

Watchlist selection should follow the same fallback rule as `/watchlist-brief`.

If the user does not specify a watchlist, default to `core`.

Recommended file layout:

- `skills/workspace/setup-market-workspace/SKILL.md`
- `skills/workspace/update-market-workspace/SKILL.md`
- `skills/workspace/watchlist-brief/SKILL.md`
- `skills/workspace/watchlist-review/SKILL.md`

### 11. Server Integration Requirements

There is one necessary shared change before workspace tools can ship correctly:

- the server currently registers every tool with `readOnlyHint: true`

V1 therefore needs a small platform adjustment:

- extend `ToolDefinition` to allow per-tool annotations, or at minimum a `readOnly` flag
- keep existing tools read-only by default
- mark workspace mutation tools as non-read-only

This is a small change and should happen before the module is integrated.

### 12. Why MCP Prompts Are Not Part of V1

MCP prompts should not be part of the main V1 design.

Reason:

- they are not the primary user-facing workflow mechanism in this repo
- keeping long workflow text in `src/index.ts` is harder to maintain than Markdown skills
- adding both skills and prompts for the same flow would duplicate logic and create confusion

If cross-client prompt support becomes important later, prompts can be added as a thin compatibility layer after the skill-based workflow is proven.

### 13. Why Resources Are Deferred

MCP resources should not be part of V1.

Reason:

- the current server already registers tools, but a resource layer is not yet part of the implementation model
- resources are helpful, but they are not required to prove the product concept

The correct order is:

1. safe storage
2. workspace tools
3. workspace-aware skills
4. resources later if usage justifies them

## Delivery Plan

### Phase 1: Foundation

- add workspace config flags
- implement `WorkspaceStore` plus JSON backend
- implement schema versioning and migration hooks
- add tool annotation support for mutable tools

### Phase 2: Core Workspace

- implement watchlists
- implement thesis records
- implement profile/defaults
- add tests for storage, handlers, and registration
- add migration coverage for: fresh file, prior schema version, corrupted file, and backup restore path
- update README and skills docs once command names and tool counts are final

### Phase 3: Personalized Workflows

- add `/setup-market-workspace`
- add `/update-market-workspace`
- add `/watchlist-brief`
- add `/watchlist-review`
- connect skills directly to `workspace_*` tools

## Feasibility Check Against Current Repo

This plan is feasible because it builds on things the repo already has:

- modular tool-based architecture
- shared ticker resolution
- installed skill workflows
- testing conventions for module isolation

The only notable platform gaps are:

- mutable tool annotations
- workspace config parsing

Both are small and well-scoped.

The plan also avoids features that would create disproportionate complexity in V1:

- resource registration
- concurrent multi-process state
- portfolio pricing and reconciliation
- sidecar UX work

## Success Criteria for V1

V1 is successful if a user can:

1. set up a workspace in one session
2. return in a later session without re-explaining their tracked names
3. choose between generic `/morning-briefing` and personalized `/watchlist-brief`
4. review which theses need attention
5. update their saved workspace without rerunning setup

If those five things work well, the product direction is validated.

## Review Questions

1. Is the V1 scope narrow enough, or should one of the four skills move to phase 2?
2. Is soft archive for thesis records enough for V1, or is a separate archive tool required?
