import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { DatabaseManager } from "../db.js";

describe("DatabaseManager", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "db-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("initializes empty database schema successfully", () => {
    const dbManager = new DatabaseManager(tmpDir);
    const db = dbManager.getRawDb();
    
    // Check that tables exist
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as any[];
    const names = tables.map(t => t.name);
    
    expect(names).toContain("workspace_profile");
    expect(names).toContain("workspace_watchlists");
    expect(names).toContain("workspace_watchlist_instruments");
    expect(names).toContain("workspace_theses");
    expect(names).toContain("shared_cache");
    
    dbManager.close();
  });

  it("migrates legacy workspace.json data correctly and creates .bak file", () => {
    const legacyPath = path.join(tmpDir, "workspace.json");
    
    // Create a mock legacy workspace.json file
    const mockLegacyData = {
      schemaVersion: 1,
      profile: {
        defaultExchange: "NYSE",
        tradingStyle: "swing",
        assetFocus: ["equities", "crypto"],
        preferredTimeframe: "1D",
        workflowCadence: "weekly",
        updatedAt: "2026-07-04T12:00:00Z"
      },
      watchlists: {
        "core": {
          id: "core",
          name: "Core Watchlist",
          instruments: [
            {
              full: "NASDAQ:AAPL",
              ticker: "AAPL",
              exchange: "NASDAQ",
              isCrypto: false,
              input: "AAPL",
              addedAt: "2026-07-04T12:00:00Z"
            }
          ],
          createdAt: "2026-07-04T11:00:00Z",
          updatedAt: "2026-07-04T12:00:00Z"
        }
      },
      theses: {
        "NASDAQ:AAPL": {
          full: "NASDAQ:AAPL",
          ticker: "AAPL",
          exchange: "NASDAQ",
          isCrypto: false,
          input: "AAPL",
          summary: "AAPL looks bullish above 180",
          confidence: 4,
          updatedAt: "2026-07-04T12:00:00Z"
        }
      }
    };

    fs.writeFileSync(legacyPath, JSON.stringify(mockLegacyData, null, 2), "utf8");

    // Initialize DatabaseManager - this should trigger migration
    const dbManager = new DatabaseManager(tmpDir);
    const db = dbManager.getRawDb();

    // Verify profile migration
    const profile = db.prepare("SELECT * FROM workspace_profile WHERE id = 1").get() as any;
    expect(profile).toBeDefined();
    expect(profile.default_exchange).toBe("NYSE");
    expect(profile.trading_style).toBe("swing");
    expect(JSON.parse(profile.asset_focus)).toEqual(["equities", "crypto"]);
    expect(profile.preferred_timeframe).toBe("1D");
    expect(profile.workflow_cadence).toBe("weekly");

    // Verify watchlist migration
    const watchlist = db.prepare("SELECT * FROM workspace_watchlists WHERE id = 'core'").get() as any;
    expect(watchlist).toBeDefined();
    expect(watchlist.name).toBe("Core Watchlist");

    // Verify watchlist instrument migration
    const instrument = db.prepare("SELECT * FROM workspace_watchlist_instruments WHERE watchlist_id = 'core'").get() as any;
    expect(instrument).toBeDefined();
    expect(instrument.full).toBe("NASDAQ:AAPL");
    expect(instrument.ticker).toBe("AAPL");
    expect(instrument.exchange).toBe("NASDAQ");
    expect(instrument.is_crypto).toBe(0);

    // Verify thesis migration
    const thesis = db.prepare("SELECT * FROM workspace_theses WHERE full = 'NASDAQ:AAPL'").get() as any;
    expect(thesis).toBeDefined();
    expect(thesis.summary).toBe("AAPL looks bullish above 180");
    expect(thesis.confidence).toBe(4);

    // Verify backup file creation
    expect(fs.existsSync(legacyPath)).toBe(false);
    expect(fs.existsSync(`${legacyPath}.bak`)).toBe(true);

    dbManager.close();
  });
});
