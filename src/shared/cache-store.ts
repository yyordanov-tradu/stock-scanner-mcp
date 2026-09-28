import type { StatementSync } from "node:sqlite";
import { DatabaseManager, DatabaseOptions } from "./db.js";
import { CacheStore, CacheStoreEntry, setSharedCacheStore } from "./cache.js";

export const CACHE_DB_FILE = "cache.db";

const SHARED_CACHE_DDL = `
  CREATE TABLE IF NOT EXISTS shared_cache (
    cache_key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    source TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_shared_cache_expiry ON shared_cache (expires_at);
`;

interface CacheRow {
  value: string;
  expires_at: number;
}

export class SqliteCacheStore implements CacheStore {
  private constructor(
    private readonly dbManager: DatabaseManager,
    private readonly selectStmt: StatementSync,
    private readonly upsertStmt: StatementSync,
    private readonly deleteStmt: StatementSync,
    private readonly purgeStmt: StatementSync,
  ) {}

  static async open(dataDir: string, options: Omit<DatabaseOptions, "fileName"> = {}): Promise<SqliteCacheStore> {
    const dbManager = new DatabaseManager(dataDir, { ...options, fileName: CACHE_DB_FILE });
    const db = await dbManager.open();
    dbManager.transaction("IMMEDIATE", (d) => d.exec(SHARED_CACHE_DDL));
    return new SqliteCacheStore(
      dbManager,
      db.prepare("SELECT value, expires_at FROM shared_cache WHERE cache_key = ?"),
      db.prepare("INSERT OR REPLACE INTO shared_cache (cache_key, value, expires_at, source) VALUES (?, ?, ?, ?)"),
      db.prepare("DELETE FROM shared_cache WHERE cache_key = ?"),
      db.prepare("DELETE FROM shared_cache WHERE expires_at < ?"),
    );
  }

  get dbPath(): string {
    return this.dbManager.dbPath;
  }

  get(key: string): CacheStoreEntry | undefined {
    const row = this.selectStmt.get(key) as CacheRow | undefined;
    return row ? { value: row.value, expiresAt: row.expires_at } : undefined;
  }

  set(key: string, value: string, expiresAt: number, source: string): void {
    this.upsertStmt.run(key, value, expiresAt, source);
  }

  delete(key: string): void {
    this.deleteStmt.run(key);
  }

  purgeExpired(now: number): void {
    this.purgeStmt.run(now);
  }

  close(): void {
    this.dbManager.close();
  }
}

// Best effort: a persistent cache that cannot be opened must never stop the server.
export async function enablePersistentCache(dataDir: string): Promise<SqliteCacheStore | null> {
  try {
    const store = await SqliteCacheStore.open(dataDir);
    setSharedCacheStore(store);
    console.error(`[cache] persistent cache enabled at ${store.dbPath}`);
    return store;
  } catch (e) {
    console.error(`[cache] persistent cache disabled: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}
