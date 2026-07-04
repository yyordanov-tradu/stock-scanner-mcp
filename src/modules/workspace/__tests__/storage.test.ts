import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as fsSync from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { StorageManager } from "../storage.js";

describe("StorageManager", () => {
  let tmpDir: string;
  let manager: StorageManager;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "workspace-test-"));
    manager = new StorageManager(tmpDir);
  });

  afterEach(async () => {
    // Close db connections before removing dir
    try {
      manager.close();
    } catch {}
    const { TtlCache } = await import("../../../shared/cache.js");
    TtlCache.setDb(null);
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("loads default data if database does not exist", async () => {
    const { data, lastModified } = await manager.load();
    expect(data.schemaVersion).toBe(1);
    expect(data.profile.workflowCadence).toBe("daily");
    expect(data.profile.defaultExchange).toBe("NASDAQ");
    expect(lastModified).toBe(0);
  });

  it("propagates defaultExchange from constructor on bootstrap", async () => {
    const nyseDir = path.join(tmpDir, "nyse");
    const nyseManager = new StorageManager(nyseDir, "NYSE");
    try {
      const { data } = await nyseManager.load();
      expect(data.profile.defaultExchange).toBe("NYSE");
    } finally {
      nyseManager.close();
    }
  });

  it("does NOT overwrite existing defaultExchange on load", async () => {
    const { data, lastModified } = await manager.load();
    expect(data.profile.defaultExchange).toBe("NASDAQ");
    
    // Explicitly update to NYSE
    data.profile.defaultExchange = "NYSE";
    await manager.save(data, lastModified);

    // Create a new manager with a different constructor default
    const newManager = new StorageManager(tmpDir, "LSE");
    try {
      const reloaded = await newManager.load();
      // Should still be NYSE from the database
      expect(reloaded.data.profile.defaultExchange).toBe("NYSE");
    } finally {
      newManager.close();
    }
  });

  it("saves and reloads data", async () => {
    const { data, lastModified } = await manager.load();
    data.profile.tradingStyle = "options";
    
    const newLastModified = await manager.save(data, lastModified);
    expect(newLastModified).toBeGreaterThan(0);

    const reloaded = await manager.load();
    expect(reloaded.data.profile.tradingStyle).toBe("options");
    expect(reloaded.lastModified).toBe(newLastModified);
  });

  it("detects concurrent modifications (sequential stale writer)", async () => {
    const initialLoad = await manager.load();
    await manager.save(initialLoad.data, initialLoad.lastModified);
    
    const clientA = await manager.load();
    const clientB = await manager.load();

    // Client A saves
    clientA.data.profile.tradingStyle = "swing";
    await manager.save(clientA.data, clientA.lastModified);

    // Client B tries to save but its lastModified is stale
    clientB.data.profile.tradingStyle = "day";
    await expect(manager.save(clientB.data, clientB.lastModified)).rejects.toThrow("Conflict");
  });

  it("load() rejects when workspace.db is a symlink", async () => {
    const targetFile = path.join(tmpDir, "target.db");
    await fs.writeFile(targetFile, "", "utf-8");

    // Close default manager first to release file lock on workspace.db
    manager.close();

    const workspacePath = path.join(tmpDir, "workspace.db");
    if (fsSync.existsSync(workspacePath)) {
      await fs.unlink(workspacePath);
    }
    await fs.symlink(targetFile, workspacePath);

    // Re-create manager, should reject symlink in constructor/load
    expect(() => new StorageManager(tmpDir)).toThrow("symlink");
  });

  it("load() returns consistent data and lastModified from same database state", async () => {
    const { data, lastModified } = await manager.load();
    data.profile.tradingStyle = "swing";
    const newMtime = await manager.save(data, lastModified);

    const reloaded = await manager.load();
    expect(reloaded.data.profile.tradingStyle).toBe("swing");
    expect(reloaded.lastModified).toBe(newMtime);
  });

  it("save() detects database deleted between load and save", async () => {
    const { data, lastModified } = await manager.load();
    const mtime = await manager.save(data, lastModified);

    const loaded = await manager.load();
    manager.close();
    await fs.unlink(path.join(tmpDir, "workspace.db"));

    const newManager = new StorageManager(tmpDir);
    try {
      loaded.data.profile.tradingStyle = "day";
      await expect(newManager.save(loaded.data, mtime)).rejects.toThrow("deleted");
    } finally {
      newManager.close();
    }
  });

  it("P1 Fix: detects bootstrap race (two first writers)", async () => {
    const clientA = await manager.load();
    const clientB = await manager.load();

    expect(clientA.lastModified).toBe(0);
    expect(clientB.lastModified).toBe(0);

    // Client A saves first initialization
    clientA.data.profile.tradingStyle = "client-a";
    await manager.save(clientA.data, clientA.lastModified);

    // Client B tries to save its initialization but file now exists
    clientB.data.profile.tradingStyle = "client-b";
    await expect(manager.save(clientB.data, clientB.lastModified)).rejects.toThrow("already initialized");
  });
});
