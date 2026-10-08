import { DatabaseSync } from "node:sqlite";
import * as path from "node:path";
import * as fs from "node:fs";

export class DatabaseManager {
  private db: DatabaseSync;

  constructor(dataDir: string, dbPathOverride?: string) {
    if (!dbPathOverride) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const dbPath = dbPathOverride || path.join(dataDir, "workspace.db");
    if (fs.existsSync(dbPath)) {
      const stat = fs.lstatSync(dbPath);
      if (stat.isSymbolicLink()) {
        throw new Error(`Refusing to operate on symlink: ${dbPath}`);
      }
    }
    const dbExists = fs.existsSync(dbPath);
    this.db = new DatabaseSync(dbPath);
    this.initializeSchema();

    // If db didn't exist, check for legacy migration
    if (!dbExists && !dbPathOverride) {
      const legacyPath = path.join(dataDir, "workspace.json");
      if (fs.existsSync(legacyPath)) {
        try {
          this.migrateLegacyData(legacyPath);
        } catch (e) {
          console.error(`[db] Legacy migration failed: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }
  }

  private initializeSchema() {
    this.db.exec("PRAGMA foreign_keys = ON;");
    
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS workspace_profile (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        default_exchange TEXT NOT NULL DEFAULT 'NASDAQ',
        trading_style TEXT,
        asset_focus TEXT NOT NULL DEFAULT '[]',
        preferred_timeframe TEXT,
        workflow_cadence TEXT NOT NULL DEFAULT 'daily',
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS workspace_watchlists (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

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

      CREATE TABLE IF NOT EXISTS shared_cache (
        cache_key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        source TEXT NOT NULL,
        data_delay TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_cache_expiry ON shared_cache (expires_at);
    `);
  }

  private migrateLegacyData(legacyPath: string) {
    const raw = fs.readFileSync(legacyPath, "utf8");
    let data: any;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      throw new Error(`Legacy workspace.json is corrupted: ${e instanceof Error ? e.message : String(e)}`);
    }
    
    // 1. Migrate profile
    if (data.profile) {
      const p = data.profile;
      const stmt = this.db.prepare(`
        INSERT INTO workspace_profile (id, default_exchange, trading_style, asset_focus, preferred_timeframe, workflow_cadence, updated_at)
        VALUES (1, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        p.defaultExchange || "NASDAQ",
        p.tradingStyle || null,
        JSON.stringify(p.assetFocus || []),
        p.preferredTimeframe || null,
        p.workflowCadence || "daily",
        p.updatedAt || new Date().toISOString()
      );
    }

    // 2. Migrate watchlists & instruments
    if (data.watchlists) {
      const watchlistInsert = this.db.prepare(`
        INSERT INTO workspace_watchlists (id, name, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `);
      const instrumentInsert = this.db.prepare(`
        INSERT INTO workspace_watchlist_instruments (watchlist_id, full, ticker, exchange, is_crypto, input, added_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      for (const [id, wl] of Object.entries<any>(data.watchlists)) {
        watchlistInsert.run(wl.id || id, wl.name, wl.createdAt, wl.updatedAt);
        if (Array.isArray(wl.instruments)) {
          for (const inst of wl.instruments) {
            instrumentInsert.run(
              wl.id || id,
              inst.full,
              inst.ticker,
              inst.exchange || null,
              inst.isCrypto ? 1 : 0,
              inst.input,
              inst.addedAt
            );
          }
        }
      }
    }

    // 3. Migrate theses
    if (data.theses) {
      const thesisInsert = this.db.prepare(`
        INSERT INTO workspace_theses (full, ticker, exchange, is_crypto, input, summary, bull_case, bear_case, catalyst, invalidation, timeframe, next_review_date, confidence, updated_at, archived_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const [full, th] of Object.entries<any>(data.theses)) {
        thesisInsert.run(
          th.full || full,
          th.ticker,
          th.exchange || null,
          th.isCrypto ? 1 : 0,
          th.input,
          th.summary,
          th.bullCase || null,
          th.bearCase || null,
          th.catalyst || null,
          th.invalidation || null,
          th.timeframe || null,
          th.nextReviewDate || null,
          th.confidence !== undefined ? th.confidence : null,
          th.updatedAt,
          th.archivedAt || null
        );
      }
    }

    // Rename legacy file to .json.bak
    const bakPath = `${legacyPath}.bak`;
    fs.renameSync(legacyPath, bakPath);
    console.error(`[db] Successfully migrated legacy workspace.json to SQLite database. Backed up old file to ${bakPath}`);
  }

  getRawDb(): DatabaseSync {
    return this.db;
  }

  close() {
    this.db.close();
  }
}
