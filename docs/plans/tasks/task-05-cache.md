# Task 5: TTL Cache

**Files:**
- Create: `src/shared/cache.ts`
- Test: `src/shared/__tests__/cache.test.ts`

---

**Step 1: Write the test**

Create `src/shared/__tests__/cache.test.ts`:

```typescript
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
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/__tests__/cache.test.ts`
Expected: FAIL

**Step 3: Write the cache**

Create `src/shared/cache.ts`:

```typescript
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class TtlCache<T> {
  private store = new Map<string, CacheEntry<T>>();
  private readonly ttlMs: number;

  constructor(ttlMs: number) {
    this.ttlMs = ttlMs;
  }

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  async getOrFetch(key: string, fetcher: () => Promise<T>): Promise<T> {
    const cached = this.get(key);
    if (cached !== undefined) return cached;
    const value = await fetcher();
    this.set(key, value);
    return value;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/shared/__tests__/cache.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/shared/cache.ts src/shared/__tests__/cache.test.ts
git commit -m "feat: add TTL cache with getOrFetch for rate-limited APIs"
```
