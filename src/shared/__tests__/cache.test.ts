import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TtlCache } from "../cache.js";

describe("TtlCache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns cached value within TTL", () => {
    const cache = new TtlCache<string>(60_000);
    cache.set("key1", "value1");
    expect(cache.get("key1")).toBe("value1");
  });

  it("returns undefined after TTL expires", () => {
    const cache = new TtlCache<string>(60_000);
    cache.set("key1", "value1");
    vi.advanceTimersByTime(61_000);
    expect(cache.get("key1")).toBeUndefined();
  });

  it("returns undefined for missing key", () => {
    const cache = new TtlCache<string>(60_000);
    expect(cache.get("missing")).toBeUndefined();
  });

  it("getOrFetch returns cached value if present", async () => {
    const cache = new TtlCache<string>(60_000);
    cache.set("key1", "cached");
    const fetcher = vi.fn().mockResolvedValue("fresh");
    const result = await cache.getOrFetch("key1", fetcher);
    expect(result).toBe("cached");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("getOrFetch calls fetcher if cache miss", async () => {
    const cache = new TtlCache<string>(60_000);
    const fetcher = vi.fn().mockResolvedValue("fresh");
    const result = await cache.getOrFetch("key1", fetcher);
    expect(result).toBe("fresh");
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("getOrFetch calls fetcher if cache expired", async () => {
    const cache = new TtlCache<string>(60_000);
    cache.set("key1", "stale");
    vi.advanceTimersByTime(61_000);
    const fetcher = vi.fn().mockResolvedValue("fresh");
    const result = await cache.getOrFetch("key1", fetcher);
    expect(result).toBe("fresh");
  });

  describe("with SQLite backing", () => {
    let db: any;

    beforeEach(() => {
      process.env.TEST_USE_SQLITE_CACHE = "true";
      const { DatabaseSync } = require("node:sqlite");
      db = new DatabaseSync(":memory:");
      db.exec(`
        CREATE TABLE IF NOT EXISTS shared_cache (
          cache_key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          expires_at INTEGER NOT NULL,
          source TEXT NOT NULL,
          data_delay TEXT
        );
      `);
      TtlCache.setDb(db);
    });

    afterEach(() => {
      delete process.env.TEST_USE_SQLITE_CACHE;
      TtlCache.setDb(null);
      if (db) db.close();
    });

    it("persists values to SQLite and namespace is automatically detected", () => {
      const cache = new TtlCache<string>(60_000);
      cache.set("foo", "bar");

      // Verify it was written to SQLite
      const stmt = db.prepare("SELECT * FROM shared_cache");
      const row = stmt.get() as any;
      expect(row).toBeDefined();
      expect(row.cache_key).toContain("foo");
      expect(row.value).toBe(JSON.stringify("bar"));
      expect(row.source).toBeDefined(); // Namespace should be detected

      // Verify we can retrieve it
      expect(cache.get("foo")).toBe("bar");
    });

    it("namespaces keys to prevent collisions", () => {
      const cache1 = new TtlCache<string>(60_000, "ns1");
      const cache2 = new TtlCache<string>(60_000, "ns2");

      cache1.set("key", "val1");
      cache2.set("key", "val2");

      expect(cache1.get("key")).toBe("val1");
      expect(cache2.get("key")).toBe("val2");

      const rows = db.prepare("SELECT * FROM shared_cache").all() as any[];
      expect(rows).toHaveLength(2);
      expect(rows.map(r => r.cache_key)).toContain("ns1:key");
      expect(rows.map(r => r.cache_key)).toContain("ns2:key");
    });

    it("expires SQLite records appropriately", () => {
      const cache = new TtlCache<string>(60_000);
      cache.set("foo", "bar");
      
      // Advance time beyond TTL
      vi.advanceTimersByTime(61_000);
      
      expect(cache.get("foo")).toBeUndefined();
      
      // Verify it is deleted from the DB
      const row = db.prepare("SELECT * FROM shared_cache").get();
      expect(row).toBeUndefined();
    });
  });
});
