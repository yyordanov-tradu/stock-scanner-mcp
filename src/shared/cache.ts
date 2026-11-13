import { DatabaseSync } from "node:sqlite";

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

function detectNamespace(): string {
  try {
    const err = new Error();
    const stack = err.stack;
    if (stack) {
      const lines = stack.split("\n");
      for (let i = 2; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes("cache.ts") || line.includes("cache.js")) continue;
        const match = line.match(/(?:modules|shared|scripts)\/([a-zA-Z0-9_-]+)/);
        if (match) {
          return match[1];
        }
        const fileMatch = line.match(/\/([a-zA-Z0-9_-]+)\.(?:ts|js|test\.ts|test\.js)/);
        if (fileMatch) {
          return fileMatch[1];
        }
      }
    }
  } catch {
    // Ignore
  }
  return "default";
}

export class TtlCache<T> {
  private static db: DatabaseSync | null = null;
  private store = new Map<string, CacheEntry<T>>();
  private readonly ttlMs: number;
  private readonly namespace: string;

  static setDb(db: DatabaseSync | null) {
    TtlCache.db = db;
  }

  static getDb(): DatabaseSync | null {
    return TtlCache.db;
  }

  constructor(ttlMs: number, namespace?: string) {
    this.ttlMs = ttlMs;
    this.namespace = namespace || detectNamespace();
  }

  private getNamespacedKey(key: string): string {
    return `${this.namespace}:${key}`;
  }

  get(key: string): T | undefined {
    const db = TtlCache.db;
    const useDb = db && (!process.env.VITEST || process.env.TEST_USE_SQLITE_CACHE);
    if (useDb) {
      try {
        const nsKey = this.getNamespacedKey(key);
        const stmt = db.prepare("SELECT value, expires_at FROM shared_cache WHERE cache_key = ?");
        const row = stmt.get(nsKey) as { value: string; expires_at: number } | undefined;
        
        if (!row) return undefined;
        
        if (Date.now() > row.expires_at) {
          const delStmt = db.prepare("DELETE FROM shared_cache WHERE cache_key = ?");
          delStmt.run(nsKey);
          return undefined;
        }
        
        return JSON.parse(row.value) as T;
      } catch (e) {
        console.error(`[cache] SQLite read failed: ${e instanceof Error ? e.message : String(e)}`);
        // Fallback to in-memory on DB errors
      }
    }

    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T): void {
    const db = TtlCache.db;
    const expiresAt = Date.now() + this.ttlMs;
    const useDb = db && (!process.env.VITEST || process.env.TEST_USE_SQLITE_CACHE);

    if (useDb) {
      try {
        const nsKey = this.getNamespacedKey(key);
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO shared_cache (cache_key, value, expires_at, source)
          VALUES (?, ?, ?, ?)
        `);
        stmt.run(nsKey, JSON.stringify(value), expiresAt, this.namespace);
        
        // Purge expired items
        const purgeStmt = db.prepare("DELETE FROM shared_cache WHERE expires_at < ?");
        purgeStmt.run(Date.now());
        return;
      } catch (e) {
        console.error(`[cache] SQLite write failed: ${e instanceof Error ? e.message : String(e)}`);
        // Fallback to in-memory on DB errors
      }
    }

    this.store.set(key, {
      value,
      expiresAt,
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
