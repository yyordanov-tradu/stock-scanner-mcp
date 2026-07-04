import { DatabaseManager } from "../../shared/db.js";
import { TtlCache } from "../../shared/cache.js";
import { Workspace, WorkspaceSchema, Profile, Watchlist, Instrument, Thesis } from "./types.js";

export interface LoadResult {
  data: Workspace;
  lastModified: number;
}

export class StorageManager {
  private dbManager: DatabaseManager;
  private defaultExchange: string;
  
  constructor(dataDir: string, defaultExchange = "NASDAQ") {
    this.dbManager = new DatabaseManager(dataDir);
    this.defaultExchange = defaultExchange;
    TtlCache.setDb(this.dbManager.getRawDb());
  }

  async exists(): Promise<boolean> {
    const db = this.dbManager.getRawDb();
    const row = db.prepare("SELECT 1 FROM workspace_profile LIMIT 1").get();
    return !!row;
  }

  async load(): Promise<LoadResult> {
    const db = this.dbManager.getRawDb();
    
    // 1. Load Profile
    let profile: Profile;
    const profileRow = db.prepare("SELECT * FROM workspace_profile WHERE id = 1").get() as any;
    if (profileRow) {
      profile = {
        defaultExchange: profileRow.default_exchange,
        tradingStyle: profileRow.trading_style || undefined,
        assetFocus: JSON.parse(profileRow.asset_focus),
        preferredTimeframe: profileRow.preferred_timeframe || undefined,
        workflowCadence: profileRow.workflow_cadence as "daily" | "weekly",
        updatedAt: profileRow.updated_at,
      };
    } else {
      profile = {
        defaultExchange: this.defaultExchange,
        assetFocus: [],
        workflowCadence: "daily",
        updatedAt: new Date(0).toISOString(),
      };
    }

    const lastModified = new Date(profile.updatedAt).getTime();

    // 2. Load Watchlists & Instruments
    const watchlists: Record<string, Watchlist> = {};
    const wlRows = db.prepare("SELECT * FROM workspace_watchlists").all() as any[];
    const instRows = db.prepare("SELECT * FROM workspace_watchlist_instruments").all() as any[];

    // Group instruments by watchlist_id
    const instMap = new Map<string, Instrument[]>();
    for (const inst of instRows) {
      if (!instMap.has(inst.watchlist_id)) {
        instMap.set(inst.watchlist_id, []);
      }
      instMap.get(inst.watchlist_id)!.push({
        full: inst.full,
        ticker: inst.ticker,
        exchange: inst.exchange || undefined,
        isCrypto: inst.is_crypto === 1,
        input: inst.input,
        addedAt: inst.added_at,
      });
    }

    for (const wl of wlRows) {
      watchlists[wl.id] = {
        id: wl.id,
        name: wl.name,
        instruments: instMap.get(wl.id) || [],
        createdAt: wl.created_at,
        updatedAt: wl.updated_at,
      };
    }

    // 3. Load Theses
    const theses: Record<string, Thesis> = {};
    const thRows = db.prepare("SELECT * FROM workspace_theses").all() as any[];
    for (const th of thRows) {
      theses[th.full] = {
        full: th.full,
        ticker: th.ticker,
        exchange: th.exchange || undefined,
        isCrypto: th.is_crypto === 1,
        input: th.input,
        summary: th.summary,
        bullCase: th.bull_case || undefined,
        bearCase: th.bear_case || undefined,
        catalyst: th.catalyst || undefined,
        invalidation: th.invalidation || undefined,
        timeframe: th.timeframe || undefined,
        nextReviewDate: th.next_review_date || undefined,
        confidence: th.confidence !== null ? th.confidence : undefined,
        updatedAt: th.updated_at,
        archivedAt: th.archived_at || undefined,
      };
    }

    const data = WorkspaceSchema.parse({
      schemaVersion: 1,
      profile,
      watchlists,
      theses,
    });

    return { data, lastModified };
  }

  async save(data: Workspace, expectedLastModified: number): Promise<number> {
    const db = this.dbManager.getRawDb();

    // Begin transaction for safety and atomicity
    db.exec("BEGIN TRANSACTION;");

    try {
      // Stale writer check
      const profileRow = db.prepare("SELECT updated_at FROM workspace_profile WHERE id = 1").get() as any;
      const currentMtime = profileRow ? new Date(profileRow.updated_at).getTime() : 0;

      if (expectedLastModified === 0 && profileRow) {
        throw new Error("Conflict: The workspace was already initialized by another process. Please reload.");
      }

      if (expectedLastModified > 0) {
        if (!profileRow) {
          throw new Error("Conflict: The workspace file has been deleted. Please reload.");
        }
        if (currentMtime > expectedLastModified) {
          throw new Error("Conflict: The workspace has been modified by another process. Please reload and try again.");
        }
      }

      let newMtime = Date.now();
      if (profileRow && currentMtime >= newMtime) {
        newMtime = currentMtime + 1;
      }
      const newUpdatedAt = new Date(newMtime).toISOString();

      // 1. Save Profile
      const p = data.profile;
      const profileStmt = db.prepare(`
        INSERT OR REPLACE INTO workspace_profile (id, default_exchange, trading_style, asset_focus, preferred_timeframe, workflow_cadence, updated_at)
        VALUES (1, ?, ?, ?, ?, ?, ?)
      `);
      profileStmt.run(
        p.defaultExchange,
        p.tradingStyle || null,
        JSON.stringify(p.assetFocus),
        p.preferredTimeframe || null,
        p.workflowCadence,
        newUpdatedAt
      );

      // 2. Save Watchlists & Instruments
      // Clear existing watchlist data (foreign key ON DELETE CASCADE will clear instruments)
      db.prepare("DELETE FROM workspace_watchlists").run();

      const watchlistInsert = db.prepare(`
        INSERT INTO workspace_watchlists (id, name, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `);
      const instrumentInsert = db.prepare(`
        INSERT INTO workspace_watchlist_instruments (watchlist_id, full, ticker, exchange, is_crypto, input, added_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      for (const wl of Object.values(data.watchlists)) {
        watchlistInsert.run(wl.id, wl.name, wl.createdAt, wl.updatedAt);
        for (const inst of wl.instruments) {
          instrumentInsert.run(
            wl.id,
            inst.full,
            inst.ticker,
            inst.exchange || null,
            inst.isCrypto ? 1 : 0,
            inst.input,
            inst.addedAt
          );
        }
      }

      // 3. Save Theses
      db.prepare("DELETE FROM workspace_theses").run();

      const thesisInsert = db.prepare(`
        INSERT INTO workspace_theses (full, ticker, exchange, is_crypto, input, summary, bull_case, bear_case, catalyst, invalidation, timeframe, next_review_date, confidence, updated_at, archived_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const th of Object.values(data.theses)) {
        thesisInsert.run(
          th.full,
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

      db.exec("COMMIT;");
      return newMtime;
    } catch (e) {
      db.exec("ROLLBACK;");
      throw e;
    }
  }

  // Exposed for testing database state directly
  getRawDb() {
    return this.dbManager.getRawDb();
  }

  close() {
    if (TtlCache.getDb() === this.dbManager.getRawDb()) {
      TtlCache.setDb(null);
    }
    this.dbManager.close();
  }
}
