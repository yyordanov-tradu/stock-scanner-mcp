import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
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
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("loads default data if file does not exist", async () => {
    const { data, lastModified } = await manager.load();
    expect(data.schemaVersion).toBe(1);
    expect(data.profile.workflowCadence).toBe("daily");
    expect(lastModified).toBe(0);
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
