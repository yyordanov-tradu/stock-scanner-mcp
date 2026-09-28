import * as fs from "node:fs";
import * as path from "node:path";
import { ZodError } from "zod";
import type { DatabaseSync } from "node:sqlite";
import { DatabaseManager, assertNotSymlinkSync, isSqliteBusyError } from "../../shared/db.js";
import { RESERVED_KEYS, Workspace, WorkspaceSchema } from "./types.js";
import {
  createWorkspaceSchema,
  readMeta,
  readProfileVersion,
  readWorkspace,
  writeMeta,
  writeWorkspace,
} from "./schema.js";

export interface LoadResult {
  data: Workspace;
  version: number;
}

export interface StorageOptions {
  busyTimeoutMs?: number;
}

export const WORKSPACE_DB_FILE = "workspace.db";
export const LEGACY_WORKSPACE_FILE = "workspace.json";
const MIRROR_MTIME_KEY = "mirror_mtime_ms";

function findReservedKeys(parsed: unknown): string[] {
  if (typeof parsed !== "object" || parsed === null) return [];
  const found: string[] = [];
  for (const section of ["watchlists", "theses"] as const) {
    const record = (parsed as Record<string, unknown>)[section];
    if (typeof record !== "object" || record === null) continue;
    for (const key of Object.keys(record)) {
      if (RESERVED_KEYS.has(key)) found.push(`${section}.${key}`);
    }
  }
  return found;
}

const BUSY_MESSAGE =
  "Conflict: The workspace is locked by another stock-scanner process (a second session or the sidecar). Please retry.";

export class StorageManager {
  private readonly dbManager: DatabaseManager;
  private readonly legacyPath: string;
  private readonly defaultExchange: string;
  private ready = false;

  constructor(dataDir: string, defaultExchange = "NASDAQ", options: StorageOptions = {}) {
    this.dbManager = new DatabaseManager(dataDir, { fileName: WORKSPACE_DB_FILE, busyTimeoutMs: options.busyTimeoutMs });
    this.legacyPath = path.join(dataDir, LEGACY_WORKSPACE_FILE);
    this.defaultExchange = defaultExchange;
  }

  get dbPath(): string {
    return this.dbManager.dbPath;
  }

  // First use: create the schema and import workspace.json when the database is empty or
  // when the JSON file was modified after our last mirror write (an older release ran).
  private async ensureReady(): Promise<void> {
    if (this.ready) return;
    await this.dbManager.open();
    this.withBusyMapping(() =>
      this.dbManager.transaction("IMMEDIATE", (db) => {
        createWorkspaceSchema(db);
        const legacyMtime = this.statLegacyMtime();
        if (legacyMtime === null) return;

        const current = readProfileVersion(db);
        const recordedMtime = Number(readMeta(db, MIRROR_MTIME_KEY) ?? 0);
        if (current !== null && legacyMtime <= recordedMtime) return;

        const legacy = this.readLegacyWorkspace();
        const version = (current ?? 0) + 1;
        writeWorkspace(db, legacy, version);
        writeMeta(db, MIRROR_MTIME_KEY, String(legacyMtime));
        console.error(
          current === null
            ? `[workspace] Imported ${this.legacyPath} into ${this.dbManager.dbPath}. The JSON file is kept up to date as a mirror.`
            : `[workspace] ${this.legacyPath} is newer than ${this.dbManager.dbPath} (written by an older release?); re-imported it.`,
        );
      }),
    );
    this.ready = true;
  }

  private statLegacyMtime(): number | null {
    assertNotSymlinkSync(this.legacyPath);
    try {
      return fs.statSync(this.legacyPath).mtimeMs;
    } catch (e) {
      if (e instanceof Error && "code" in e && (e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
  }

  private readLegacyWorkspace(): Workspace {
    const raw = fs.readFileSync(this.legacyPath, "utf-8");
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      throw new Error(`Workspace file corrupted (${this.legacyPath}): ${e instanceof Error ? e.message : String(e)}`);
    }
    // zod's record parser silently drops keys like __proto__; reject them explicitly instead.
    const reserved = findReservedKeys(parsed);
    if (reserved.length > 0) {
      throw new Error(`Workspace file invalid (${this.legacyPath}): contains reserved key(s) ${reserved.join(", ")}`);
    }
    try {
      return WorkspaceSchema.parse(parsed);
    } catch (e) {
      const detail = e instanceof ZodError ? e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") : String(e);
      throw new Error(`Workspace file invalid (${this.legacyPath}): ${detail}`);
    }
  }

  private withBusyMapping<T>(fn: () => T): T {
    try {
      return fn();
    } catch (e) {
      if (isSqliteBusyError(e)) throw new Error(BUSY_MESSAGE);
      throw e;
    }
  }

  async load(): Promise<LoadResult> {
    await this.ensureReady();
    const stored = this.withBusyMapping(() => this.dbManager.transaction("DEFERRED", readWorkspace));
    if (stored) return { data: stored.data, version: stored.version };
    return {
      data: WorkspaceSchema.parse({ profile: { defaultExchange: this.defaultExchange } }),
      version: 0,
    };
  }

  async save(data: Workspace, expectedVersion: number): Promise<number> {
    await this.ensureReady();
    return this.withBusyMapping(() =>
      this.dbManager.transaction("IMMEDIATE", (db) => {
        const current = readProfileVersion(db);

        if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0) {
          throw new Error(`Conflict: Invalid workspace version ${String(expectedVersion)}. Please reload.`);
        }
        if (expectedVersion === 0 && current !== null) {
          throw new Error("Conflict: The workspace was already initialized by another process. Please reload.");
        }
        if (expectedVersion > 0) {
          if (current === null) {
            throw new Error("Conflict: The workspace has been reset by another process. Please reload.");
          }
          if (current !== expectedVersion) {
            throw new Error("Conflict: The workspace has been modified by another process. Please reload and try again.");
          }
        }

        const next = (current ?? 0) + 1;
        writeWorkspace(db, data, next);
        this.writeMirror(db, data);
        return next;
      }),
    );
  }

  // Keeps workspace.json readable by releases that predate SQLite storage. Runs under the
  // write lock so mirrors cannot interleave; a mirror failure must not fail the save.
  private writeMirror(db: DatabaseSync, data: Workspace): void {
    const tmpPath = `${this.legacyPath}.tmp`;
    try {
      assertNotSymlinkSync(this.legacyPath);
      try {
        fs.unlinkSync(tmpPath);
      } catch {
        // no stale temp file
      }
      fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), { encoding: "utf-8", mode: 0o600, flag: "wx" });
      fs.renameSync(tmpPath, this.legacyPath);
      writeMeta(db, MIRROR_MTIME_KEY, String(fs.statSync(this.legacyPath).mtimeMs));
    } catch (e) {
      console.error(`[workspace] Could not update ${this.legacyPath} mirror: ${e instanceof Error ? e.message : String(e)}`);
      try {
        fs.unlinkSync(tmpPath);
      } catch {
        // nothing to clean up
      }
    }
  }

  close(): void {
    this.dbManager.close();
    this.ready = false;
  }
}
