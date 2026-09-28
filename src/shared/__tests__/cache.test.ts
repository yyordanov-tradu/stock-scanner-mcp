import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  TtlCache,
  CacheStore,
  CacheStoreEntry,
  MAX_PERSISTED_VALUE_BYTES,
  setSharedCacheStore,
  getSharedCacheStore,
} from "../cache.js";

class MemoryStore implements CacheStore {
  rows = new Map<string, CacheStoreEntry & { source: string }>();
  purgeCalls = 0;
  failing = false;
  close?: () => void;

  get(key: string): CacheStoreEntry | undefined {
    if (this.failing) throw new Error("store down");
    const row = this.rows.get(key);
    return row ? { value: row.value, expiresAt: row.expiresAt } : undefined;
  }
  set(key: string, value: string, expiresAt: number, source: string): void {
    if (this.failing) throw new Error("store down");
    this.rows.set(key, { value, expiresAt, source });
  }
  delete(key: string): void {
    if (this.failing) throw new Error("store down");
    this.rows.delete(key);
  }
  purgeExpired(now: number): void {
    this.purgeCalls++;
    for (const [k, row] of this.rows) if (row.expiresAt < now) this.rows.delete(k);
  }
}

describe("TtlCache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    setSharedCacheStore(null);
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("requires a namespace", () => {
    expect(() => new TtlCache<string>(60_000, "")).toThrow("namespace");
    expect(new TtlCache<string>(60_000, "finnhub").namespace).toBe("finnhub");
  });

  it("returns cached value within TTL", () => {
    const cache = new TtlCache<string>(60_000, "t");
    cache.set("key1", "value1");
    expect(cache.get("key1")).toBe("value1");
  });

  it("returns undefined after TTL expires", () => {
    const cache = new TtlCache<string>(60_000, "t");
    cache.set("key1", "value1");
    vi.advanceTimersByTime(61_000);
    expect(cache.get("key1")).toBeUndefined();
  });

  it("returns undefined for missing key", () => {
    const cache = new TtlCache<string>(60_000, "t");
    expect(cache.get("missing")).toBeUndefined();
  });

  it("getOrFetch returns cached value if present", async () => {
    const cache = new TtlCache<string>(60_000, "t");
    cache.set("key1", "cached");
    const fetcher = vi.fn().mockResolvedValue("fresh");
    const result = await cache.getOrFetch("key1", fetcher);
    expect(result).toBe("cached");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("getOrFetch calls fetcher if cache miss", async () => {
    const cache = new TtlCache<string>(60_000, "t");
    const fetcher = vi.fn().mockResolvedValue("fresh");
    const result = await cache.getOrFetch("key1", fetcher);
    expect(result).toBe("fresh");
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("getOrFetch calls fetcher if cache expired", async () => {
    const cache = new TtlCache<string>(60_000, "t");
    cache.set("key1", "stale");
    vi.advanceTimersByTime(61_000);
    const fetcher = vi.fn().mockResolvedValue("fresh");
    const result = await cache.getOrFetch("key1", fetcher);
    expect(result).toBe("fresh");
  });

  describe("with a shared store", () => {
    let store: MemoryStore;

    beforeEach(() => {
      store = new MemoryStore();
      setSharedCacheStore(store);
      expect(getSharedCacheStore()).toBe(store);
    });

    it("writes through with a namespaced key and the namespace as source", () => {
      const cache = new TtlCache<{ price: number }>(60_000, "finnhub");
      cache.set("quote:AAPL", { price: 1 });
      const row = store.rows.get("finnhub:quote:AAPL");
      expect(row?.value).toBe(JSON.stringify({ price: 1 }));
      expect(row?.source).toBe("finnhub");
      expect(row?.expiresAt).toBe(Date.now() + 60_000);
    });

    it("keeps modules that use the same key string isolated", () => {
      const finnhub = new TtlCache<unknown>(60_000, "finnhub");
      const alphaVantage = new TtlCache<unknown>(60_000, "alpha-vantage");
      finnhub.set("quote:AAPL", { c: 1 });
      alphaVantage.set("quote:AAPL", { price: 2 });

      expect(finnhub.get("quote:AAPL")).toEqual({ c: 1 });
      expect(alphaVantage.get("quote:AAPL")).toEqual({ price: 2 });
      expect(store.rows.size).toBe(2);
    });

    it("serves a value written by another process from the store and warms memory", () => {
      store.rows.set("finnhub:quote:AAPL", { value: JSON.stringify({ c: 42 }), expiresAt: Date.now() + 1000, source: "finnhub" });
      const cache = new TtlCache<{ c: number }>(60_000, "finnhub");
      expect(cache.get("quote:AAPL")).toEqual({ c: 42 });

      store.rows.clear();
      expect(cache.get("quote:AAPL")).toEqual({ c: 42 });
    });

    it("treats an expired store row as a miss and removes it", () => {
      store.rows.set("finnhub:k", { value: "1", expiresAt: Date.now() - 1, source: "finnhub" });
      const cache = new TtlCache<number>(60_000, "finnhub");
      expect(cache.get("k")).toBeUndefined();
      expect(store.rows.has("finnhub:k")).toBe(false);
    });

    it("keeps serving from memory when the store fails, and logs once per failure", () => {
      const stderr = vi.spyOn(console, "error").mockImplementation(() => {});
      const cache = new TtlCache<string>(60_000, "finnhub");
      store.failing = true;
      cache.set("k", "v");
      expect(cache.get("k")).toBe("v");
      expect(stderr).toHaveBeenCalledTimes(1);
      expect(stderr.mock.calls[0][0]).toContain("persistent cache write failed (finnhub)");

      vi.advanceTimersByTime(61_000);
      expect(cache.get("k")).toBeUndefined();
      expect(stderr).toHaveBeenCalledTimes(2);
      expect(stderr.mock.calls[1][0]).toContain("persistent cache read failed (finnhub)");
    });

    it("drops a corrupted store row instead of failing every read", () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      store.rows.set("finnhub:k", { value: "{not json", expiresAt: Date.now() + 1000, source: "finnhub" });
      const cache = new TtlCache<unknown>(60_000, "finnhub");
      expect(cache.get("k")).toBeUndefined();
      expect(store.rows.has("finnhub:k")).toBe(false);
    });

    it("does not persist values above the size cap or non-serializable values", () => {
      const cache = new TtlCache<unknown>(60_000, "edgar");
      cache.set("big", "x".repeat(MAX_PERSISTED_VALUE_BYTES + 1));
      cache.set("fn", () => 1);
      cache.set("small", "y");
      expect([...store.rows.keys()]).toEqual(["edgar:small"]);
      expect(cache.get("big")).toHaveLength(MAX_PERSISTED_VALUE_BYTES + 1);
    });

    it("purges expired rows at most once per minute", () => {
      const cache = new TtlCache<string>(1_000, "t");
      cache.set("a", "1");
      expect(store.purgeCalls).toBe(1);
      vi.advanceTimersByTime(59_999);
      cache.set("b", "2");
      expect(store.purgeCalls).toBe(1);

      vi.advanceTimersByTime(1);
      cache.set("c", "3");
      expect(store.purgeCalls).toBe(2);
      expect([...store.rows.keys()]).toEqual(["t:b", "t:c"]);
    });

    it("getOrFetch serves a store row without calling the fetcher", async () => {
      store.rows.set("finnhub:k", { value: JSON.stringify({ c: 1 }), expiresAt: Date.now() + 1000, source: "finnhub" });
      const cache = new TtlCache<{ c: number }>(60_000, "finnhub");
      const fetcher = vi.fn().mockResolvedValue({ c: 2 });
      expect(await cache.getOrFetch("k", fetcher)).toEqual({ c: 1 });
      expect(fetcher).not.toHaveBeenCalled();
    });

    it("treats a non-finite expiry as a miss and deletes the row", () => {
      store.rows.set("finnhub:k", { value: "1", expiresAt: Number.NaN, source: "finnhub" });
      const cache = new TtlCache<number>(60_000, "finnhub");
      expect(cache.get("k")).toBeUndefined();
      expect(store.rows.has("finnhub:k")).toBe(false);
    });

    it("logs and keeps the memory value when serialisation throws", () => {
      const stderr = vi.spyOn(console, "error").mockImplementation(() => {});
      const cache = new TtlCache<Record<string, unknown>>(60_000, "t");
      const cyclic: Record<string, unknown> = {};
      cyclic.self = cyclic;
      cache.set("k", cyclic);
      expect(cache.get("k")).toBe(cyclic);
      expect(store.rows.size).toBe(0);
      expect(stderr.mock.calls[0][0]).toContain("persistent cache write failed (t)");
    });

    it("measures the size cap in bytes, not UTF-16 code units", () => {
      const cache = new TtlCache<string>(60_000, "t");
      cache.set("wide", "€".repeat(MAX_PERSISTED_VALUE_BYTES / 3));
      expect(store.rows.size).toBe(0);
    });

    it("closes the previous store when a new one is registered", () => {
      const closed = vi.fn();
      store.close = closed;
      setSharedCacheStore(new MemoryStore());
      expect(closed).toHaveBeenCalledOnce();
    });
  });
});
