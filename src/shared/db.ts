import * as fs from "node:fs";
import * as path from "node:path";
import type { DatabaseSync } from "node:sqlite";

export interface DatabaseOptions {
  fileName: string;
  busyTimeoutMs?: number;
}

export type TransactionMode = "DEFERRED" | "IMMEDIATE";

const DEFAULT_BUSY_TIMEOUT_MS = 5000;
const SQLITE_BUSY = 5;
const SQLITE_LOCKED = 6;
const SQLITE_SIDECAR_SUFFIXES = ["", "-wal", "-shm", "-journal"];

export function assertNotSymlinkSync(filePath: string): void {
  try {
    if (fs.lstatSync(filePath).isSymbolicLink()) {
      throw new Error(`Refusing to operate on symlink: ${filePath}`);
    }
  } catch (e) {
    if (e instanceof Error && "code" in e && (e as NodeJS.ErrnoException).code === "ENOENT") return;
    throw e;
  }
}

export function isSqliteBusyError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const errcode = (err as Error & { errcode?: number }).errcode;
  return errcode === SQLITE_BUSY || errcode === SQLITE_LOCKED || /database is locked|SQLITE_BUSY/i.test(err.message);
}

export class DatabaseManager {
  readonly dbPath: string;
  private readonly dataDir: string;
  private readonly busyTimeoutMs: number;
  private db: DatabaseSync | null = null;
  private opening: Promise<DatabaseSync> | null = null;

  constructor(dataDir: string, options: DatabaseOptions) {
    this.dataDir = dataDir;
    this.dbPath = path.join(dataDir, options.fileName);
    const requested = options.busyTimeoutMs;
    this.busyTimeoutMs =
      requested !== undefined && Number.isSafeInteger(requested) && requested >= 0 ? requested : DEFAULT_BUSY_TIMEOUT_MS;
  }

  async open(): Promise<DatabaseSync> {
    if (this.db) return this.db;
    if (!this.opening) {
      this.opening = this.doOpen().finally(() => {
        this.opening = null;
      });
    }
    return this.opening;
  }

  private async doOpen(): Promise<DatabaseSync> {
    let sqlite: typeof import("node:sqlite");
    try {
      sqlite = await import("node:sqlite");
    } catch (e) {
      throw new Error(
        `This feature requires the built-in node:sqlite module (Node.js >= 22.13); ` +
          `running Node.js ${process.version}. ${e instanceof Error ? e.message : String(e)}`,
      );
    }

    fs.mkdirSync(this.dataDir, { recursive: true, mode: 0o700 });
    for (const suffix of SQLITE_SIDECAR_SUFFIXES) {
      assertNotSymlinkSync(this.dbPath + suffix);
    }

    const db = new sqlite.DatabaseSync(this.dbPath);
    try {
      db.exec(`PRAGMA busy_timeout = ${this.busyTimeoutMs};`);
      db.exec("PRAGMA journal_mode = WAL;");
      db.exec("PRAGMA foreign_keys = ON;");
    } catch (e) {
      db.close();
      throw e;
    }
    try {
      fs.chmodSync(this.dbPath, 0o600);
    } catch {
      // best effort; not supported on every platform
    }
    this.db = db;
    return db;
  }

  get(): DatabaseSync {
    if (!this.db) throw new Error("Database is not open");
    return this.db;
  }

  isOpen(): boolean {
    return this.db !== null;
  }

  // Synchronous only: node:sqlite is synchronous and COMMIT runs as soon as fn returns.
  transaction<T>(mode: TransactionMode, fn: (db: DatabaseSync) => T extends Promise<unknown> ? never : T): T {
    const db = this.get();
    db.exec(`BEGIN ${mode};`);
    try {
      const result = fn(db);
      db.exec("COMMIT;");
      return result;
    } catch (e) {
      try {
        db.exec("ROLLBACK;");
      } catch {
        // transaction may already have been rolled back by SQLite
      }
      throw e;
    }
  }

  close(): void {
    if (this.opening) {
      // An open() is in flight: close its connection once it lands.
      this.opening.then(() => this.close()).catch(() => {});
      return;
    }
    if (!this.db) return;
    this.db.close();
    this.db = null;
  }
}
