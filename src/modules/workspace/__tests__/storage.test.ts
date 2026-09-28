import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as fsSync from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { DatabaseSync } from "node:sqlite";
import { StorageManager } from "../storage.js";
import { WorkspaceSchema } from "../types.js";

const NOW = "2026-07-04T12:00:00.000Z";

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

  // A rolled-back first run leaves no tables at all; report that as zero rows.
  function countRows(table: string): number {
    const db = new DatabaseSync(path.join(tmpDir, "workspace.db"));
    try {
      const exists = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table);
      if (!exists) return 0;
      return (db.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n;
    } finally {
      db.close();
    }
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
    const { data, lastModified } = await manager.load();
    expect(data.schemaVersion).toBe(1);
    expect(data.profile.workflowCadence).toBe("daily");
    expect(data.profile.defaultExchange).toBe("NASDAQ");
    expect(lastModified).toBe(0);
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
    const { data, lastModified } = await manager.load();
    data.profile.defaultExchange = "NYSE";
    await manager.save(data, lastModified);

    const reloaded = await make(tmpDir, "LSE").load();
    expect(reloaded.data.profile.defaultExchange).toBe("NYSE");
  });

  it("saves and reloads data with a monotonically increasing version", async () => {
    const { data, lastModified } = await manager.load();
    data.profile.tradingStyle = "options";

    const v1 = await manager.save(data, lastModified);
    expect(v1).toBe(1);

    const reloaded = await manager.load();
    expect(reloaded.data.profile.tradingStyle).toBe("options");
    expect(reloaded.lastModified).toBe(1);

    const v2 = await manager.save(reloaded.data, reloaded.lastModified);
    expect(v2).toBe(2);
  });

  it("round-trips every field including instrument notes", async () => {
    const legacy = WorkspaceSchema.parse(legacyWorkspace());
    const { lastModified } = await manager.load();
    await manager.save(legacy, lastModified);

    const { data } = await manager.load();
    expect(data.watchlists.core.instruments[0].note).toBe("keep");
    expect(data.theses["NASDAQ:AAPL"].confidence).toBe(4);
    expect(data.profile).toEqual(legacy.profile);
    expect(data.watchlists).toEqual(legacy.watchlists);
    expect(data.theses).toEqual(legacy.theses);
  });

  it("detects concurrent modifications (sequential stale writer)", async () => {
    const initial = await manager.load();
    await manager.save(initial.data, initial.lastModified);

    const clientA = await manager.load();
    const clientB = await manager.load();

    clientA.data.profile.tradingStyle = "swing";
    await manager.save(clientA.data, clientA.lastModified);

    clientB.data.profile.tradingStyle = "day";
    await expect(manager.save(clientB.data, clientB.lastModified)).rejects.toThrow("Conflict");
    expect((await manager.load()).data.profile.tradingStyle).toBe("swing");
  });

  it("detects bootstrap race (two first writers)", async () => {
    const clientA = await manager.load();
    const clientB = await manager.load();
    expect(clientA.lastModified).toBe(0);
    expect(clientB.lastModified).toBe(0);

    clientA.data.profile.tradingStyle = "client-a";
    await manager.save(clientA.data, clientA.lastModified);

    clientB.data.profile.tradingStyle = "client-b";
    await expect(manager.save(clientB.data, clientB.lastModified)).rejects.toThrow("already initialized");
  });

  it("detects the workspace being reset between load and save", async () => {
    const { data, lastModified } = await manager.load();
    const version = await manager.save(data, lastModified);
    const loaded = await manager.load();

    const db = new DatabaseSync(path.join(tmpDir, "workspace.db"));
    db.exec("DELETE FROM workspace_profile");
    db.close();

    loaded.data.profile.tradingStyle = "day";
    await expect(manager.save(loaded.data, version)).rejects.toThrow("reset");
  });

  it("only one of many concurrent writers with the same snapshot succeeds", async () => {
    const initial = await manager.load();
    await manager.save(initial.data, initial.lastModified);
    const snapshot = await manager.load();

    const results = await Promise.allSettled(
      Array.from({ length: 10 }, (_, i) => {
        const copy = WorkspaceSchema.parse(JSON.parse(JSON.stringify(snapshot.data)));
        copy.profile.tradingStyle = `writer-${i}`;
        return manager.save(copy, snapshot.lastModified);
      }),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await manager.load()).lastModified).toBe(2);
  });

  it("maps a database held by another process to a retryable Conflict", async () => {
    const busyManager = make(tmpDir, undefined, { busyTimeoutMs: 50 });
    const { data, lastModified } = await busyManager.load();

    const other = new DatabaseSync(path.join(tmpDir, "workspace.db"));
    other.exec("BEGIN IMMEDIATE");
    try {
      await expect(busyManager.save(data, lastModified)).rejects.toThrow("Conflict: The workspace is locked");
    } finally {
      other.exec("ROLLBACK");
      other.close();
    }
    expect(await busyManager.save(data, lastModified)).toBe(1);
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
    const { data, lastModified } = await manager.load();
    await manager.save(data, lastModified);

    const db = new DatabaseSync(path.join(tmpDir, "workspace.db"));
    db.exec("UPDATE workspace_profile SET asset_focus = '{bad'");
    db.close();

    await expect(manager.load()).rejects.toThrow("corrupted");
  });

  it("load() throws a descriptive error for rows that violate the workspace schema", async () => {
    const { data, lastModified } = await manager.load();
    await manager.save(data, lastModified);

    const db = new DatabaseSync(path.join(tmpDir, "workspace.db"));
    db.exec("UPDATE workspace_profile SET workflow_cadence = 'hourly'");
    db.close();

    await expect(manager.load()).rejects.toThrow("schema validation");
  });

  describe("legacy workspace.json migration", () => {
    it("imports profile, watchlists, instruments (with notes) and theses, keeping the JSON file", async () => {
      const legacyPath = path.join(tmpDir, "workspace.json");
      await fs.writeFile(legacyPath, JSON.stringify(legacyWorkspace(), null, 2));

      const { data, lastModified } = await manager.load();
      expect(lastModified).toBe(1);
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
      expect(retry.lastModified).toBe(1);
      expect(Object.keys(retry.data.theses)).toEqual(["NASDAQ:AAPL"]);
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
      await manager.save(first.data, first.lastModified);

      const second = await make().load();
      expect(second.lastModified).toBe(2);
      expect(second.data.profile.tradingStyle).toBe("changed-after-migration");
      expect(countRows("workspace_theses")).toBe(1);
    });

    it("ignores a legacy file that appears after the database was initialized", async () => {
      const { data, lastModified } = await manager.load();
      data.profile.tradingStyle = "db-wins";
      await manager.save(data, lastModified);

      await fs.writeFile(path.join(tmpDir, "workspace.json"), JSON.stringify(legacyWorkspace()));
      const reloaded = await make().load();
      expect(reloaded.data.profile.tradingStyle).toBe("db-wins");
      expect(reloaded.data.profile.defaultExchange).toBe("NASDAQ");
    });
  });

  describe("workspace.json mirror", () => {
    it("writes a schema-valid mirror on every save so older releases can still read the workspace", async () => {
      const legacyPath = path.join(tmpDir, "workspace.json");
      const { data, lastModified } = await manager.load();
      data.profile.tradingStyle = "mirrored";
      await manager.save(data, lastModified);

      const mirror = WorkspaceSchema.parse(JSON.parse(await fs.readFile(legacyPath, "utf-8")));
      expect(mirror.profile.tradingStyle).toBe("mirrored");
      expect(fsSync.existsSync(`${legacyPath}.tmp`)).toBe(false);
      expect(fsSync.statSync(legacyPath).mode & 0o777).toBe(0o600);
    });

    it("does not fail the save when the mirror cannot be written", async () => {
      const legacyPath = path.join(tmpDir, "workspace.json");
      const { data, lastModified } = await manager.load();
      await manager.save(data, lastModified);

      await fs.rm(legacyPath);
      await fs.mkdir(legacyPath);
      const reloaded = await manager.load();
      reloaded.data.profile.tradingStyle = "still-saved";
      await expect(manager.save(reloaded.data, reloaded.lastModified)).resolves.toBe(2);
      expect((await manager.load()).data.profile.tradingStyle).toBe("still-saved");
    });
  });
});
