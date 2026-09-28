import type { StatementSync } from "node:sqlite";
import { DatabaseManager, type DatabaseOptions } from "./db.js";
import { setSharedCacheStore, type CacheStore, type CacheStoreEntry } from "./cache.js";

export const CACHE_DB_FILE = "cache.db";
export const MAX_CACHE_ROWS = 5000;
// A failed cache write is tolerated, so never hold the event loop for long on a lock.
const CACHE_BUSY_TIMEOUT_MS = 250;

const SHARED_CACHE_DDL = `
  CREATE TABLE IF NOT EXISTS cache_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS shared_cache (
    cache_key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    source TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_shared_cache_expiry ON shared_cache (expires_at);
`;

export interface CacheStoreOptions {
  // Cached shapes follow the package version; a different version starts from an empty cache.
  version: string;
  busyTimeoutMs?: number;
  maxRows?: number;
}

export class SqliteCacheStore implements CacheStore {
  private constructor(
    private readonly dbManager: DatabaseManager,
    private readonly maxRows: number,
    private readonly selectStmt: StatementSync,
    private readonly upsertStmt: StatementSync,
    private readonly deleteStmt: StatementSync,
    private readonly purgeStmt: StatementSync,
    private readonly trimStmt: StatementSync,
  ) {}

  static async open(dataDir: string, options: CacheStoreOptions): Promise<SqliteCacheStore> {
    const dbOptions: DatabaseOptions = {
      fileName: CACHE_DB_FILE,
      busyTimeoutMs: options.busyTimeoutMs ?? CACHE_BUSY_TIMEOUT_MS,
    };
    const dbManager = new DatabaseManager(dataDir, dbOptions);
    const db = await dbManager.open();
    dbManager.transaction("IMMEDIATE", (d) => {
      d.exec(SHARED_CACHE_DDL);
      const row = d.prepare("SELECT value FROM cache_meta WHERE key = 'version'").get() as { value: string } | undefined;
      if (row?.value !== options.version) {
        d.exec("DELETE FROM shared_cache");
        d.prepare("INSERT OR REPLACE INTO cache_meta (key, value) VALUES ('version', ?)").run(options.version);
      }
    });
    const store = new SqliteCacheStore(
      dbManager,
      options.maxRows ?? MAX_CACHE_ROWS,
      db.prepare("SELECT value, expires_at FROM shared_cache WHERE cache_key = ?"),
      db.prepare("INSERT OR REPLACE INTO shared_cache (cache_key, value, expires_at, source) VALUES (?, ?, ?, ?)"),
      db.prepare("DELETE FROM shared_cache WHERE cache_key = ?"),
      db.prepare("DELETE FROM shared_cache WHERE expires_at < ?"),
      db.prepare(
        "DELETE FROM shared_cache WHERE cache_key IN (SELECT cache_key FROM shared_cache ORDER BY expires_at DESC LIMIT -1 OFFSET ?)",
      ),
    );
    store.purgeExpired(Date.now());
    return store;
  }

  get dbPath(): string {
    return this.dbManager.dbPath;
  }

  get(key: string): CacheStoreEntry | undefined {
    const row = this.selectStmt.get(key);
    if (!row || typeof row.value !== "string" || typeof row.expires_at !== "number") return undefined;
    return { value: row.value, expiresAt: row.expires_at };
  }

  set(key: string, value: string, expiresAt: number, source: string): void {
    this.upsertStmt.run(key, value, expiresAt, source);
  }

  delete(key: string): void {
    this.deleteStmt.run(key);
  }

  // Drops expired rows, then the oldest-expiring rows beyond the row cap.
  purgeExpired(now: number): void {
    this.purgeStmt.run(now);
    this.trimStmt.run(this.maxRows);
  }

  close(): void {
    this.dbManager.close();
  }
}

// Best effort: a persistent cache that cannot be opened must never stop the server.
export async function enablePersistentCache(dataDir: string, version: string): Promise<SqliteCacheStore | null> {
  try {
    const store = await SqliteCacheStore.open(dataDir, { version });
    setSharedCacheStore(store);
    console.error(`[cache] persistent cache enabled at ${store.dbPath}`);
    return store;
  } catch (e) {
    console.error(`[cache] persistent cache disabled: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}
