interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export interface CacheStoreEntry {
  value: string;
  expiresAt: number;
}

// Optional second-level store shared by every TtlCache in the process (and, when
// backed by SQLite, by other stock-scanner processes). Values are JSON strings.
export interface CacheStore {
  get(key: string): CacheStoreEntry | undefined;
  set(key: string, value: string, expiresAt: number, source: string): void;
  delete(key: string): void;
  purgeExpired(now: number): void;
  close?(): void;
}

export const MAX_PERSISTED_VALUE_BYTES = 256 * 1024;
const PURGE_INTERVAL_MS = 60_000;

let sharedStore: CacheStore | null = null;
let lastPurgeAt = 0;

// Replaces (and closes) any previously registered store.
export function setSharedCacheStore(store: CacheStore | null): void {
  const previous = sharedStore;
  sharedStore = store;
  lastPurgeAt = 0;
  if (previous && previous !== store) {
    try {
      previous.close?.();
    } catch (e) {
      logStoreFailure("close", "shared", e);
    }
  }
}

export function getSharedCacheStore(): CacheStore | null {
  return sharedStore;
}

function logStoreFailure(action: string, namespace: string, err: unknown): void {
  console.error(`[cache] persistent cache ${action} failed (${namespace}): ${err instanceof Error ? err.message : String(err)}`);
}

export class TtlCache<T> {
  private store = new Map<string, CacheEntry<T>>();
  private readonly ttlMs: number;
  readonly namespace: string;

  constructor(ttlMs: number, namespace: string) {
    if (!namespace) throw new Error("TtlCache requires a non-empty namespace");
    this.ttlMs = ttlMs;
    this.namespace = namespace;
  }

  private sharedKey(key: string): string {
    return `${this.namespace}:${key}`;
  }

  get(key: string): T | undefined {
    const now = Date.now();
    const entry = this.store.get(key);
    if (entry) {
      if (now <= entry.expiresAt) return entry.value;
      this.store.delete(key);
    }

    const shared = sharedStore;
    if (!shared) return undefined;
    const sharedKey = this.sharedKey(key);
    try {
      const row = shared.get(sharedKey);
      if (!row) return undefined;
      if (!Number.isFinite(row.expiresAt) || now > row.expiresAt) {
        shared.delete(sharedKey);
        return undefined;
      }
      const value = JSON.parse(row.value) as T;
      this.store.set(key, { value, expiresAt: row.expiresAt });
      return value;
    } catch (e) {
      logStoreFailure("read", this.namespace, e);
      try {
        shared.delete(sharedKey);
      } catch {
        // the store itself is failing; the in-memory layer keeps serving
      }
      return undefined;
    }
  }

  set(key: string, value: T): void {
    const now = Date.now();
    const expiresAt = now + this.ttlMs;
    this.store.set(key, { value, expiresAt });

    const shared = sharedStore;
    if (!shared) return;
    try {
      const serialized = JSON.stringify(value);
      if (serialized === undefined || Buffer.byteLength(serialized, "utf8") > MAX_PERSISTED_VALUE_BYTES) return;
      shared.set(this.sharedKey(key), serialized, expiresAt, this.namespace);
      if (now - lastPurgeAt >= PURGE_INTERVAL_MS) {
        lastPurgeAt = now;
        shared.purgeExpired(now);
      }
    } catch (e) {
      logStoreFailure("write", this.namespace, e);
    }
  }

  async getOrFetch(key: string, fetcher: () => Promise<T>): Promise<T> {
    const cached = this.get(key);
    if (cached !== undefined) return cached;
    const value = await fetcher();
    this.set(key, value);
    return value;
  }
}
