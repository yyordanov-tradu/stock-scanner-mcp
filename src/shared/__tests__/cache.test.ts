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
});
