import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { SqliteCacheStore, enablePersistentCache, CACHE_DB_FILE } from "../cache-store.js";
import { TtlCache, getSharedCacheStore, setSharedCacheStore } from "../cache.js";

describe("SqliteCacheStore", () => {
  let tmpDir: string;
  const stores: SqliteCacheStore[] = [];

  async function open(dir = tmpDir, version = "1.0.0", maxRows?: number): Promise<SqliteCacheStore> {
    const s = await SqliteCacheStore.open(dir, { version, maxRows });
    stores.push(s);
    return s;
  }

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cache-store-test-"));
  });

  afterEach(() => {
    setSharedCacheStore(null);
    for (const s of stores.splice(0)) s.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("creates cache.db separate from the workspace database", async () => {
    const store = await open();
    expect(store.dbPath).toBe(path.join(tmpDir, CACHE_DB_FILE));
    expect(fs.existsSync(path.join(tmpDir, "workspace.db"))).toBe(false);
  });

  it("round-trips entries and survives reopening", async () => {
    const store = await open();
    const expiresAt = Date.now() + 60_000;
    store.set("finnhub:quote:AAPL", '{"c":1}', expiresAt, "finnhub");
    expect(store.get("finnhub:quote:AAPL")).toEqual({ value: '{"c":1}', expiresAt });
    expect(store.get("missing")).toBeUndefined();
    store.close();

    const reopened = await open();
    expect(reopened.get("finnhub:quote:AAPL")).toEqual({ value: '{"c":1}', expiresAt });
  });

  it("replaces, deletes and purges rows", async () => {
    const store = await open();
    store.set("k", "1", 10, "t");
    store.set("k", "2", 20, "t");
    expect(store.get("k")).toEqual({ value: "2", expiresAt: 20 });

    store.set("old", "0", 5, "t");
    store.purgeExpired(15);
    expect(store.get("old")).toBeUndefined();
    expect(store.get("k")).toEqual({ value: "2", expiresAt: 20 });

    store.delete("k");
    expect(store.get("k")).toBeUndefined();
  });

  it("is shared across TtlCache instances in different processes' stores", async () => {
    const writer = await open();
    setSharedCacheStore(writer);
    new TtlCache<{ c: number }>(60_000, "finnhub").set("quote:AAPL", { c: 7 });

    const reader = await open();
    setSharedCacheStore(reader);
    expect(new TtlCache<{ c: number }>(60_000, "finnhub").get("quote:AAPL")).toEqual({ c: 7 });
  });

  it("starts from an empty cache when the package version changes", async () => {
    const store = await open();
    store.set("finnhub:quote:AAPL", '{"c":1}', Date.now() + 60_000, "finnhub");
    store.close();

    expect((await open(tmpDir, "1.0.0")).get("finnhub:quote:AAPL")).toBeDefined();
    expect((await open(tmpDir, "2.0.0")).get("finnhub:quote:AAPL")).toBeUndefined();
  });

  it("purges expired rows on open and trims to the row cap", async () => {
    const store = await open(tmpDir, "1.0.0", 3);
    store.set("old", "0", Date.now() - 1, "t");
    for (let i = 1; i <= 5; i++) store.set(`k${i}`, "v", Date.now() + i * 1000, "t");
    store.close();

    const reopened = await open(tmpDir, "1.0.0", 3);
    expect(reopened.get("old")).toBeUndefined();
    expect(reopened.get("k1")).toBeUndefined();
    expect(reopened.get("k2")).toBeUndefined();
    expect(reopened.get("k3")).toBeDefined();
    expect(reopened.get("k5")).toBeDefined();
  });

  it("refuses a symlinked cache.db", async () => {
    fs.writeFileSync(path.join(tmpDir, "target"), "");
    fs.symlinkSync(path.join(tmpDir, "target"), path.join(tmpDir, CACHE_DB_FILE));
    await expect(open()).rejects.toThrow("symlink");
  });
});

describe("enablePersistentCache", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cache-enable-test-"));
  });

  afterEach(() => {
    const store = getSharedCacheStore();
    setSharedCacheStore(null);
    if (store instanceof SqliteCacheStore) store.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("opens the store, registers it as the shared store and logs the path", async () => {
    const stderr = vi.spyOn(console, "error").mockImplementation(() => {});
    const store = await enablePersistentCache(tmpDir, "1.0.0");
    expect(store).toBeInstanceOf(SqliteCacheStore);
    expect(getSharedCacheStore()).toBe(store);
    expect(stderr.mock.calls[0][0]).toContain(`persistent cache enabled at ${path.join(tmpDir, CACHE_DB_FILE)}`);
  });

  it("closes the previous store when enabled twice", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const first = await enablePersistentCache(tmpDir, "1.0.0");
    const closeSpy = vi.spyOn(first as SqliteCacheStore, "close");
    const second = await enablePersistentCache(tmpDir, "1.0.0");
    // Avoid matchers that pretty-print the closed store's finalized statements.
    expect(second === first).toBe(false);
    expect(closeSpy).toHaveBeenCalledOnce();
    expect(getSharedCacheStore() === second).toBe(true);
  });

  it("never throws: an unusable data dir disables the cache with a warning", async () => {
    const stderr = vi.spyOn(console, "error").mockImplementation(() => {});
    fs.writeFileSync(path.join(tmpDir, "target"), "");
    fs.symlinkSync(path.join(tmpDir, "target"), path.join(tmpDir, CACHE_DB_FILE));

    const store = await enablePersistentCache(tmpDir, "1.0.0");
    expect(store).toBeNull();
    expect(getSharedCacheStore()).toBeNull();
    expect(stderr.mock.calls[0][0]).toContain("persistent cache disabled");
  });
});
