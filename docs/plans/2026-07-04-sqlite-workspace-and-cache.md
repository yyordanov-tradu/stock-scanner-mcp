# SQLite Workspace and Persistent Cache Implementation Plan

**Date:** 2026-07-04
**Status:** Draft for review
**Author:** Antigravity (AI Architect)

---

## 1. Executive Summary

The current application uses a monolithic `workspace.json` file for storing profile settings, watchlists, and investment theses. Reads and writes require loading and saving the entire database, which raises performance and scalability concerns. Furthermore, the caching system is in-memory and volatile, which leads to immediate data loss and API rate-limiting issues when running the MCP server ephemerally (e.g., via `npx`).

This plan introduces local **SQLite** storage using the native `node:sqlite` package (supported natively in Node.js >= 22.5.0, without external binary compilation). SQLite will handle watchlists, instruments, and theses in separate relational tables. Additionally, we will introduce a persistent and shared caching table to reuse fetched API payloads across process runs and between the stdio MCP and REST sidecar servers.

---

## 2. Product Scope

### In Scope
- Setup a lightweight, zero-dependency database manager at `src/shared/db.ts` utilizing Node's built-in `node:sqlite` module.
- Design relational tables for:
  - `workspace_profile` (profile configuration, singleton row)
  - `workspace_watchlists` (list metadata)
  - `workspace_watchlist_instruments` (watch list symbols)
  - `workspace_theses` (investment summary and bull/bear cases)
  - `shared_cache` (caching table: keys, response JSON, TTL milliseconds)
- Migrate the workspace module implementation to execute SQL commands rather than reading/writing monolithic JSON files.
- Replace the in-memory cache in `src/shared/cache.ts` with a SQLite-backed persistent cache client that automatically cleans expired keys.
- Ensure backwards compatibility by automatically importing existing `workspace.json` files on startup if present, then archiving the old file.

### Out of Scope
- Migrating to heavy external ORMs (e.g., Prisma, TypeORM) to prevent bundle-size creep.
- Remote SQL database synchronization in this phase.

---

## 3. Database Schema

The database will be stored as `workspace.db` under the configured data directory (default: `~/.stock-scanner-mcp/`).

```sql
-- Profile table (singleton constraint)
CREATE TABLE IF NOT EXISTS workspace_profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  default_exchange TEXT NOT NULL DEFAULT 'NASDAQ',
  trading_style TEXT,
  asset_focus TEXT NOT NULL DEFAULT '[]', -- JSON stringified array
  preferred_timeframe TEXT,
  workflow_cadence TEXT NOT NULL DEFAULT 'daily',
  updated_at TEXT NOT NULL
);

-- Watchlists table
CREATE TABLE IF NOT EXISTS workspace_watchlists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Watchlist Instruments table
CREATE TABLE IF NOT EXISTS workspace_watchlist_instruments (
  watchlist_id TEXT NOT NULL,
  full TEXT NOT NULL,
  ticker TEXT NOT NULL,
  exchange TEXT,
  is_crypto INTEGER NOT NULL CHECK (is_crypto IN (0, 1)),
  input TEXT NOT NULL,
  added_at TEXT NOT NULL,
  PRIMARY KEY (watchlist_id, full),
  FOREIGN KEY (watchlist_id) REFERENCES workspace_watchlists(id) ON DELETE CASCADE
);

-- Theses table
CREATE TABLE IF NOT EXISTS workspace_theses (
  full TEXT PRIMARY KEY,
  ticker TEXT NOT NULL,
  exchange TEXT,
  is_crypto INTEGER NOT NULL CHECK (is_crypto IN (0, 1)),
  input TEXT NOT NULL,
  summary TEXT NOT NULL,
  bull_case TEXT,
  bear_case TEXT,
  catalyst TEXT,
  invalidation TEXT,
  timeframe TEXT,
  next_review_date TEXT,
  confidence INTEGER CHECK (confidence BETWEEN 0 AND 5),
  updated_at TEXT NOT NULL,
  archived_at TEXT
);

-- Shared persistent cache table
CREATE TABLE IF NOT EXISTS shared_cache (
  cache_key TEXT PRIMARY KEY,
  value TEXT NOT NULL, -- JSON stringified response data
  expires_at INTEGER NOT NULL, -- UNIX timestamp in ms
  source TEXT NOT NULL,
  data_delay TEXT
);
CREATE INDEX IF NOT EXISTS idx_cache_expiry ON shared_cache (expires_at);
```

---

## 4. Technical Implementation Details

### Native SQLite Connection
Using the stable `DatabaseSync` class in Node.js:
```typescript
import { DatabaseSync } from "node:sqlite";
import * as path from "node:path";
import * as fs from "node:fs";

export class DatabaseManager {
  private db: DatabaseSync;

  constructor(dataDir: string) {
    fs.mkdirSync(dataDir, { recursive: true });
    const dbPath = path.join(dataDir, "workspace.db");
    this.db = new DatabaseSync(dbPath);
    this.initializeSchema();
  }

  private initializeSchema() {
    // Run schema creation DDL
  }
}
```

### Persistent Cache Adapter
Modify `src/shared/cache.ts` to delegate to SQLite:
```typescript
export class SQLiteCache {
  private db: any; // DatabaseSync wrapper

  constructor(db: any) {
    this.db = db;
  }

  get(key: string): any | undefined {
    // 1. Clean up expired rows occasionally
    // 2. Query cache row
    // 3. Parse and return JSON value if timestamp is valid
  }

  set(key: string, value: any, ttlMs: number): void {
    // Insert or replace in shared_cache
  }
}
```

---

## 5. File Changes

### New Files
- `src/shared/db.ts` — Connection setup, schema definition, and migration checks.

### Modified Files
- `src/shared/cache.ts` — Adapt cache interface to read/write from `shared_cache` SQLite table.
- `src/modules/workspace/storage.ts` — Rewrite database transactions using SQL queries.
- `src/modules/workspace/index.ts` — Instantiate DB manager and feed it to the storage controller.
- `package.json` — Remove dependency on `proper-lockfile` (optional, as locking is now managed by SQLite's transaction model).
- `vitest.config.ts` — Setup memory-database testing for unit tests.

---

## 6. Verification and Testing Plan

### Automated Unit Tests
- Database Migrations: Mock a legacy `workspace.json` file, initialize the SQLite database manager, and verify all profiles, watchlists, and theses are correctly loaded into SQLite and that the old file is backed up as `workspace.json.bak`.
- Concurrency & Transactions: Write multithreaded/async parallel tests updating watchlists, ensuring SQLite's write serialization functions properly without deadlocks.
- Persistent Cache: Store a key, restart the test environment, and verify the key is successfully recovered from the SQLite cache.

### Manual Verification
- Deploy and verify database generation in `~/.stock-scanner-mcp/workspace.db`.
- Run sidecar health check and inspect SQLite files.
