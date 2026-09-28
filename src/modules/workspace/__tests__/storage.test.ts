import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as fsSync from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { DatabaseSync } from "node:sqlite";
import { StorageManager } from "../storage.js";
import { WorkspaceSchema } from "../types.js";

const NOW = "2026-07-04T12:00:00.000Z";
const POSIX = process.platform !== "win32";

function legacyWorkspace(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    profile: { defaultExchange: "NYSE", tradingStyle: "swing", assetFocus: ["equities"], workflowCadence: "weekly", updatedAt: NOW },
    watchlists: {
      core: {
        id: "core",
        name: "Core",
        instruments: [
          { full: "NASDAQ:AAPL", ticker: "AAPL", exchange: "NASDAQ", isCrypto: false, input: "AAPL", note: "keep", addedAt: NOW },
        ],
        createdAt: NOW,
        updatedAt: NOW,
      },
    },
    theses: {
      "NASDAQ:AAPL": { full: "NASDAQ:AAPL", ticker: "AAPL", exchange: "NASDAQ", isCrypto: false, input: "AAPL", summary: "bullish", confidence: 4, updatedAt: NOW },
    },
    ...overrides,
  };
}

describe("StorageManager", () => {
  let tmpDir: string;
  let manager: StorageManager;
  const managers: StorageManager[] = [];

  function make(dir = tmpDir, exchange?: string, options?: { busyTimeoutMs?: number }): StorageManager {
    const m = new StorageManager(dir, exchange, options);
    managers.push(m);
    return m;
  }

  function withRawDb<T>(fn: (db: DatabaseSync) => T): T {
    const db = new DatabaseSync(path.join(tmpDir, "workspace.db"));
    try {
      return fn(db);
    } finally {
      db.close();
    }
  }

  // A rolled-back first run leaves no tables at all; report that as zero rows.
  function countRows(table: string): number {
    return withRawDb((db) => {
      const exists = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table);
      if (!exists) return 0;
      return (db.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n;
    });
  }

  async function touchLegacy(content: unknown, ageMs = 0): Promise<void> {
    const legacyPath = path.join(tmpDir, "workspace.json");
    await fs.writeFile(legacyPath, JSON.stringify(content));
    const t = new Date(Date.now() + ageMs);
    await fs.utimes(legacyPath, t, t);
  }

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "workspace-test-"));
    manager = make();
  });

  afterEach(async () => {
    for (const m of managers.splice(0)) m.close();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("loads default data if the database does not exist", async () => {
    const { data, version } = await manager.load();
    expect(data.schemaVersion).toBe(1);
    expect(data.profile.workflowCadence).toBe("daily");
    expect(data.profile.defaultExchange).toBe("NASDAQ");
    expect(version).toBe(0);
  });

  it("does not open the database in the constructor", () => {
    expect(fsSync.existsSync(path.join(tmpDir, "workspace.db"))).toBe(false);
  });

  it("propagates defaultExchange from constructor on bootstrap", async () => {
    const nyseManager = make(path.join(tmpDir, "nyse"), "NYSE");
    const { data } = await nyseManager.load();
    expect(data.profile.defaultExchange).toBe("NYSE");
  });

  it("does NOT overwrite existing defaultExchange on load", async () => {
    const { data, version } = await manager.load();
    data.profile.defaultExchange = "NYSE";
    await manager.save(data, version);

    const reloaded = await make(tmpDir, "LSE").load();
    expect(reloaded.data.profile.defaultExchange).toBe("NYSE");
  });

  it("saves and reloads data with a monotonically increasing version", async () => {
    const { data, version } = await manager.load();
    data.profile.tradingStyle = "options";

    const v1 = await manager.save(data, version);
    expect(v1).toBe(1);

    const reloaded = await manager.load();
    expect(reloaded.data.profile.tradingStyle).toBe("options");
    expect(reloaded.version).toBe(1);

    const v2 = await manager.save(reloaded.data, reloaded.version);
    expect(v2).toBe(2);
    expect(withRawDb((db) => (db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version)).toBe(1);
  });

  it("round-trips every field including instrument notes", async () => {
    const legacy = WorkspaceSchema.parse(legacyWorkspace());
    const { version } = await manager.load();
    await manager.save(legacy, version);

    const { data } = await manager.load();
    expect(data.watchlists.core.instruments[0].note).toBe("keep");
    expect(data.theses["NASDAQ:AAPL"].confidence).toBe(4);
    expect(data.profile).toEqual(legacy.profile);
    expect(data.watchlists).toEqual(legacy.watchlists);
    expect(data.theses).toEqual(legacy.theses);
  });

  it("detects concurrent modifications (sequential stale writer)", async () => {
    const initial = await manager.load();
    await manager.save(initial.data, initial.version);

    const clientA = await manager.load();
    const clientB = await manager.load();

    clientA.data.profile.tradingStyle = "swing";
    await manager.save(clientA.data, clientA.version);

    clientB.data.profile.tradingStyle = "day";
    await expect(manager.save(clientB.data, clientB.version)).rejects.toThrow("Conflict");
    expect((await manager.load()).data.profile.tradingStyle).toBe("swing");
  });

  it("detects bootstrap race (two first writers)", async () => {
    const clientA = await manager.load();
    const clientB = await manager.load();
    expect(clientA.version).toBe(0);
    expect(clientB.version).toBe(0);

    clientA.data.profile.tradingStyle = "client-a";
    await manager.save(clientA.data, clientA.version);

    clientB.data.profile.tradingStyle = "client-b";
    await expect(manager.save(clientB.data, clientB.version)).rejects.toThrow("already initialized");
  });

  it("rejects non-integer or negative expected versions without writing", async () => {
    const { data, version } = await manager.load();
    await manager.save(data, version);
    for (const bad of [Number.NaN, -1, 0.5, Number.POSITIVE_INFINITY]) {
      await expect(manager.save(data, bad)).rejects.toThrow("Conflict");
    }
    expect((await manager.load()).version).toBe(1);
  });

  it("detects the workspace being reset between load and save", async () => {
    const { data, version } = await manager.load();
    const saved = await manager.save(data, version);
    const loaded = await manager.load();

    withRawDb((db) => db.exec("DELETE FROM workspace_profile"));

    loaded.data.profile.tradingStyle = "day";
    await expect(manager.save(loaded.data, saved)).rejects.toThrow("reset");
  });

  it("only one of many concurrent writers with the same snapshot succeeds", async () => {
    const initial = await manager.load();
    await manager.save(initial.data, initial.version);
    const snapshot = await manager.load();

    const results = await Promise.allSettled(
      Array.from({ length: 10 }, (_, i) => {
        const copy = WorkspaceSchema.parse(JSON.parse(JSON.stringify(snapshot.data)));
        copy.profile.tradingStyle = `writer-${i}`;
        return manager.save(copy, snapshot.version);
      }),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await manager.load()).version).toBe(2);
  });

  it("maps a database held by another process to a retryable Conflict on save", async () => {
    const busyManager = make(tmpDir, undefined, { busyTimeoutMs: 50 });
    const { data, version } = await busyManager.load();

    const other = new DatabaseSync(path.join(tmpDir, "workspace.db"));
    other.exec("BEGIN IMMEDIATE");
    try {
      await expect(busyManager.save(data, version)).rejects.toThrow("Conflict: The workspace is locked");
    } finally {
      other.exec("ROLLBACK");
      other.close();
    }
    expect(await busyManager.save(data, version)).toBe(1);
  });

  it("maps a database held by another process during first-run migration to a Conflict, then migrates once", async () => {
    await touchLegacy(legacyWorkspace());
    const first = await manager.load();
    expect(first.version).toBe(1);

    const other = new DatabaseSync(path.join(tmpDir, "workspace.db"));
    other.exec("BEGIN IMMEDIATE");
    const busyManager = make(tmpDir, undefined, { busyTimeoutMs: 50 });
    try {
      await expect(busyManager.load()).rejects.toThrow("Conflict: The workspace is locked");
    } finally {
      other.exec("ROLLBACK");
      other.close();
    }
    expect((await busyManager.load()).version).toBe(1);
    expect(countRows("workspace_theses")).toBe(1);
  });

  it("load() rejects when workspace.db is a symlink", async () => {
    await fs.writeFile(path.join(tmpDir, "target.db"), "");
    await fs.symlink(path.join(tmpDir, "target.db"), path.join(tmpDir, "workspace.db"));
    await expect(manager.load()).rejects.toThrow("symlink");
  });

  it("load() rejects when legacy workspace.json is a symlink", async () => {
    await fs.writeFile(path.join(tmpDir, "target.json"), JSON.stringify(legacyWorkspace()));
    await fs.symlink(path.join(tmpDir, "target.json"), path.join(tmpDir, "workspace.json"));
    await expect(manager.load()).rejects.toThrow("symlink");
  });

  it("load() throws a descriptive error for corrupted legacy JSON and leaves it untouched", async () => {
    await fs.writeFile(path.join(tmpDir, "workspace.json"), "{ not valid json !!!", "utf-8");
    await expect(manager.load()).rejects.toThrow("corrupted");
    expect(await fs.readFile(path.join(tmpDir, "workspace.json"), "utf-8")).toBe("{ not valid json !!!");
    expect(countRows("workspace_profile")).toBe(0);
  });

  it("load() throws a descriptive error for schema-invalid legacy JSON", async () => {
    await fs.writeFile(path.join(tmpDir, "workspace.json"), JSON.stringify({ schemaVersion: "not-a-number" }));
    await expect(manager.load()).rejects.toThrow("invalid");
  });

  it("load() throws a descriptive error for a corrupted asset_focus column", async () => {
    const { data, version } = await manager.load();
    await manager.save(data, version);
    withRawDb((db) => db.exec("UPDATE workspace_profile SET asset_focus = '{bad'"));
    await expect(manager.load()).rejects.toThrow("corrupted");
  });

  it("load() throws a descriptive error for rows that violate the workspace schema", async () => {
    const { data, version } = await manager.load();
    await manager.save(data, version);
    withRawDb((db) => db.exec("UPDATE workspace_profile SET workflow_cadence = 'hourly'"));
    await expect(manager.load()).rejects.toThrow("schema validation");
  });

  it("load() rejects rows whose keys are reserved instead of silently dropping them", async () => {
    const { data, version } = await manager.load();
    await manager.save(data, version);
    withRawDb((db) =>
      db.exec(`INSERT INTO workspace_watchlists (id, name, created_at, updated_at) VALUES ('__proto__', 'evil', '${NOW}', '${NOW}')`),
    );
    await expect(manager.load()).rejects.toThrow("reserved");
  });

  describe("legacy workspace.json migration", () => {
    it("imports profile, watchlists, instruments (with notes) and theses, keeping the JSON file", async () => {
      const legacyPath = path.join(tmpDir, "workspace.json");
      await fs.writeFile(legacyPath, JSON.stringify(legacyWorkspace(), null, 2));

      const { data, version } = await manager.load();
      expect(version).toBe(1);
      expect(data.profile.defaultExchange).toBe("NYSE");
      expect(data.profile.tradingStyle).toBe("swing");
      expect(data.watchlists.core.instruments[0].note).toBe("keep");
      expect(data.theses["NASDAQ:AAPL"].confidence).toBe(4);

      expect(fsSync.existsSync(legacyPath)).toBe(true);
      expect(fsSync.existsSync(`${legacyPath}.bak`)).toBe(false);
      expect(countRows("workspace_theses")).toBe(1);
    });

    it("is all-or-nothing: an invalid record imports nothing, keeps the JSON, and retries once fixed", async () => {
      const legacyPath = path.join(tmpDir, "workspace.json");
      const broken = legacyWorkspace();
      (broken.theses as Record<string, unknown>)["NASDAQ:BAD"] = {
        full: "NASDAQ:BAD", ticker: "BAD", isCrypto: false, input: "BAD", summary: "bad", confidence: 7, updatedAt: NOW,
      };
      await fs.writeFile(legacyPath, JSON.stringify(broken));

      await expect(manager.load()).rejects.toThrow("invalid");
      expect(countRows("workspace_profile")).toBe(0);
      expect(countRows("workspace_watchlists")).toBe(0);
      expect(countRows("workspace_theses")).toBe(0);
      expect(JSON.parse(await fs.readFile(legacyPath, "utf-8"))).toEqual(broken);

      await fs.writeFile(legacyPath, JSON.stringify(legacyWorkspace()));
      const retry = await make().load();
      expect(retry.version).toBe(1);
      expect(Object.keys(retry.data.theses)).toEqual(["NASDAQ:AAPL"]);
    });

    it("rolls back rows already written when the import fails mid-write", async () => {
      // A pre-existing stricter theses table makes the last INSERT of the import fail.
      withRawDb((db) =>
        db.exec(`CREATE TABLE workspace_theses (
          full TEXT PRIMARY KEY, ticker TEXT NOT NULL, exchange TEXT, is_crypto INTEGER NOT NULL, input TEXT NOT NULL,
          summary TEXT NOT NULL CHECK (length(summary) < 3), bull_case TEXT, bear_case TEXT, catalyst TEXT, invalidation TEXT,
          timeframe TEXT, next_review_date TEXT, confidence INTEGER, updated_at TEXT NOT NULL, archived_at TEXT
        )`),
      );
      await fs.writeFile(path.join(tmpDir, "workspace.json"), JSON.stringify(legacyWorkspace()));

      await expect(manager.load()).rejects.toThrow("CHECK constraint");
      expect(countRows("workspace_profile")).toBe(0);
      expect(countRows("workspace_watchlists")).toBe(0);
      expect(countRows("workspace_watchlist_instruments")).toBe(0);
      expect(countRows("workspace_theses")).toBe(0);
    });

    it("rejects legacy files with reserved keys instead of importing them", async () => {
      const evil = JSON.stringify({ id: "__proto__", name: "evil", instruments: [], createdAt: NOW, updatedAt: NOW });
      const json = JSON.stringify(legacyWorkspace()).replace('"watchlists":{', `"watchlists":{"__proto__":${evil},`);
      expect(Object.keys(JSON.parse(json).watchlists)).toContain("__proto__");
      await fs.writeFile(path.join(tmpDir, "workspace.json"), json);

      await expect(manager.load()).rejects.toThrow("reserved");
      expect(countRows("workspace_profile")).toBe(0);
    });

    it("runs at most once: a second manager sees the migrated rows and does not re-import", async () => {
      await fs.writeFile(path.join(tmpDir, "workspace.json"), JSON.stringify(legacyWorkspace()));
      const first = await manager.load();
      first.data.profile.tradingStyle = "changed-after-migration";
      await manager.save(first.data, first.version);

      const second = await make().load();
      expect(second.version).toBe(2);
      expect(second.data.profile.tradingStyle).toBe("changed-after-migration");
      expect(countRows("workspace_theses")).toBe(1);
    });

    it("re-imports workspace.json when it is newer than the last mirror write (older release ran)", async () => {
      const { data, version } = await manager.load();
      data.profile.tradingStyle = "from-db";
      await manager.save(data, version);

      const edited = legacyWorkspace({ profile: { defaultExchange: "NYSE", tradingStyle: "from-old-release", assetFocus: [], workflowCadence: "daily", updatedAt: NOW } });
      await touchLegacy(edited, 5_000);

      const reloaded = await make().load();
      expect(reloaded.version).toBe(2);
      expect(reloaded.data.profile.tradingStyle).toBe("from-old-release");
      expect(Object.keys(reloaded.data.theses)).toEqual(["NASDAQ:AAPL"]);
    });

    it("does not re-import a mirror it wrote itself", async () => {
      const { data, version } = await manager.load();
      data.profile.tradingStyle = "from-db";
      await manager.save(data, version);

      const reloaded = await make().load();
      expect(reloaded.version).toBe(1);
      expect(reloaded.data.profile.tradingStyle).toBe("from-db");
    });
  });

  describe("workspace.json mirror", () => {
    it("writes a schema-valid mirror on every save so older releases can still read the workspace", async () => {
      const legacyPath = path.join(tmpDir, "workspace.json");
      const { data, version } = await manager.load();
      data.profile.tradingStyle = "mirrored";
      await manager.save(data, version);

      const mirror = WorkspaceSchema.parse(JSON.parse(await fs.readFile(legacyPath, "utf-8")));
      expect(mirror.profile.tradingStyle).toBe("mirrored");
      expect(fsSync.existsSync(`${legacyPath}.tmp`)).toBe(false);
      if (POSIX) expect(fsSync.statSync(legacyPath).mode & 0o777).toBe(0o600);
    });

    it("does not fail the save when the mirror cannot be written", async () => {
      const legacyPath = path.join(tmpDir, "workspace.json");
      const { data, version } = await manager.load();
      await manager.save(data, version);

      await fs.rm(legacyPath);
      await fs.mkdir(legacyPath);
      const reloaded = await manager.load();
      reloaded.data.profile.tradingStyle = "still-saved";
      await expect(manager.save(reloaded.data, reloaded.version)).resolves.toBe(2);
      expect((await manager.load()).data.profile.tradingStyle).toBe("still-saved");
    });
  });
});
